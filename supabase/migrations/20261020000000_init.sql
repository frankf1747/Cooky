-- Cooky schema (SPEC §9). One migration set, owned by Platform.
-- Access rule: clients (publishable key + session) may only SELECT their own rows; catalog rows are
-- readable by every signed-in user. No table grants INSERT/UPDATE/DELETE to anon or authenticated.
-- All writes go through server code with the secret key (src/platform/db.ts writer()).

create extension if not exists pg_trgm;

-- ============================================================ catalog (shared, read-only to users)

create table public.category_defaults (
  category text primary key check (category in ('produce','meat','seafood','dairy','eggs','bakery','frozen','pantry','snacks','beverages','prepared','other')),
  shelf_life_days jsonb not null,
  source text not null
);

create table public.ingredients (
  id text primary key check (id ~ '^ing_[0-9a-z_]+$'),
  owner_id uuid references auth.users(id) on delete cascade, -- null = catalog
  name text not null,
  aliases text[] not null default '{}',
  category text not null references public.category_defaults(category),
  base_unit text not null check (base_unit in ('g','ml','count')),
  allergen_tags text[] not null default '{}',
  shelf_life_days jsonb not null default '{}',
  shelf_life_source text not null default '',
  plausible_max_qty numeric check (plausible_max_qty > 0),
  created_at timestamptz not null default now()
);
create index ingredients_name_trgm on public.ingredients using gin (name gin_trgm_ops);
create index ingredients_owner on public.ingredients (owner_id);

create table public.products (
  id text primary key check (id ~ '^prd_[0-9a-z_]+$'),
  ingredient_id text not null references public.ingredients(id) on delete cascade,
  package_size numeric not null check (package_size > 0),
  unit text not null check (unit in ('g','ml','count')),
  price_cents integer not null check (price_cents >= 0),
  store_label text not null,
  region text not null,
  price_date date not null
);
create index products_ingredient on public.products (ingredient_id);

create table public.recipes (
  id text primary key check (id ~ '^rcp_[0-9a-z_]+$'),
  owner_id uuid references auth.users(id) on delete cascade, -- null = curated
  title text not null,
  base_servings integer not null check (base_servings > 0),
  minutes integer not null check (minutes > 0),
  equipment text[] not null default '{}',
  tags text[] not null default '{}',
  source_url text,
  source_label text not null,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);
create index recipes_owner on public.recipes (owner_id);

create table public.recipe_ingredients (
  recipe_id text not null references public.recipes(id) on delete cascade,
  ingredient_id text not null references public.ingredients(id),
  qty numeric not null check (qty > 0),
  unit text not null check (unit in ('g','ml','count')),
  optional boolean not null default false,
  note text,
  primary key (recipe_id, ingredient_id)
);
create index recipe_ingredients_ingredient on public.recipe_ingredients (ingredient_id);

create table public.recipe_chunks (
  id text primary key check (id ~ '^chk_[0-9a-z_]+$'),
  recipe_id text not null references public.recipes(id) on delete cascade,
  kind text not null check (kind in ('step','faq')),
  step_no integer check (step_no > 0),
  label text not null,
  text text not null,
  tsv tsvector generated always as (to_tsvector('english', label || ' ' || text)) stored
);
create index recipe_chunks_recipe on public.recipe_chunks (recipe_id);
create index recipe_chunks_tsv on public.recipe_chunks using gin (tsv);

