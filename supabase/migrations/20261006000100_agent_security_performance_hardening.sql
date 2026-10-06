drop index if exists public.agent_access_keys_user_idx;
create index if not exists agent_payment_events_order_idx on public.agent_payment_events(order_id);
create index if not exists agent_payment_orders_access_key_idx on public.agent_payment_orders(access_key_id);
create index if not exists agent_payment_orders_plan_idx on public.agent_payment_orders(plan_id);
drop policy if exists agent_access_keys_deny_direct on public.agent_access_keys;create policy agent_access_keys_deny_direct on public.agent_access_keys for all to anon,authenticated using(false) with check(false);
drop policy if exists agent_usage_daily_deny_direct on public.agent_usage_daily;create policy agent_usage_daily_deny_direct on public.agent_usage_daily for all to anon,authenticated using(false) with check(false);
drop policy if exists admin_users_deny_direct on public.admin_users;create policy admin_users_deny_direct on public.admin_users for all to anon,authenticated using(false) with check(false);
drop policy if exists agent_payment_events_deny_direct on public.agent_payment_events;create policy agent_payment_events_deny_direct on public.agent_payment_events for all to anon,authenticated using(false) with check(false);
drop policy if exists agent_ai_requests_deny_direct on public.agent_ai_requests;create policy agent_ai_requests_deny_direct on public.agent_ai_requests for all to anon,authenticated using(false) with check(false);