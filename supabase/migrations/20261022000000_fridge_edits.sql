-- Fridge transaction fixes from the Fridge handoff (SPEC FRG2, FRG4):
--   1. apply_inventory_batch stamps added_on with the user's local date (p_today, else today in the profile's
--      timezone; existing callers keep working) and reports the exact locked shortfall in the error DETAIL as JSON.
--   2. edit_fridge_item: one atomic edit of one item (quantity, used/tossed, location, date), checked against the
--      quantity the user saw, recorded in the ledger, and idempotent through inventory_batches.
-- Both are security definer and executable by service_role only; clients still have no write path.

drop function public.apply_inventory_batch(uuid, text, jsonb);

-- p_events: [{ "itemId": "itm_..." | null, "delta": number, "reason": "...", "newItem": {...} }]
-- p_today: the user's local date for new items' added_on (defaults to today in the profile's timezone).
-- A repeat with the same batch key returns the first result plus "replayed": true and writes nothing.
-- Raises 'insufficient_stock:<itemId>' (P0001, DETAIL {"available","requested","shortBy"}) if any quantity would go
-- below zero, and 'item_not_found:<itemId>' (P0002) for an unknown or foreign item; the whole batch rolls back.
create function public.apply_inventory_batch(p_user uuid, p_batch_key text, p_events jsonb, p_today date default null)
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
  v_delta numeric;
  created text[] := '{}';
  v_today date := p_today;
  v_result jsonb;
begin
  if v_today is null then
    select (now() at time zone p.timezone)::date into v_today from profiles p where p.user_id = p_user;
  end if;
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
                                added_on, expires_on, expiry_source, origin, origin_ref)
      values (v_item, p_user, n->>'kind', n->>'ingredientId', n->>'recipeId', n->>'name', n->>'category',
              (n->>'qty')::numeric, n->>'unit', n->>'location', coalesce(v_today, current_date), (n->>'expiresOn')::date,
              n->>'expirySource', n->>'origin', p_batch_key);
      created := created || v_item;
      insert into inventory_events (user_id, item_id, delta, unit, reason, ref, batch_key, seq)
      values (p_user, v_item, (n->>'qty')::numeric, n->>'unit', coalesce(ev->>'reason', 'purchase'), p_batch_key, p_batch_key, seq);
    else
      v_item := ev->>'itemId';
      v_delta := (ev->>'delta')::numeric;
      select f.qty, f.unit into v_qty, v_unit from fridge_items f where f.id = v_item and f.user_id = p_user for update;
      if not found then
        raise exception 'item_not_found:%', v_item using errcode = 'P0002';
      end if;
      if v_qty + v_delta < 0 then
        raise exception 'insufficient_stock:%', v_item using errcode = 'P0001',
          detail = jsonb_build_object('available', v_qty, 'requested', -v_delta, 'shortBy', -(v_qty + v_delta))::text;
      end if;
      v_qty := v_qty + v_delta;
      update fridge_items set
        qty = v_qty,
        status = case when v_qty = 0 then (case when ev->>'reason' = 'toss' then 'tossed' else 'used' end) else status end,
        updated_at = now()
      where id = v_item;
      insert into inventory_events (user_id, item_id, delta, unit, reason, ref, batch_key, seq)
      values (p_user, v_item, v_delta, v_unit, ev->>'reason', p_batch_key, p_batch_key, seq);
    end if;
  end loop;

  v_result := jsonb_build_object('createdItemIds', to_jsonb(created), 'events', seq);
  update inventory_batches set result = v_result where user_id = p_user and batch_key = p_batch_key;
  return v_result;
end $$;

