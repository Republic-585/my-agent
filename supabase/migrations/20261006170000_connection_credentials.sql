alter table public.agent_connections add column if not exists credential_ciphertext text;
alter table public.agent_connections add column if not exists credential_iv text;
