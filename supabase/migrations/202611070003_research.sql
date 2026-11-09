begin;
create table public.eureka_research_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null
);
create table public.eureka_reviewed_discoveries (
  identifier text not null,
  theme_id text not null check (theme_id in ('space','health','brain','technology','nature','physics')),
  payload jsonb not null,
  expires_at timestamptz not null,
  primary key(identifier, theme_id),
  check (payload->'discovery'->>'themeId' = theme_id),
  check (payload->'discovery'->>'studyKey' = identifier)
);
create table public.eureka_source_slots (
  provider text primary key check (provider in ('europepmc','arxiv','openalex','nasa_ntrs')),
  next_request_at timestamptz not null
);
alter table public.eureka_research_cache enable row level security;
alter table public.eureka_reviewed_discoveries enable row level security;
alter table public.eureka_source_slots enable row level security;
revoke all on public.eureka_research_cache, public.eureka_reviewed_discoveries, public.eureka_source_slots from anon, authenticated;
grant all on public.eureka_research_cache, public.eureka_reviewed_discoveries, public.eureka_source_slots to service_role;

-- Shared across Worker instances and themes. Busy requests fail explicitly instead of queueing.
-- Ten seconds covers the bounded eight-second provider request plus pacing margin.
create function public.eureka_claim_source(p_provider text)
returns boolean language plpgsql set search_path = '' as $$
declare claimed text;
begin
  insert into public.eureka_source_slots(provider, next_request_at)
    values(p_provider, clock_timestamp() + interval '10 seconds')
  on conflict(provider) do update set next_request_at = excluded.next_request_at
    where public.eureka_source_slots.next_request_at <= clock_timestamp()
  returning provider into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.eureka_claim_source(text) from public, anon, authenticated;
grant execute on function public.eureka_claim_source(text) to service_role;
commit;
