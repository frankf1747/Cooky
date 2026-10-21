-- Run: npx supabase test db
-- A user with no profile row yet (before onboarding) gets added_on in the profile's default timezone,
-- the same zone the app uses for "today", not the database server's UTC date.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'no-profile@test.local');
insert into public.category_defaults (category, shelf_life_days, source) values ('produce', '{"fridge":5}', 'test') on conflict do nothing;

-- Point the default at a zone whose date differs from the server's right now (UTC+14 or UTC-11 always does).
create temp table tz as select case when (now() at time zone 'Pacific/Kiritimati')::date <> current_date
  then 'Pacific/Kiritimati' else 'Pacific/Pago_Pago' end as name;
do $$ begin execute format('alter table public.profiles alter column timezone set default %L', (select name from tz)); end $$;

select public.apply_inventory_batch('55555555-5555-5555-5555-555555555555', 'man:noprofile',
  '[{"itemId":null,"delta":1,"reason":"purchase","newItem":{"kind":"generic","ingredientId":null,"recipeId":null,"name":"Limes","category":"produce","qty":1,"unit":"count","location":"fridge","expiresOn":null,"expirySource":"category","origin":"manual"}}]'::jsonb);
select is((select added_on from public.fridge_items where user_id = '55555555-5555-5555-5555-555555555555'),
  (now() at time zone (select name from tz))::date, 'without a profile, added_on is today in the default profile timezone');
select is((select count(*)::int from public.profiles where user_id = '55555555-5555-5555-5555-555555555555'), 0,
  'adding to the fridge does not create a profile');

select * from finish();
rollback;
