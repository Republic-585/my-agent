alter table public.agent_tools
  add column if not exists category text not null default 'system',
  add column if not exists risk text not null default 'low',
  add column if not exists requires_confirmation boolean not null default false;

alter table public.agent_tools
  drop constraint if exists agent_tools_category_check;
alter table public.agent_tools
  add constraint agent_tools_category_check
  check (category in ('system','data','communication','integration','development'));

alter table public.agent_tools
  drop constraint if exists agent_tools_risk_check;
alter table public.agent_tools
  add constraint agent_tools_risk_check
  check (risk in ('low','medium','high'));

insert into public.agent_tools(name,description,input_schema,server_only,enabled,category,risk,requires_confirmation)
values
('get_time','Текущая дата и время сервера','{"type":"object","properties":{}}'::jsonb,true,true,'system','low',false),
('calculator','Безопасный калькулятор арифметических выражений','{"type":"object","properties":{"expression":{"type":"string"}},"required":["expression"]}'::jsonb,true,true,'system','low',false),
('weather','Текущая погода по городу','{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}'::jsonb,true,true,'system','low',false),
('wikipedia','Краткая справка из Википедии','{"type":"object","properties":{"query":{"type":"string"},"lang":{"type":"string"}},"required":["query"]}'::jsonb,true,true,'system','low',false),
('supabase','Работа с бизнес-данными Supabase через серверные полномочия','{"type":"object","properties":{"action":{"type":"string"},"table":{"type":"string"},"query":{"type":"string"},"body":{"type":"object"}},"required":["action"]}'::jsonb,true,true,'data','medium',false),
('github','Работа с GitHub через серверный токен без удаления файлов','{"type":"object","properties":{"action":{"type":"string"},"repo":{"type":"string"},"path":{"type":"string"},"content":{"type":"string"},"sha":{"type":"string"}},"required":["action"]}'::jsonb,true,true,'development','high',true),
('telegram','Вызов Telegram Bot API через серверный токен','{"type":"object","properties":{"method":{"type":"string"},"params":{"type":"object"}},"required":["method"]}'::jsonb,true,true,'communication','medium',false)
on conflict(name) do update set
  description=excluded.description,
  input_schema=excluded.input_schema,
  server_only=excluded.server_only,
  category=excluded.category,
  risk=excluded.risk,
  requires_confirmation=excluded.requires_confirmation,
  updated_at=now();

create index if not exists agent_tools_enabled_category_idx
  on public.agent_tools(enabled,category);
-- Registry metadata is deployed through CI.
