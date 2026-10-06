-- Fix ambiguous output-column references in consume_agent_request.
create or replace function public.consume_agent_request(p_key_hash text,p_daily_limit integer,p_monthly_limit integer)
returns table(key_id uuid,user_id uuid,plan text,expires_at timestamptz,daily_used integer,daily_limit integer,monthly_used bigint,monthly_limit integer)
language plpgsql security definer set search_path=''
as $function$
declare
  k public.agent_access_keys%rowtype;
  d integer;
  m bigint;
begin
  select * into k from public.agent_access_keys
  where public.agent_access_keys.key_hash=p_key_hash
    and public.agent_access_keys.status='active'
    and (public.agent_access_keys.expires_at is null or public.agent_access_keys.expires_at>now())
  for update;

  if not found then return; end if;

  select coalesce(sum(aud.requests),0) into m
  from public.agent_usage_daily aud
  where aud.key_id=k.id
    and aud.usage_date>=date_trunc('month',current_date)::date;

  if m>=least(k.monthly_limit,greatest(p_monthly_limit,1)) then return; end if;

  insert into public.agent_usage_daily as aud(key_id,usage_date,requests)
  values(k.id,current_date,1)
  on conflict on constraint agent_usage_daily_pkey
  do update set requests=aud.requests+1
  returning aud.requests into d;

  if d>least(k.daily_limit,greatest(p_daily_limit,1)) then
    update public.agent_usage_daily as u
    set requests=u.requests-1
    where u.key_id=k.id and u.usage_date=current_date;
    return;
  end if;

  update public.agent_access_keys as ak
  set last_used_at=now()
  where ak.id=k.id;

  select coalesce(sum(aud.requests),0) into m
  from public.agent_usage_daily aud
  where aud.key_id=k.id
    and aud.usage_date>=date_trunc('month',current_date)::date;

  return query
  select k.id,k.user_id,k.plan,k.expires_at,d,k.daily_limit,m,k.monthly_limit;
end
$function$;