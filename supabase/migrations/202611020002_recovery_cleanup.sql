begin;
alter table public.eureka_operations add column pending_result jsonb;
alter table public.eureka_operations add column storage_released_at timestamptz;
create table public.eureka_operation_archive (like public.eureka_operations including defaults);
alter table public.eureka_operation_archive add primary key(id);
alter table public.eureka_operation_archive enable row level security;
revoke all on public.eureka_operation_archive from public,anon,authenticated;
grant all on public.eureka_operation_archive to service_role;
create index eureka_archive_quota on public.eureka_operation_archive(model,started_at);

create function public.eureka_checkpoint(p_user uuid,p_episode uuid,p_operation uuid,p_result jsonb)
returns void language plpgsql set search_path='' as $$
declare e public.eureka_episodes; o public.eureka_operations;
begin
 select * into e from public.eureka_episodes where id=p_episode and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select * into o from public.eureka_operations where id=p_operation and episode_id=e.id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if o.status<>'running' then raise exception 'INVALID_STATE'; end if;
 if p_result is null then raise exception 'INVALID_INPUT'; end if;
 if o.pending_result is not null and o.pending_result<>p_result then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 if o.stage='script' and p_result->>'auditStatus' is distinct from 'approved' then raise exception 'INVALID_INPUT'; end if;
 if o.stage='audio' and (p_result->>'scriptHash' is distinct from e.script->>'contentHash' or
   coalesce((p_result->>'durationSeconds')::numeric,0)<=0 or (p_result->>'durationSeconds')::numeric>180 or
   p_result->>'storagePath' is distinct from p_user::text||'/'||p_episode::text||'/'||(e.script->>'contentHash')||'.wav') then raise exception 'INVALID_INPUT'; end if;
 update public.eureka_operations set pending_result=p_result where id=o.id;
end $$;

-- Only the backend calls this after validating a stored result/file. Never generates AI.
create function public.eureka_recover_result(p_user uuid,p_episode uuid,p_operation uuid)
returns jsonb language plpgsql set search_path='' as $$
declare e public.eureka_episodes; o public.eureka_operations;
begin
 select * into e from public.eureka_episodes where id=p_episode and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select * into o from public.eureka_operations where id=p_operation and episode_id=e.id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if o.status='complete' then return to_jsonb(e); end if;
 if o.status='running' and o.lease_until>now() then raise exception 'OPERATION_IN_PROGRESS'; end if;
 if o.pending_result is null or o.storage_released_at is not null then raise exception 'PROVIDER_OUTCOME_UNKNOWN'; end if;
 if o.stage='audio' and (o.pending_result->>'expiresAt')::timestamptz<=now() then raise exception 'AUDIO_EXPIRED'; end if;
 update public.eureka_operations set status='running' where id=o.id;
 return public.eureka_finish_operation(p_user,p_episode,p_operation,o.pending_result,null);
end $$;

-- One explicit corrective retry, only for determinate errors with no recoverable result.
create function public.eureka_prepare_retry(p_user uuid,p_episode uuid,p_stage text)
returns jsonb language plpgsql set search_path='' as $$
declare e public.eureka_episodes; o public.eureka_operations;
begin
 select * into e from public.eureka_episodes where id=p_episode and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select * into o from public.eureka_operations where episode_id=e.id and stage=p_stage for update;
 if not found then return to_jsonb(e); end if;
 if o.status<>'failed' or o.pending_result is not null or o.error_code not in ('SCRIPT_REJECTED','AUDIO_DURATION_INVALID','QUOTA_EXHAUSTED') then raise exception 'PROVIDER_OUTCOME_UNKNOWN'; end if;
 if exists(select 1 from public.eureka_operation_archive where episode_id=e.id and stage=p_stage) then raise exception 'RETRY_LIMIT_REACHED'; end if;
 insert into public.eureka_operation_archive select * from public.eureka_operations where id=o.id;
 delete from public.eureka_operations where id=o.id;
 update public.eureka_episodes set state=case when p_stage='audio' then 'script_ready' else 'selected' end,error_code=null,updated_at=now() where id=e.id returning * into e;
 return to_jsonb(e);
end $$;

create function public.eureka_cleanup_candidates()
returns jsonb language sql set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from (
   select e.id as episode_id,e.user_id,o.id as operation_id,coalesce(e.audio,o.pending_result) as audio
   from public.eureka_episodes e join public.eureka_operations o on o.episode_id=e.id and o.stage='audio'
   where o.storage_released_at is null
     and (o.status<>'running' or o.lease_until<now())
     and (coalesce(e.audio,o.pending_result)->>'expiresAt')::timestamptz<=now()
   order by o.started_at limit 20
 ) x
$$;

-- Called only after Storage confirms delete. Never delete storage.objects with SQL.
create function public.eureka_mark_audio_deleted(p_episode uuid,p_operation uuid,p_path text)
returns void language plpgsql set search_path='' as $$
declare e public.eureka_episodes; o public.eureka_operations; a jsonb;
begin
 select * into e from public.eureka_episodes where id=p_episode for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select * into o from public.eureka_operations where id=p_operation and episode_id=e.id and stage='audio' for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if o.storage_released_at is not null then return; end if;
 a:=coalesce(e.audio,o.pending_result);
 if a is null or a->>'storagePath' is distinct from p_path or (a->>'expiresAt')::timestamptz>now() or (o.status='running' and o.lease_until>now()) then raise exception 'INVALID_STATE'; end if;
 update public.eureka_operations set storage_released_at=now(),status=case when status='complete' then status else 'failed' end,error_code=case when status='complete' then error_code else 'AUDIO_EXPIRED' end where id=o.id;
 if e.audio is not null then update public.eureka_episodes set audio=audio||jsonb_build_object('deletedAt',now(),'byteLength',0),updated_at=now() where id=e.id;
 else update public.eureka_episodes set state='failed',error_code='AUDIO_EXPIRED',updated_at=now() where id=e.id; end if;
end $$;

revoke all on function public.eureka_checkpoint(uuid,uuid,uuid,jsonb),public.eureka_recover_result(uuid,uuid,uuid),public.eureka_prepare_retry(uuid,uuid,text),public.eureka_cleanup_candidates(),public.eureka_mark_audio_deleted(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.eureka_checkpoint(uuid,uuid,uuid,jsonb),public.eureka_recover_result(uuid,uuid,uuid),public.eureka_prepare_retry(uuid,uuid,text),public.eureka_cleanup_candidates(),public.eureka_mark_audio_deleted(uuid,uuid,text) to service_role;

-- Confirmed by Paulo: text RPD 500; dashboard earlier showed text RPM 15,
-- voice RPD 10 / RPM 3. Internal budgets retain headroom; generation stays OFF.
update public.eureka_model_budgets set daily_limit=100,minute_limit=10 where model='gemini-3.1-flash-lite';
update public.eureka_model_budgets set daily_limit=8,minute_limit=2 where model='gemini-3.1-flash-tts-preview';

-- Updated begin_operation appended below before COMMIT.

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
    into day_used,minute_used from (select model,reserved_calls,started_at from public.eureka_operations union all select model,reserved_calls,started_at from public.eureka_operation_archive) reservations where model = p_model and started_at > now() - interval '24 hours';
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
