-- Run: npx supabase test db
-- Platform fixes from Fridge's handoff (docs/ROLES.md): atomic item edits with an expected-quantity
-- check, exact shortfall details, and the user's local date for added_on.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'edit-a@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'edit-b@test.local');
insert into public.category_defaults (category, shelf_life_days, source) values ('produce', '{"fridge":5,"freezer":240}', 'test') on conflict do nothing;
insert into public.ingredients (id, name, category, base_unit) values ('ing_test_kale', 'Kale', 'produce', 'g') on conflict do nothing;

-- Catch an error's detail so tests can read exact numbers.
create function pg_temp.err_detail(sql text) returns jsonb language plpgsql as $$
declare d text;
begin
  execute sql;
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return d::jsonb;
end $$;

-- ---- added_on uses the caller's local date
select public.apply_inventory_batch('33333333-3333-3333-3333-333333333333', 'man:add1',
  '[{"itemId":null,"delta":200,"reason":"purchase","newItem":{"kind":"ingredient","ingredientId":"ing_test_kale","recipeId":null,"name":"Kale","category":"produce","qty":200,"unit":"g","location":"fridge","expiresOn":"2026-10-25","expirySource":"table","origin":"manual"}}]'::jsonb,
  '2026-10-20'::date);
select is((select added_on from public.fridge_items where user_id = '33333333-3333-3333-3333-333333333333'), '2026-10-20'::date,
  'added_on is the user''s local date, not the server''s');
select lives_ok($$ select public.apply_inventory_batch('33333333-3333-3333-3333-333333333333', 'man:old-callers', '[]'::jsonb) $$,
  'callers that do not pass a date still work');
-- Pick a zone whose date differs from the server's right now (UTC+14 or UTC-11 always does).
create temp table tz as select case when (now() at time zone 'Pacific/Kiritimati')::date <> current_date
  then 'Pacific/Kiritimati' else 'Pacific/Pago_Pago' end as name;
insert into public.profiles (user_id, timezone) values ('44444444-4444-4444-4444-444444444444', (select name from tz))
  on conflict (user_id) do update set timezone = excluded.timezone;
select public.apply_inventory_batch('44444444-4444-4444-4444-444444444444', 'man:tz',
  '[{"itemId":null,"delta":1,"reason":"purchase","newItem":{"kind":"generic","ingredientId":null,"recipeId":null,"name":"Limes","category":"produce","qty":1,"unit":"count","location":"fridge","expiresOn":null,"expirySource":"category","origin":"manual"}}]'::jsonb);
select is((select added_on from public.fridge_items where user_id = '44444444-4444-4444-4444-444444444444'),
  (now() at time zone (select name from tz))::date, 'without a date, added_on is today in the user''s profile timezone');

-- ---- exact shortfall details
select is(
  pg_temp.err_detail(format($f$ select public.apply_inventory_batch('33333333-3333-3333-3333-333333333333', 'man:short', %L::jsonb) $f$,
    json_build_array(json_build_object('itemId', (select id from public.fridge_items where user_id = '33333333-3333-3333-3333-333333333333'), 'delta', -250, 'reason', 'cook'))::text)),
  '{"available": 200, "requested": 250, "shortBy": 50}'::jsonb,
  'insufficient stock reports the exact locked amounts');

-- ---- edit_fridge_item
create function pg_temp.kale() returns text language sql as $$
  select id from public.fridge_items where user_id = '33333333-3333-3333-3333-333333333333' limit 1 $$;

select is((public.edit_fridge_item('33333333-3333-3333-3333-333333333333', pg_temp.kale(), 'man:e1', 200, p_qty => 150)->>'qty')::numeric, 150::numeric,
  'an edit with the expected quantity is applied');
select is((select delta from public.inventory_events where user_id = '33333333-3333-3333-3333-333333333333' and batch_key = 'man:e1'), -50::numeric,
  'the edit is recorded in the ledger as a delta');
