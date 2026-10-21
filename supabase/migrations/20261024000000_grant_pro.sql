-- Pro is granted only by the Stripe webhook (SPEC ACC6, G11). The webhook checks signature, paid
-- status, price, amount, currency and user binding in code, then calls grant_pro(), which writes the
-- event, the order and the entitlement in one transaction:
--   'granted'           first paid event for this session: order + entitlement written
--   'duplicate_event'   this Stripe event id was already processed: nothing written
--   'duplicate_session' another event for an already-granted session: event recorded, nothing granted
-- Executable by service_role only; clients still have no write path.
create function public.grant_pro(p_user uuid, p_session text, p_event text, p_type text, p_amount integer, p_currency text)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_outcome text;
begin
  insert into payment_events (stripe_event_id, type, outcome) values (p_event, p_type, 'processing')
    on conflict (stripe_event_id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;

  insert into orders (id, user_id, stripe_session_id, amount_cents, currency, status)
  values ('ord_' || replace(gen_random_uuid()::text, '-', ''), p_user, p_session, p_amount, p_currency, 'paid')
  on conflict (stripe_session_id) do nothing;
  if found then
    insert into entitlements (user_id, plan, granted_at, order_id)
    values (p_user, 'pro', now(), (select id from orders where stripe_session_id = p_session))
    on conflict (user_id) do update set plan = 'pro', granted_at = excluded.granted_at, order_id = excluded.order_id;
    v_outcome := 'granted';
  else
    v_outcome := 'duplicate_session';
  end if;

  update payment_events set outcome = v_outcome where stripe_event_id = p_event;
  return v_outcome;
end $$;

-- An event the webhook refused (unpaid, wrong price, amount, currency or user) or ignored: recorded
-- once so the reason is auditable, never granting anything.
create function public.record_payment_event(p_event text, p_type text, p_outcome text)
returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into payment_events (stripe_event_id, type, outcome) values (p_event, p_type, p_outcome)
  on conflict (stripe_event_id) do nothing;
$$;

revoke execute on function public.grant_pro(uuid, text, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.record_payment_event(text, text, text) from public, anon, authenticated;
grant execute on function public.grant_pro(uuid, text, text, text, integer, text) to service_role;
grant execute on function public.record_payment_event(text, text, text) to service_role;
