-- AI Gateway access schema
-- Applied to Supabase project dfvztoazthliaobqnndv.
create extension if not exists pgcrypto;

create table if not exists public.agent_access_keys (
  id uuid primary key default gen_random_uuid(),
  key_prefix text not null unique,
  key_hash text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  plan text not null default 'pro',
  status text not null default 'active' check (status in ('active','paused','revoked')),
  expires_at timestamptz,
  daily_limit integer not null default 500,
  monthly_limit integer not null default 10000,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists agent_access_keys_user_id_idx on public.agent_access_keys(user_id);
create index if not exists agent_access_keys_status_idx on public.agent_access_keys(status);

create table if not exists public.agent_usage_daily (
  key_id uuid not null references public.agent_access_keys(id) on delete cascade,
  usage_date date not null default current_date,
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (key_id, usage_date)
);

alter table public.agent_access_keys enable row level security;
alter table public.agent_usage_daily enable row level security;
revoke all on table public.agent_access_keys from anon, authenticated;
revoke all on table public.agent_usage_daily from anon, authenticated;
grant select, insert, update, delete on table public.agent_access_keys to service_role;
grant select, insert, update, delete on table public.agent_usage_daily to service_role;

create or replace function public.consume_agent_request(
  p_key_hash text,
  p_daily_limit integer,
  p_monthly_limit integer
)
returns table(key_id uuid, plan text, expires_at timestamptz, daily_used integer, daily_limit integer, monthly_used bigint, monthly_limit integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.agent_access_keys%rowtype;
  d integer;
  m bigint;
begin
  select * into k from public.agent_access_keys
  where key_hash = p_key_hash and status = 'active'
    and (expires_at is null or expires_at > now())
  for update;
  if not found then return; end if;
  select coalesce(sum(requests),0) into m from public.agent_usage_daily
  where key_id = k.id and usage_date >= date_trunc('month', current_date)::date;
  if m >= least(k.monthly_limit, greatest(p_monthly_limit,1)) then return; end if;
  insert into public.agent_usage_daily(key_id, usage_date, requests)
  values (k.id, current_date, 1)
  on conflict (key_id, usage_date)
  do update set requests = public.agent_usage_daily.requests + 1
  returning requests into d;
  if d > least(k.daily_limit, greatest(p_daily_limit,1)) then
    update public.agent_usage_daily set requests = requests - 1
    where key_id = k.id and usage_date = current_date;
    return;
  end if;
  update public.agent_access_keys set last_used_at = now() where id = k.id;
  select coalesce(sum(requests),0) into m from public.agent_usage_daily
  where key_id = k.id and usage_date >= date_trunc('month', current_date)::date;
  return query select k.id, k.plan, k.expires_at, d, k.daily_limit, m, k.monthly_limit;
end;
$$;

revoke execute on function public.consume_agent_request(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_agent_request(text,integer,integer) to service_role;
