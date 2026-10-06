alter table public.agent_webhooks add column if not exists connection_id uuid references public.agent_connections(id) on delete cascade;
create index if not exists idx_agent_webhooks_connection_id on public.agent_webhooks(connection_id);
alter table public.agent_events add column if not exists source_event_id uuid references public.agent_webhook_events(id) on delete set null;
create unique index if not exists uq_agent_events_connection_external on public.agent_events(connection_id, external_event_id) where external_event_id is not null;
