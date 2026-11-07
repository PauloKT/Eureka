begin;

create table public.eureka_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_id text not null check (theme_id in ('space','health','brain','technology','nature','physics')),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 0 and 3),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table public.eureka_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  selection_set_id uuid not null references public.eureka_selections(id),
  discovery_id uuid not null,
  theme_id text not null,
  discovery jsonb not null,
  create_key text not null,
  request_hash text not null,
  state text not null default 'selected' check (state in ('selected','script_generating','script_ready','audio_generating','ready','failed')),
  script jsonb,
  audio jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, create_key)
);

create table public.eureka_operations (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.eureka_episodes(id) on delete cascade,
  stage text not null check (stage in ('script','audio')),
  request_key text not null,
  model text not null,
  reserved_calls integer not null check (reserved_calls > 0),
  status text not null default 'running' check (status in ('running','complete','failed')),
  started_at timestamptz not null default now(),
  lease_until timestamptz not null default now() + interval '5 minutes',
  error_code text,
  unique(episode_id, stage)
);

-- App budgets, not provider guarantees. Zero means generation blocked.
-- Rolling 24-hour / 60-second limits are deliberately conservative.
create table public.eureka_model_budgets (
  model text primary key,
  daily_limit integer not null default 0 check (daily_limit >= 0),
  minute_limit integer not null default 0 check (minute_limit >= 0)
);
insert into public.eureka_model_budgets(model) values ('gemini-3.1-flash-lite'), ('gemini-3.1-flash-tts-preview');
create index eureka_operations_quota on public.eureka_operations(model, started_at);

create table public.eureka_history (
  episode_id uuid primary key references public.eureka_episodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  discovery_id uuid not null,
  study_key text not null,
  topic_key text not null,
  completed_at timestamptz not null default now()
);
create index eureka_history_owner on public.eureka_history(user_id, completed_at desc, episode_id desc);

alter table public.eureka_selections enable row level security;
alter table public.eureka_episodes enable row level security;
alter table public.eureka_operations enable row level security;
alter table public.eureka_model_budgets enable row level security;
alter table public.eureka_history enable row level security;
-- No direct client table grants: API returns only safe projections.
revoke all on public.eureka_selections, public.eureka_episodes, public.eureka_operations, public.eureka_model_budgets, public.eureka_history from anon, authenticated;
grant all on public.eureka_selections, public.eureka_episodes, public.eureka_operations, public.eureka_model_budgets, public.eureka_history to service_role;

create function public.eureka_create_episode(p_user uuid, p_selection uuid, p_discovery uuid, p_mode text, p_key text, p_hash text)
returns jsonb language plpgsql set search_path = '' as $$
declare s public.eureka_selections; e public.eureka_episodes; chosen jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_key, 0));
  select * into e from public.eureka_episodes where user_id = p_user and create_key = p_key;
  if found then
    if e.request_hash <> p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(e);
  end if;
  select * into s from public.eureka_selections where id = p_selection and user_id = p_user;
  if not found then raise exception 'NOT_FOUND'; end if;
  if s.expires_at <= now() then raise exception 'SELECTION_EXPIRED'; end if;
  if p_mode = 'surprise' and p_discovery is null then
    select value into chosen from jsonb_array_elements(s.options) order by random() limit 1;
  elsif p_mode = 'chosen' and p_discovery is not null then
    select value into chosen from jsonb_array_elements(s.options) where value->>'id' = p_discovery::text limit 1;
  else raise exception 'INVALID_INPUT'; end if;
  if chosen is null then raise exception 'INVALID_INPUT'; end if;
  insert into public.eureka_episodes(user_id, selection_set_id, discovery_id, theme_id, discovery, create_key, request_hash)
    values(p_user,s.id,(chosen->>'id')::uuid,s.theme_id,chosen,p_key,p_hash) returning * into e;
  return to_jsonb(e);
end $$;

