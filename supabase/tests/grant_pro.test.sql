-- Run: npx supabase test db
-- Pro is granted only by the Stripe webhook, through grant_pro(): order and entitlement in one
-- transaction, keyed by Stripe event id and session id, so a retry never grants twice (SPEC ACC6).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'buyer@test.local');

select is(public.grant_pro('66666666-6666-6666-6666-666666666666', 'cs_test_1', 'evt_1', 'checkout.session.completed', 499, 'usd'),
  'granted', 'a paid checkout grants Pro');
select is((select plan from public.entitlements where user_id = '66666666-6666-6666-6666-666666666666'), 'pro', 'the user is Pro');
select is((select amount_cents || ' ' || currency || ' ' || status from public.orders where stripe_session_id = 'cs_test_1'), '499 usd paid',
  'the order records amount, currency and status');
select is((select outcome from public.payment_events where stripe_event_id = 'evt_1'), 'granted', 'the event is recorded');

select is(public.grant_pro('66666666-6666-6666-6666-666666666666', 'cs_test_1', 'evt_1', 'checkout.session.completed', 499, 'usd'),
  'duplicate_event', 'the same event again changes nothing');
select is(public.grant_pro('66666666-6666-6666-6666-666666666666', 'cs_test_1', 'evt_2', 'checkout.session.async_payment_succeeded', 499, 'usd'),
  'duplicate_session', 'a second event for the same session grants nothing more');
select is((select count(*)::int from public.orders where user_id = '66666666-6666-6666-6666-666666666666'), 1, 'still one order');
select is((select count(*)::int from public.payment_events where stripe_event_id in ('evt_1', 'evt_2')), 2, 'both events are recorded');

set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select throws_ok($$ select public.grant_pro('66666666-6666-6666-6666-666666666666', 'cs_x', 'evt_x', 'checkout.session.completed', 499, 'usd') $$,
  '42501', null, 'a user cannot grant themselves Pro');
reset role;
select is((select count(*)::int from public.orders where stripe_session_id = 'cs_x'), 0, 'nothing was written');

select * from finish();
rollback;