select throws_like(format($f$ select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', %L, 'man:e2', 200, p_qty => 100) $f$, pg_temp.kale()),
  'stale_quantity:%', 'an edit based on an old quantity is refused');
select is(pg_temp.err_detail(format($f$ select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', %L, 'man:e2b', 200, p_qty => 100) $f$, pg_temp.kale())),
  '{"expected": 200, "actual": 150}'::jsonb, 'a stale edit reports what the user saw and what is there now');
select is((select qty from public.fridge_items where id = pg_temp.kale()), 150::numeric, 'a refused edit changes nothing');

select is((public.edit_fridge_item('33333333-3333-3333-3333-333333333333', pg_temp.kale(), 'man:e1', 200, p_qty => 150)->>'replayed')::boolean, true,
  'the same key replays the first result');
select is((select count(*)::int from public.inventory_events where user_id = '33333333-3333-3333-3333-333333333333' and batch_key = 'man:e1'), 1,
  'a replay writes no second ledger event');

select throws_like(format($f$ select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', %L, 'man:neg', 150, p_qty => -1) $f$, pg_temp.kale()),
  'invalid_quantity:%', 'a negative quantity is refused');
select throws_ok(format($f$ select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', %L, 'edt:noexp', null, p_qty => 1) $f$, pg_temp.kale()),
  '22023', 'invalid_edit:expected_qty_required', 'an edit without the quantity the user saw is refused');
select throws_ok(format($f$ select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', %L, 'edt:badloc', 150, p_location => 'garage') $f$, pg_temp.kale()),
  '22023', 'invalid_edit:location', 'an unknown location is a bad request, not a constraint error');
select throws_ok($$ select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', 'itm_other', 'man:add1', 150, p_qty => 1) $$,
  '22023', 'invalid_edit:key_reused', 'a key already used for another change is refused, not replayed');

-- move to the freezer with a recomputed date (stored date came from the table)
select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', pg_temp.kale(), 'man:move1', 150,
  p_location => 'freezer', p_expires_on => '2027-06-17', p_expiry_source => 'table');
select is((select location || ' ' || expires_on || ' ' || expiry_source from public.fridge_items where id = pg_temp.kale()),
  'freezer 2027-06-17 table', 'a move updates location and the recomputed date');
select is((select reason from public.inventory_events where user_id = '33333333-3333-3333-3333-333333333333' and batch_key = 'man:move1'), 'move',
  'a move is recorded in the ledger');

-- a user-set date survives a later move unless the user sets it again
select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', pg_temp.kale(), 'man:date1', 150, p_expires_on => '2026-12-01', p_expiry_source => 'user');
select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', pg_temp.kale(), 'man:move2', 150,
  p_location => 'fridge', p_expires_on => '2026-10-30', p_expiry_source => 'table');
select is((select location || ' ' || expires_on || ' ' || expiry_source from public.fridge_items where id = pg_temp.kale()),
  'fridge 2026-12-01 user', 'a user-set date is kept when the item moves');

-- mark used / tossed, atomically, with the expected quantity
select is((public.edit_fridge_item('33333333-3333-3333-3333-333333333333', pg_temp.kale(), 'man:used', 150, p_status => 'used')->>'status'), 'used',
  'mark used sets the item to used');
select is((select qty from public.fridge_items where id = pg_temp.kale()), 0::numeric, 'mark used takes the quantity to zero');
select is((select delta || ' ' || reason from public.inventory_events where user_id = '33333333-3333-3333-3333-333333333333' and batch_key = 'man:used'),
  '-150 adjust', 'mark used is one ledger event for the whole remaining amount');

select public.apply_inventory_batch('33333333-3333-3333-3333-333333333333', 'man:add2',
  '[{"itemId":null,"delta":100,"reason":"purchase","newItem":{"kind":"generic","ingredientId":null,"recipeId":null,"name":"Hummus","category":"produce","qty":100,"unit":"g","location":"fridge","expiresOn":null,"expirySource":"category","origin":"manual"}}]'::jsonb,
  '2026-10-20'::date);
select is((public.edit_fridge_item('33333333-3333-3333-3333-333333333333',
  (select id from public.fridge_items where user_id = '33333333-3333-3333-3333-333333333333' and name = 'Hummus'), 'man:toss', 100, p_status => 'tossed')->>'status'),
  'tossed', 'toss sets the item to tossed');

-- ownership and access
select throws_like(format($f$ select public.edit_fridge_item('44444444-4444-4444-4444-444444444444', %L, 'man:steal', 0, p_qty => 999) $f$, pg_temp.kale()),
  'item_not_found:%', 'another user cannot edit the item');
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok($$ select public.edit_fridge_item('33333333-3333-3333-3333-333333333333', 'itm_x', 'man:direct', 0, p_qty => 1) $$,
  '42501', null, 'a user cannot call the edit function directly');
reset role;
select is((select count(*)::int from public.inventory_events where batch_key = 'man:steal'), 0, 'a refused edit by another user writes nothing');
select ok(true, 'suite reached the end');

select * from finish();
rollback;