create function public.eureka_begin_operation(p_user uuid, p_episode uuid, p_stage text, p_key text, p_model text)
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
  if p_stage = 'script' and e.state = 'selected' then calls := 2;
  elsif p_stage = 'audio' and e.state = 'script_ready' and e.script->>'auditStatus' = 'approved' then calls := 1;
  else raise exception 'INVALID_STATE'; end if;
  select * into b from public.eureka_model_budgets where model = p_model for update;
  if not found then raise exception 'QUOTA_EXHAUSTED'; end if;
  select coalesce(sum(reserved_calls),0), coalesce(sum(reserved_calls) filter (where started_at > now() - interval '60 seconds'),0)
    into day_used,minute_used from public.eureka_operations where model = p_model and started_at > now() - interval '24 hours';
  if day_used + calls > b.daily_limit or minute_used + calls > b.minute_limit then raise exception 'QUOTA_EXHAUSTED'; end if;
  if p_stage = 'audio' then
    perform pg_advisory_xact_lock(89112344);
    select coalesce(sum((audio->>'byteLength')::bigint),0) into stored_bytes from public.eureka_episodes where audio is not null;
    -- Failed/unknown uploads retain their storage reservation until explicitly reconciled.
    select count(*) into pending_audio from public.eureka_operations where stage = 'audio' and status <> 'complete';
    if stored_bytes + (pending_audio + 1)::bigint * 20000000 > 800000000 then raise exception 'STORAGE_LIMIT_REACHED'; end if;
  end if;
  insert into public.eureka_operations(episode_id,stage,request_key,model,reserved_calls)
    values(e.id,p_stage,p_key,p_model,calls) returning * into o;
  update public.eureka_episodes set state = case when p_stage = 'script' then 'script_generating' else 'audio_generating' end, updated_at = now() where id = e.id;
  return jsonb_build_object('complete',false,'operationId',o.id,'episode',to_jsonb(e));
end $$;

create function public.eureka_finish_operation(p_user uuid, p_episode uuid, p_operation uuid, p_result jsonb, p_error text)
returns jsonb language plpgsql set search_path = '' as $$
declare e public.eureka_episodes; o public.eureka_operations;
begin
  select * into e from public.eureka_episodes where id = p_episode and user_id = p_user for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into o from public.eureka_operations where id = p_operation and episode_id = e.id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status = 'complete' then return to_jsonb(e); end if;
  if o.status <> 'running' then raise exception 'INVALID_STATE'; end if;
  if p_error is null and (p_result is null or (o.stage = 'script' and p_result->>'auditStatus' is distinct from 'approved')) then raise exception 'INVALID_INPUT'; end if;
  if p_error is null and o.stage = 'audio' and (
    coalesce((p_result->>'durationSeconds')::numeric,0) <= 0 or
    (p_result->>'durationSeconds')::numeric > 180 or
    p_result->>'scriptHash' is distinct from e.script->>'contentHash'
  ) then raise exception 'INVALID_INPUT'; end if;
  update public.eureka_operations set status = case when p_error is null then 'complete' else 'failed' end, error_code = p_error where id = o.id;
  update public.eureka_episodes set
    state = case when p_error is not null then 'failed' when o.stage = 'script' then 'script_ready' else 'ready' end,
    script = case when p_error is null and o.stage = 'script' then p_result else script end,
    audio = case when p_error is null and o.stage = 'audio' then p_result else audio end,
    error_code = p_error, updated_at = now()
    where id = e.id returning * into e;
  return to_jsonb(e);
end $$;

create function public.eureka_complete_episode(p_user uuid, p_episode uuid)
returns void language plpgsql set search_path = '' as $$
declare e public.eureka_episodes;
begin
  select * into e from public.eureka_episodes where id = p_episode and user_id = p_user;
  if not found then raise exception 'NOT_FOUND'; end if;
  if e.state <> 'ready' then raise exception 'INVALID_STATE'; end if;
  insert into public.eureka_history(episode_id,user_id,discovery_id,study_key,topic_key)
    values(e.id,p_user,e.discovery_id,e.discovery->>'studyKey',e.discovery->>'topicKey') on conflict do nothing;
end $$;

revoke all on function public.eureka_create_episode(uuid,uuid,uuid,text,text,text), public.eureka_begin_operation(uuid,uuid,text,text,text), public.eureka_finish_operation(uuid,uuid,uuid,jsonb,text), public.eureka_complete_episode(uuid,uuid) from public, anon, authenticated;
grant execute on function public.eureka_create_episode(uuid,uuid,uuid,text,text,text), public.eureka_begin_operation(uuid,uuid,text,text,text), public.eureka_finish_operation(uuid,uuid,uuid,jsonb,text), public.eureka_complete_episode(uuid,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('eureka-audio','eureka-audio',false,20000000,array['audio/wav']);
-- No client upload/read policy: the backend uploads and issues short-lived URLs.
commit;