-- Edit one fridge item atomically (SPEC FRG4). Pass only the fields being changed.
--   p_expected_qty: the quantity the user saw; any other current quantity raises 'stale_quantity:<itemId>'
--     (P0001, DETAIL {"expected","actual"}) so the route can answer 409 and the client can refresh.
--   p_qty: new absolute quantity (>= 0), recorded as an 'adjust' event of the difference.
--   p_status: 'used' or 'tossed' takes the whole remaining quantity to zero ('adjust' or 'toss' event).
--   p_location: a move, recorded as a 'move' event of zero.
--   p_expires_on + p_expiry_source: 'user' always applies; 'table' or 'category' (a date recomputed by code, e.g.
--     after a move) applies only when the stored date was not set by the user.
-- A repeat with the same key returns the first result plus "replayed": true and writes nothing.
-- Raises 'item_not_found:<itemId>' (P0002) for an unknown or foreign item, 'item_not_active:<itemId>' (P0001) for
-- an item already used or tossed, and 'invalid_edit:<reason>' (22023) for a request no client should send.
create function public.edit_fridge_item(
  p_user uuid, p_item text, p_key text, p_expected_qty numeric,
  p_qty numeric default null, p_status text default null, p_location text default null,
  p_expires_on date default null, p_expiry_source text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  prior jsonb;
  it fridge_items%rowtype;
  seq integer := 0;
  v_qty numeric;
  v_result jsonb;
begin
  if p_qty is not null and p_qty < 0 then
    raise exception 'invalid_quantity:%', p_qty using errcode = '22023';
  end if;
  if p_qty is not null and p_status is not null then
    raise exception 'invalid_edit:qty_and_status' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('used', 'tossed') then
    raise exception 'invalid_edit:status' using errcode = '22023';
  end if;
  if (p_expires_on is null) <> (p_expiry_source is null) then
    raise exception 'invalid_edit:expiry_needs_source' using errcode = '22023';
  end if;

  insert into inventory_batches (user_id, batch_key) values (p_user, p_key) on conflict do nothing;
  select b.result into prior from inventory_batches b where b.user_id = p_user and b.batch_key = p_key for update;
  if prior is not null then
    return prior || jsonb_build_object('replayed', true);
  end if;

  select * into it from fridge_items f where f.id = p_item and f.user_id = p_user for update;
  if not found then
    raise exception 'item_not_found:%', p_item using errcode = 'P0002';
  end if;
  if it.status <> 'active' then
    raise exception 'item_not_active:%', p_item using errcode = 'P0001';
  end if;
  if it.qty <> p_expected_qty then
    raise exception 'stale_quantity:%', p_item using errcode = 'P0001',
      detail = jsonb_build_object('expected', p_expected_qty, 'actual', it.qty)::text;
  end if;

  v_qty := case when p_status is not null then 0 else coalesce(p_qty, it.qty) end;
  if v_qty <> it.qty then
    seq := seq + 1;
    insert into inventory_events (user_id, item_id, delta, unit, reason, ref, batch_key, seq)
    values (p_user, p_item, v_qty - it.qty, it.unit, case when p_status = 'tossed' then 'toss' else 'adjust' end,
            p_key, p_key, seq);
  end if;
  if p_location is not null and p_location <> it.location then
    seq := seq + 1;
    insert into inventory_events (user_id, item_id, delta, unit, reason, ref, batch_key, seq)
    values (p_user, p_item, 0, it.unit, 'move', p_key, p_key, seq);
  end if;

  update fridge_items f set
    qty = v_qty,
    status = case when p_status is not null then p_status when v_qty = 0 then 'used' else f.status end,
    location = coalesce(p_location, f.location),
    expires_on = case when p_expiry_source = 'user' or (p_expires_on is not null and f.expiry_source <> 'user')
                      then p_expires_on else f.expires_on end,
    expiry_source = case when p_expiry_source = 'user' or (p_expires_on is not null and f.expiry_source <> 'user')
                         then p_expiry_source else f.expiry_source end,
    updated_at = now()
  where f.id = p_item
  returning * into it;

  v_result := jsonb_build_object('itemId', it.id, 'qty', it.qty, 'status', it.status, 'location', it.location,
    'expiresOn', it.expires_on, 'expirySource', it.expiry_source, 'events', seq);
  update inventory_batches set result = v_result where user_id = p_user and batch_key = p_key;
  return v_result;
end $$;

revoke execute on function public.apply_inventory_batch(uuid, text, jsonb, date) from public, anon, authenticated;
revoke execute on function public.edit_fridge_item(uuid, text, text, numeric, numeric, text, text, date, text)
  from public, anon, authenticated;
grant execute on function public.apply_inventory_batch(uuid, text, jsonb, date) to service_role;
grant execute on function public.edit_fridge_item(uuid, text, text, numeric, numeric, text, text, date, text)
  to service_role;
