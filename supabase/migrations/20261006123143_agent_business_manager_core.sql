create table if not exists public.agent_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  name text not null,
  status text not null default 'active' check (status in ('active','paused','error','revoked')),
  secret_ref text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_connections_user_idx on public.agent_connections(user_id,created_at desc);
alter table public.agent_connections enable row level security;
create policy "connections owner select" on public.agent_connections for select to authenticated using ((select auth.uid())=user_id);
create policy "connections owner insert" on public.agent_connections for insert to authenticated with check ((select auth.uid())=user_id);
create policy "connections owner update" on public.agent_connections for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "connections owner delete" on public.agent_connections for delete to authenticated using ((select auth.uid())=user_id);

create table if not exists public.agent_resources (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.agent_connections(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  resource_type text not null,
  external_id text not null,
  name text,
  username text,
  status text not null default 'active' check (status in ('active','inactive','error')),
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id,external_id)
);
create index if not exists agent_resources_user_idx on public.agent_resources(user_id,resource_type);
create index if not exists agent_resources_connection_idx on public.agent_resources(connection_id);
alter table public.agent_resources enable row level security;
create policy "resources owner select" on public.agent_resources for select to authenticated using ((select auth.uid())=user_id);
create policy "resources owner insert" on public.agent_resources for insert to authenticated with check ((select auth.uid())=user_id);
create policy "resources owner update" on public.agent_resources for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "resources owner delete" on public.agent_resources for delete to authenticated using ((select auth.uid())=user_id);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  connection_id uuid references public.agent_connections(id) on delete cascade,
  resource_id uuid references public.agent_resources(id) on delete set null,
  event_type text not null,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','processed','failed','ignored')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists agent_events_user_received_idx on public.agent_events(user_id,received_at desc);
create index if not exists agent_events_connection_received_idx on public.agent_events(connection_id,received_at desc);
create unique index if not exists agent_events_external_unique_idx on public.agent_events(connection_id,external_event_id) where external_event_id is not null;
alter table public.agent_events enable row level security;
create policy "events owner select" on public.agent_events for select to authenticated using ((select auth.uid())=user_id);

create table if not exists public.agent_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  action_config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_automations_user_idx on public.agent_automations(user_id,enabled);
alter table public.agent_automations enable row level security;
create policy "automations owner select" on public.agent_automations for select to authenticated using ((select auth.uid())=user_id);
create policy "automations owner insert" on public.agent_automations for insert to authenticated with check ((select auth.uid())=user_id);
create policy "automations owner update" on public.agent_automations for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "automations owner delete" on public.agent_automations for delete to authenticated using ((select auth.uid())=user_id);
