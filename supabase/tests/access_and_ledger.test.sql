-- Run: npx supabase test db
-- Proves the SPEC §9 access rule, the atomic quota, and the idempotent fridge ledger.
-- Server-role queries are scoped to the test users, so the suite passes on a local database
-- that already holds real development data (other accounts' plans, fridge items).
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local');
insert into public.category_defaults (category, shelf_life_days, source) values ('produce', '{"fridge":5}', 'test')
  on conflict do nothing;
insert into public.ingredients (id, name, category, base_unit) values ('ing_test_spinach', 'Spinach', 'produce', 'g')
  on conflict do nothing;

-- ---- quota (server role)
select results_eq($$ select used, allowed from public.consume_quota('11111111-1111-1111-1111-111111111111', 'plans', 'lifetime', 1) $$,
                  $$ values (1, true) $$, 'first use within the limit is allowed');
select results_eq($$ select used, allowed from public.consume_quota('11111111-1111-1111-1111-111111111111', 'plans', 'lifetime', 1) $$,
                  $$ values (1, false) $$, 'a use past the limit is refused and not counted');
select lives_ok($$ select public.release_quota('11111111-1111-1111-1111-111111111111', 'plans', 'lifetime') $$,
                'a failed attempt gives its use back');
select results_eq($$ select used, allowed from public.consume_quota('11111111-1111-1111-1111-111111111111', 'plans', 'lifetime', 1) $$,
                  $$ values (1, true) $$, 'the released use can be spent again');
select lives_ok($$ select public.release_quota('11111111-1111-1111-1111-111111111111', 'plans', 'lifetime');
                   select public.release_quota('11111111-1111-1111-1111-111111111111', 'plans', 'lifetime') $$,
                'releasing more than was used does not fail');
select is((select count from public.usage_counters where user_id = '11111111-1111-1111-1111-111111111111' and feature = 'plans' and period = 'lifetime'), 0, 'a counter never goes below zero');

-- ---- ledger (server role)
select is(
  (public.apply_inventory_batch('11111111-1111-1111-1111-111111111111', 'batch_one',
    '[{"itemId":null,"delta":0,"reason":"purchase","newItem":{"kind":"ingredient","ingredientId":"ing_test_spinach","recipeId":null,"name":"Spinach","category":"produce","qty":150,"unit":"g","location":"fridge","expiresOn":"2026-10-25","expirySource":"table","origin":"receipt"}}]'::jsonb
  )->>'events')::int, 1, 'a batch creates the new item');
select is(
  (public.apply_inventory_batch('11111111-1111-1111-1111-111111111111', 'batch_one', '[]'::jsonb)->>'replayed')::boolean,
  true, 'the same batch key replays the first result');
select is((select count(*)::int from public.fridge_items where user_id = '11111111-1111-1111-1111-111111111111'), 1,
  'a replayed batch writes nothing');
select is((select count(*)::int from public.inventory_events where user_id = '11111111-1111-1111-1111-111111111111' and batch_key = 'batch_one'), 1, 'one event per batch item');

select throws_like(
  format($f$ select public.apply_inventory_batch('11111111-1111-1111-1111-111111111111', 'batch_two', %L::jsonb) $f$,
    json_build_array(json_build_object('itemId', (select id from public.fridge_items where user_id = '11111111-1111-1111-1111-111111111111' limit 1), 'delta', -999, 'reason', 'cook'))::text),
  'insufficient_stock%', 'a deduction larger than stock is refused');
select is((select qty from public.fridge_items where user_id = '11111111-1111-1111-1111-111111111111' limit 1), 150::numeric, 'a refused batch changes nothing');

select is(
  (public.apply_inventory_batch('11111111-1111-1111-1111-111111111111', 'batch_three',
    json_build_array(json_build_object('itemId', (select id from public.fridge_items where user_id = '11111111-1111-1111-1111-111111111111' limit 1), 'delta', -150, 'reason', 'cook'))::jsonb
  )->>'events')::int, 1, 'a full deduction is applied');
select is((select status from public.fridge_items where user_id = '11111111-1111-1111-1111-111111111111' limit 1), 'used', 'an item used up is marked used');

-- ---- client access (authenticated role)
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.fridge_items), 1, 'a user reads their own fridge');
select is((select count(*)::int from public.ingredients where id = 'ing_test_spinach'), 1, 'a user reads the catalog');
select throws_ok($$ insert into public.entitlements (user_id, plan) values ('11111111-1111-1111-1111-111111111111', 'pro') $$,
  '42501', null, 'a user cannot grant themselves Pro');
select throws_ok($$ update public.fridge_items set qty = 999 $$, '42501', null, 'a user cannot write the fridge directly');
select throws_ok($$ select public.consume_quota('11111111-1111-1111-1111-111111111111', 'plans', 'lifetime', 99) $$,
  '42501', null, 'a user cannot call the quota function');
select is((select count(*)::int from public.runs) + (select count(*)::int from public.inventory_batches) + (select count(*)::int from public.payment_events),
  0, 'server-only tables are invisible to users');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.fridge_items), 0, 'another user sees none of it');

select * from finish();
rollback;
