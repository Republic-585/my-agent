create table if not exists public.agent_telegram_chats (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.agent_webhooks(id) on delete cascade,
  chat_id text not null,
  chat_type text,
  username text,
  first_name text,
  last_name text,
  last_message_text text,
  last_seen_at timestamptz not null default now(),
  unique(webhook_id, chat_id)
);
alter table public.agent_telegram_chats enable row level security;
create index if not exists agent_telegram_chats_webhook_seen_idx on public.agent_telegram_chats(webhook_id,last_seen_at desc);
create policy "telegram chats owner select" on public.agent_telegram_chats for select to authenticated using ((select auth.uid()) = (select user_id from public.agent_webhooks w where w.id=webhook_id));
create policy "telegram chats owner insert" on public.agent_telegram_chats for insert to authenticated with check ((select auth.uid()) = (select user_id from public.agent_webhooks w where w.id=webhook_id));