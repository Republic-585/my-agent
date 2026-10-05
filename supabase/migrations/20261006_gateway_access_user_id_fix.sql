drop function if exists public.consume_agent_request(text,integer,integer);
create function public.consume_agent_request(p_key_hash text,p_daily_limit integer,p_monthly_limit integer)
returns table(key_id uuid,user_id uuid,plan text,expires_at timestamptz,daily_used integer,daily_limit integer,monthly_used bigint,monthly_limit integer)
language plpgsql security definer set search_path=''
as $$ declare k public.agent_access_keys%rowtype;d integer;m bigint;
begin select * into k from public.agent_access_keys where key_hash=p_key_hash and status='active' and (expires_at is null or expires_at>now()) for update;
if not found then return;end if;
select coalesce(sum(requests),0) into m from public.agent_usage_daily where key_id=k.id and usage_date>=date_trunc('month',current_date)::date;
if m>=least(k.monthly_limit,greatest(p_monthly_limit,1)) then return;end if;
insert into public.agent_usage_daily(key_id,usage_date,requests) values(k.id,current_date,1) on conflict(key_id,usage_date) do update set requests=public.agent_usage_daily.requests+1 returning requests into d;
if d>least(k.daily_limit,greatest(p_daily_limit,1)) then update public.agent_usage_daily set requests=requests-1 where key_id=k.id and usage_date=current_date;return;end if;
update public.agent_access_keys set last_used_at=now() where id=k.id;
select coalesce(sum(requests),0) into m from public.agent_usage_daily where key_id=k.id and usage_date>=date_trunc('month',current_date)::date;
return query select k.id,k.user_id,k.plan,k.expires_at,d,k.daily_limit,m,k.monthly_limit;end $$;
revoke execute on function public.consume_agent_request(text,integer,integer) from public,anon,authenticated;grant execute on function public.consume_agent_request(text,integer,integer) to service_role;