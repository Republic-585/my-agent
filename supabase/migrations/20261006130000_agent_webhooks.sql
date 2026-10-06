create table if not exists public.agent_webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  secret_hash text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.agent_webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.agent_webhooks(id) on delete cascade,
  method text not null,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb,
  received_at timestamptz not null default now(),
  status text not null default 'received',
  error_code text
);
alter table public.agent_webhooks enable row level security;
alter table public.agent_webhook_events enable row level security;
create policy "agent_webhooks_owner" on public.agent_webhooks for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "agent_webhook_events_owner" on public.agent_webhook_events for select to authenticated using (exists(select 1 from public.agent_webhooks w where w.id=webhook_id and w.user_id=(select auth.uid())));
create index if not exists agent_webhooks_user_idx on public.agent_webhooks(user_id);
create index if not exists agent_webhook_events_webhook_time_idx on public.agent_webhook_events(webhook_id,received_at desc);
