begin;

-- Public scientific evidence only. These reservations share the existing model budgets.
create table public.eureka_research_operations (
  request_key text primary key check (length(request_key) = 64),
  user_id uuid not null references auth.users(id),
  model text not null references public.eureka_model_budgets(model),
  reserved_calls integer not null default 2 check (reserved_calls = 2),
  started_at timestamptz not null default now(),
  lease_until timestamptz not null default now() + interval '5 minutes',
  status text not null default 'running' check (status in ('running','complete','failed')),
  result jsonb,
  error_code text
);
alter table public.eureka_research_operations enable row level security;
revoke all on public.eureka_research_operations from anon, authenticated;
grant all on public.eureka_research_operations to service_role;
create index eureka_research_usage on public.eureka_research_operations(model, started_at);

create view public.eureka_model_reservations as
  select model,reserved_calls,started_at from public.eureka_operations
  union all select model,reserved_calls,started_at from public.eureka_operation_archive
  union all select model,reserved_calls,started_at from public.eureka_research_operations;
revoke all on public.eureka_model_reservations from public,anon,authenticated;
grant select on public.eureka_model_reservations to service_role;

create function public.eureka_begin_research(p_user uuid, p_key text, p_model text)
returns jsonb language plpgsql set search_path = '' as $$
declare b public.eureka_model_budgets; o public.eureka_research_operations; day_used integer; minute_used integer;
begin
  -- Same row lock as episode generation: both paths reserve against one atomic total.
  select * into b from public.eureka_model_budgets where model=p_model for update;
  if not found then raise exception 'QUOTA_EXHAUSTED'; end if;
  select * into o from public.eureka_research_operations where request_key=p_key;
  if found then
    if o.status='complete' then return jsonb_build_object('complete',true,'result',o.result); end if;
    if o.status='running' and o.lease_until>now() then raise exception 'OPERATION_IN_PROGRESS'; end if;
    -- A lost response is not permission to repeat the model call.
    raise exception 'PROVIDER_OUTCOME_UNKNOWN';
  end if;
  select coalesce(sum(reserved_calls),0),coalesce(sum(reserved_calls) filter(where started_at>now()-interval '60 seconds'),0)
    into day_used,minute_used from public.eureka_model_reservations where model=p_model and started_at>now()-interval '24 hours';
  if day_used+2>b.daily_limit or minute_used+2>b.minute_limit then raise exception 'QUOTA_EXHAUSTED'; end if;
  insert into public.eureka_research_operations(request_key,user_id,model) values(p_key,p_user,p_model);
  return jsonb_build_object('complete',false);
end $$;

create function public.eureka_finish_research(p_key text,p_result jsonb,p_error text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_result is not null and (jsonb_typeof(p_result)<>'array' or jsonb_array_length(p_result)>3) then raise exception 'INVALID_INPUT'; end if;
  update public.eureka_research_operations set status=case when p_error is null then 'complete' else 'failed' end,result=p_result,error_code=p_error
    where request_key=p_key and status='running';
  if not found then raise exception 'INVALID_STATE'; end if;
end $$;
revoke all on function public.eureka_begin_research(uuid,text,text),public.eureka_finish_research(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.eureka_begin_research(uuid,text,text),public.eureka_finish_research(text,jsonb,text) to service_role;

-- Existing episode transition and storage protections remain; only quota accounting changes.

create or replace function public.eureka_begin_operation(p_user uuid, p_episode uuid, p_stage text, p_key text, p_model text)
returns jsonb language plpgsql set search_path = '' as $$
declare e public.eureka_episodes; o public.eureka_operations; b public.eureka_model_budgets;
  calls integer; day_used integer; minute_used integer; pending_audio integer; stored_bytes bigint;
begin
  select * into e from public.eureka_episodes where id = p_episode and user_id = p_user for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into o from public.eureka_operations where episode_id = e.id and stage = p_stage;
  if found then
    if o.status = 'complete' then return jsonb_build_object('complete',true,'episode',to_jsonb(e)); end if;
    if o.status = 'running' and o.lease_until > now() then raise exception 'OPERATION_IN_PROGRESS'; end if;
    -- Never automatically retry an ambiguous external call, even with a different key.
    raise exception 'PROVIDER_OUTCOME_UNKNOWN';
  end if;
  if exists(select 1 from public.eureka_operation_archive where episode_id=e.id and stage=p_stage and request_key=p_key) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if p_stage = 'script' and e.state = 'selected' then calls := 2;
  elsif p_stage = 'audio' and e.state = 'script_ready' and e.script->>'auditStatus' = 'approved' then calls := 1;
  else raise exception 'INVALID_STATE'; end if;
  select * into b from public.eureka_model_budgets where model = p_model for update;
  if not found then raise exception 'QUOTA_EXHAUSTED'; end if;
  select coalesce(sum(reserved_calls),0), coalesce(sum(reserved_calls) filter (where started_at > now() - interval '60 seconds'),0)
    into day_used,minute_used from public.eureka_model_reservations where model = p_model and started_at > now() - interval '24 hours';
  if day_used + calls > b.daily_limit or minute_used + calls > b.minute_limit then raise exception 'QUOTA_EXHAUSTED'; end if;
  if p_stage = 'audio' then
    perform pg_advisory_xact_lock(89112344);
    select coalesce(sum((audio->>'byteLength')::bigint),0) into stored_bytes from public.eureka_episodes where audio is not null;
    -- Failed/unknown uploads retain their storage reservation until explicitly reconciled.
    select count(*) into pending_audio from public.eureka_operations where stage = 'audio' and status <> 'complete' and storage_released_at is null;
    if stored_bytes + (pending_audio + 1)::bigint * 20000000 > 800000000 then raise exception 'STORAGE_LIMIT_REACHED'; end if;
  end if;
  insert into public.eureka_operations(episode_id,stage,request_key,model,reserved_calls)
    values(e.id,p_stage,p_key,p_model,calls) returning * into o;
  update public.eureka_episodes set state = case when p_stage = 'script' then 'script_generating' else 'audio_generating' end, updated_at = now() where id = e.id;
  return jsonb_build_object('complete',false,'operationId',o.id,'episode',to_jsonb(e));
end $$;



commit;
