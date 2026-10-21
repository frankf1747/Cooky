-- added_on for a user with no profile row yet (before onboarding) used the server's UTC date. Fall back to the
-- profiles.timezone default instead, the zone the app already uses for "today". Same signature and grants.

create or replace function public.apply_inventory_batch(p_user uuid, p_batch_key text, p_events jsonb, p_today date default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
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
  v_tz text;
  v_result jsonb;
begin
  if v_today is null then
    select p.timezone into v_tz from profiles p where p.user_id = p_user;
    if v_tz is null then
      -- No profile row yet (before onboarding): evaluate the profiles.timezone column default, the zone the app uses.
      select pg_get_expr(d.adbin, d.adrelid) into v_tz from pg_attrdef d
        join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
       where d.adrelid = 'public.profiles'::regclass and a.attname = 'timezone';
      execute 'select ' || v_tz into v_tz;
    end if;
    v_today := (now() at time zone v_tz)::date;
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