-- ============================================================ per-user records

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_size integer not null default 2,
  budget_cents_default integer not null default 4000 check (budget_cents_default >= 0),
  max_minutes_default integer not null default 30 check (max_minutes_default > 0),
  equipment text[] not null default '{}',
  excluded_ingredient_ids text[] not null default '{}',
  allergen_tags text[] not null default '{}',
  staple_ingredient_ids text[] not null default '{}',
  timezone text not null default 'America/Los_Angeles',
  email_alerts boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.plans (
  id text primary key check (id ~ '^pln_[0-9a-z_]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('draft','saved')),
  current_version integer not null default 1,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index plans_user on public.plans (user_id, created_at desc);

create table public.plan_versions (
  id text primary key check (id ~ '^plv_[0-9a-z_]+$'),
  plan_id text not null references public.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  inputs jsonb not null,
  meals jsonb not null,
  shopping jsonb not null,
  total_cents integer not null check (total_cents >= 0),
  price_as_of date not null,
  assumptions jsonb not null default '[]',
  run_id text,
  checklist jsonb not null default '[]',
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, version)
);

create table public.receipts (
  id text primary key check (id ~ '^rct_[0-9a-z_]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('parsing','parsed','failed','confirmed')),
  plan_id text references public.plans(id) on delete set null,
  store text,
  purchased_on date,
  image_path text,
  failure_reason text,
  run_id text,
  confirm_idempotency_key text,
  confirm_result jsonb,
  created_at timestamptz not null default now()
);
create index receipts_user on public.receipts (user_id, status);

create table public.receipt_lines (
  id text primary key check (id ~ '^rln_[0-9a-z_]+$'),
  receipt_id text not null references public.receipts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  raw text not null,
  kind text not null check (kind in ('food','non_food','discount','tax','total','other')),
  ingredient_id text references public.ingredients(id),
  category text references public.category_defaults(category),
  name text not null,
  qty numeric check (qty >= 0),
  unit text check (unit in ('g','ml','count')),
  price_cents integer check (price_cents >= 0),
  confidence text not null check (confidence in ('high','medium','low')),
  decision text not null check (decision in ('auto','generic','flagged','ignored')),
  flag_reason text,
  location text check (location in ('fridge','freezer','pantry')),
  expires_on date
);
create index receipt_lines_receipt on public.receipt_lines (receipt_id, position);

create table public.fridge_items (
  id text primary key check (id ~ '^itm_[0-9a-z_]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ingredient','generic','dish')),
  ingredient_id text references public.ingredients(id),
  recipe_id text references public.recipes(id),
  name text not null,
  category text references public.category_defaults(category),
  qty numeric not null check (qty >= 0),
  unit text not null check (unit in ('g','ml','count')),
  location text not null check (location in ('fridge','freezer','pantry')),
  added_on date not null default current_date,
  expires_on date,
  expiry_source text not null check (expiry_source in ('table','category','user')),
  origin text not null check (origin in ('receipt','manual','cooked','check')),
  origin_ref text,
  status text not null default 'active' check (status in ('active','used','tossed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fridge_items_user on public.fridge_items (user_id, status, expires_on);

-- Append-only ledger. One confirmed action = one batch sharing batch_key; (user, batch_key, seq) is unique.
create table public.inventory_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.fridge_items(id) on delete cascade,
  delta numeric not null,
  unit text not null check (unit in ('g','ml','count')),
  reason text not null check (reason in ('purchase','cook','toss','adjust','move')),
  ref text,
  batch_key text not null,
  seq integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, batch_key, seq)
);

create table public.inventory_batches (
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_key text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, batch_key)
);

create table public.cook_events (
  id text primary key check (id ~ '^cke_[0-9a-z_]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null references public.recipes(id),
  plan_id text references public.plans(id) on delete set null,
  servings integer not null check (servings > 0),
  status text not null check (status in ('proposed','confirmed')),
  proposal jsonb not null,
  confirm_result jsonb,
  rating integer check (rating between 1 and 5),
  feedback text,
  created_at timestamptz not null default now()
);
create index cook_events_user on public.cook_events (user_id, created_at desc);

create table public.cook_sessions (
  id text primary key check (id ~ '^cks_[0-9a-z_]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null references public.recipes(id),
  created_at timestamptz not null default now()
);

create table public.cook_messages (
  id bigint generated always as identity primary key,
  session_id text not null references public.cook_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  text text not null,
  citations jsonb not null default '[]',
  run_id text,
  created_at timestamptz not null default now()
);
create index cook_messages_session on public.cook_messages (session_id, id);

create table public.preferences (
  id text primary key check (id ~ '^prf_[0-9a-z_]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('hard','soft')),
  category text not null check (category in ('texture','flavor','effort','cleanup','ingredient','cuisine')),
  value text not null,
  scope_recipe_id text references public.recipes(id) on delete set null,
  source_request_id text,
  confirmed_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index preferences_user on public.preferences (user_id, active);

create table public.preference_proposals (
  id text primary key check (id ~ '^prp_[0-9a-z_]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('hard','soft')),
  category text not null check (category in ('texture','flavor','effort','cleanup','ingredient','cuisine')),
  value text not null,
  reason text not null,
  scope_recipe_id text references public.recipes(id) on delete set null,
  source text not null,
  status text not null default 'pending' check (status in ('pending','accepted','once','dismissed')),
  created_at timestamptz not null default now()
);

create table public.alerts (
  id text primary key check (id ~ '^alr_[0-9a-z_]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.fridge_items(id) on delete cascade,
  expires_on date not null,
  action jsonb not null,
  created_on date not null default current_date,
  emailed_at timestamptz,
  dismissed_at timestamptz,
  unique (item_id, expires_on)
);

-- ============================================================ billing (written only by the webhook)

create table public.orders (
  id text primary key check (id ~ '^ord_[0-9a-z_]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique,
  amount_cents integer not null,
  currency text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table public.payment_events (
  stripe_event_id text primary key,
  type text not null,
  outcome text not null,
  processed_at timestamptz not null default now()
);

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free','pro')),
  granted_at timestamptz not null default now(),
  order_id text references public.orders(id)
);

-- ============================================================ operations

create table public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  period text not null, -- 'lifetime' or a local date YYYY-MM-DD
  count integer not null default 0,
  primary key (user_id, feature, period)
);

create table public.runs (
  id text primary key check (id ~ '^run_[0-9a-z_]+$'),
  user_id uuid references auth.users(id) on delete cascade,
  request_id text not null,
  unit text not null,
  model text not null,
  terminated text not null check (terminated in ('done','cap','error')),
  wall_ms integer not null,
  input_tokens integer not null,
  output_tokens integer not null,
  cache_read_tokens integer not null,
  cost_usd numeric not null,
  repairs integer not null,
  steps jsonb not null,
  error text,
  created_at timestamptz not null default now()
);
create index runs_created on public.runs (created_at);
create index runs_unit on public.runs (unit, created_at);

create table public.guard_events (
  id bigint generated always as identity primary key,
  request_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  guardrail text not null,
  outcome text not null check (outcome in ('block','repair','escalate')),
  reason text not null,
  created_at timestamptz not null default now()
);
create index guard_events_guardrail on public.guard_events (guardrail, created_at);

-- ============================================================ row-level security

do $$
declare t text;
begin
  foreach t in array array[
    'category_defaults','ingredients','products','recipes','recipe_ingredients','recipe_chunks',
    'profiles','plans','plan_versions','receipts','receipt_lines','fridge_items','inventory_events',
    'inventory_batches','cook_events','cook_sessions','cook_messages','preferences','preference_proposals',
    'alerts','orders','payment_events','entitlements','usage_counters','runs','guard_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- catalog
create policy "catalog readable" on public.category_defaults for select to authenticated using (true);
create policy "catalog readable" on public.products for select to authenticated using (true);
create policy "catalog or own" on public.ingredients for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "curated or own" on public.recipes for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "via visible recipe" on public.recipe_ingredients for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and (r.owner_id is null or r.owner_id = (select auth.uid()))));
create policy "via visible recipe" on public.recipe_chunks for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and (r.owner_id is null or r.owner_id = (select auth.uid()))));

-- own rows, read only
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','plans','plan_versions','receipts','receipt_lines','fridge_items','inventory_events',
    'cook_events','cook_sessions','cook_messages','preferences','preference_proposals','alerts',
    'orders','entitlements','usage_counters'
  ] loop
    execute format('create policy "own rows" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;
-- inventory_batches, payment_events, runs, guard_events: no client policy (server only).

-- ============================================================ functions (server role only)

-- Atomic quota check-and-increment (SPEC G4). Refuses when count has reached p_limit.
create function public.consume_quota(p_user uuid, p_feature text, p_period text, p_limit integer)
returns table (used integer, allowed boolean)
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  insert into usage_counters (user_id, feature, period, count) values (p_user, p_feature, p_period, 0)
    on conflict (user_id, feature, period) do nothing;
  update usage_counters set count = count + 1
    where user_id = p_user and feature = p_feature and period = p_period and count < p_limit
    returning count into v;
  if v is null then
    select c.count into v from usage_counters c where c.user_id = p_user and c.feature = p_feature and c.period = p_period;
    return query select v, false;
  else
    return query select v, true;
  end if;
end $$;

-- Give one use back when the work it paid for failed (an AI call that errored or hit a cap).
-- Never goes below zero, so a double release is harmless.
create function public.release_quota(p_user uuid, p_feature text, p_period text)
returns void
language sql security definer set search_path = public as $$
  update usage_counters set count = count - 1
  where user_id = p_user and feature = p_feature and period = p_period and count > 0;
$$;

-- Apply one confirmed batch of fridge changes in one transaction (SPEC FRG2).
-- p_events: [{ "itemId": "itm_..." | null, "delta": number, "reason": "...", "newItem": {...} }]
-- A repeat with the same batch key returns the first result and writes nothing.
-- Raises 'insufficient_stock:<itemId>' if any quantity would go below zero (the whole batch rolls back).
create function public.apply_inventory_batch(p_user uuid, p_batch_key text, p_events jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  prior jsonb;
  ev jsonb;
  n jsonb;
  seq integer := 0;
  v_item text;
  v_qty numeric;
  v_unit text;
  created text[] := '{}';
  v_result jsonb;
begin
  insert into inventory_batches (user_id, batch_key) values (p_user, p_batch_key) on conflict do nothing;
  select b.result into prior from inventory_batches b where b.user_id = p_user and b.batch_key = p_batch_key for update;
  if prior is not null then
    return prior || jsonb_build_object('replayed', true);
  end if;

  for ev in select * from jsonb_array_elements(p_events) loop
    seq := seq + 1;
    if ev->>'itemId' is null then
      n := ev->'newItem';
      v_item := 'itm_' || replace(gen_random_uuid()::text, '-', '');
      insert into fridge_items (id, user_id, kind, ingredient_id, recipe_id, name, category, qty, unit, location,
                                expires_on, expiry_source, origin, origin_ref)
      values (v_item, p_user, n->>'kind', n->>'ingredientId', n->>'recipeId', n->>'name', n->>'category',
              (n->>'qty')::numeric, n->>'unit', n->>'location', (n->>'expiresOn')::date,
              n->>'expirySource', n->>'origin', p_batch_key);
      created := created || v_item;
      insert into inventory_events (user_id, item_id, delta, unit, reason, ref, batch_key, seq)
      values (p_user, v_item, (n->>'qty')::numeric, n->>'unit', coalesce(ev->>'reason', 'purchase'), p_batch_key, p_batch_key, seq);
    else
      v_item := ev->>'itemId';
      select f.qty, f.unit into v_qty, v_unit from fridge_items f where f.id = v_item and f.user_id = p_user for update;
      if not found then
        raise exception 'item_not_found:%', v_item using errcode = 'P0002';
      end if;
      v_qty := v_qty + (ev->>'delta')::numeric;
      if v_qty < 0 then
        raise exception 'insufficient_stock:%', v_item using errcode = 'P0001';
      end if;
      update fridge_items set
        qty = v_qty,
        status = case when v_qty = 0 then (case when ev->>'reason' = 'toss' then 'tossed' else 'used' end) else status end,
        updated_at = now()
      where id = v_item;
      insert into inventory_events (user_id, item_id, delta, unit, reason, ref, batch_key, seq)
      values (p_user, v_item, (ev->>'delta')::numeric, v_unit, ev->>'reason', p_batch_key, p_batch_key, seq);
    end if;
  end loop;

  v_result := jsonb_build_object('createdItemIds', to_jsonb(created), 'events', seq);
  update inventory_batches set result = v_result where user_id = p_user and batch_key = p_batch_key;
  return v_result;
end $$;

revoke execute on function public.consume_quota(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.apply_inventory_batch(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.release_quota(uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_quota(uuid, text, text, integer) to service_role;
grant execute on function public.apply_inventory_batch(uuid, text, jsonb) to service_role;
grant execute on function public.release_quota(uuid, text, text) to service_role;

-- ============================================================ storage

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
create policy "own receipt images" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
