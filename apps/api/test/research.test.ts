import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscoverySearchResponse } from '@eureka/contracts';
import app from '../src/index';
import { Store } from '../src/shared/persistence';
const user = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const selection = '33333333-3333-4333-8333-333333333333';
const env = { SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test' };
const headers = {Authorization:'Bearer test','Content-Type':'application/json','Idempotency-Key':'test-choice'};
const day = new Date().toISOString().slice(0,10);
const record = {identifier:'test-study',title:'Test only',url:'https://example.org/study',abstract:'Test evidence',publisher:'Test',publishedAt:day,editorialStatus:'unknown'};
const supported = {text:'Test only',references:[{sourceId:id,excerptId:'e1'}]};
const discovery = {id,themeId:'physics',title:'Test only',summary:'Test only',publishedAt:day,studyKey:record.identifier,topicKey:record.identifier,eligible:true,evidencePackageId:id,
  sources:[{id,title:'Test only',url:record.url,publisher:'Test',publishedAt:day,contentHash:'test-only',excerpts:[{id:'e1',text:record.abstract}]}],
  evidenceCard:{result:supported,evidence:supported,limitation:supported}};
const future = () => new Date(Date.now()+86400000).toISOString();
function setup({sourceFailed=false,storageFailed=false,cached=true,historyUser=user,allowSources=false,empty=false}={}) {
  let saved: any;
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if(url.pathname === '/auth/v1/user') return Response.json({id:user});
    if(url.pathname === '/rest/v1/eureka_research_cache') {
      if(init?.method==='POST') return new Response(null,{status:204});
      if(!cached) return Response.json([]);
      return Response.json([{payload:{cachedUntil:future(),partial:sourceFailed,providerResults:[{provider:'arxiv',status:sourceFailed?'failed':'ok',records:sourceFailed||empty?[]:[record]}]}}]);
    }
    if(url.pathname === '/rest/v1/eureka_history') {
      expect(url.searchParams.get('user_id')).toBe(`eq.${historyUser}`);
      expect(url.searchParams.get('eureka_episodes.theme_id')).toBe('eq.physics');
      return Response.json([{study_key:record.identifier}]);
    }
    if(url.pathname === '/rest/v1/eureka_reviewed_discoveries') {
      expect(url.searchParams.get('theme_id')).toBe('eq.physics');
      return Response.json([{payload:{discovery,reviewStatus:'unknown',reviewedBy:'Test reviewer',reviewedAt:new Date(Date.now()-1000).toISOString(),expiresAt:future()}}]);
    }
    if(url.pathname === '/rest/v1/eureka_selections') {
      if(storageFailed) return new Response('',{status:503});
      saved=JSON.parse(String(init?.body));
      return Response.json([{id:selection,expires_at:future().replace('Z','+00:00')}]);
    }
    if(url.pathname.endsWith('/eureka_claim_source')) return Response.json(allowSources);
    if(url.hostname==='export.arxiv.org') return new Response(`<feed><entry><id>https://arxiv.org/abs/test-study</id><title>Test only</title><published>${day}T00:00:00Z</published><summary>Test evidence</summary></entry></feed>`);
    if(url.hostname==='api.openalex.org') return Response.json({results:[]});
    if(url.pathname.endsWith('/eureka_create_episode')) {
      const body=JSON.parse(String(init?.body));
      expect(body.p_user).toBe(user);expect(body.p_selection).toBe(selection);expect(body.p_discovery).toBe(id);
      expect(saved.options[0]).toEqual(discovery);
      return Response.json({id,user_id:user,discovery_id:id,theme_id:'physics',discovery:saved.options[0],state:'selected',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    }
    throw Error('Unexpected request');
  });
  vi.stubGlobal('fetch',fetchMock);
  return {fetchMock,get saved(){return saved;}};
}
afterEach(()=>vi.unstubAllGlobals());
const search = (body: unknown = {themeId:'physics'}) => app.request('/api/v1/discovery-searches',{method:'POST',headers,body:JSON.stringify(body)},env);
describe('research API integration',()=>{
  it('runs uncached providers, persists cache and returns reviewed evidence',async()=>{
    const state=setup({cached:false,allowSources:true});const response=await search();expect(response.status).toBe(200);
    const body=DiscoverySearchResponse.parse(await response.json());expect(body.options).toHaveLength(1);expect(body.partial).toBe(false);
    expect(state.fetchMock.mock.calls.some(([u,init])=>String(u).includes('eureka_research_cache')&&init?.method==='POST')).toBe(true);
  });
  it('returns a persisted empty selection when sources succeed without eligible evidence',async()=>{
    const state=setup({empty:true});const response=await search();expect(response.status).toBe(200);
    const body=DiscoverySearchResponse.parse(await response.json());expect(body.options).toEqual([]);expect(body.emptyReason).toBe('no_eligible_evidence');
    expect(state.saved.options).toEqual([]);
  });
  it('rejects anonymous requests before any provider or database access',async()=>{
    const {fetchMock}=setup();expect((await app.request('/api/v1/discovery-searches',{method:'POST'},env)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects forged identity, unsupported themes and malformed JSON',async()=>{
    setup();expect((await search({themeId:'physics',userId:'attacker'})).status).toBe(400);
    expect((await search({themeId:'other'})).status).toBe(400);
    expect((await app.request('/api/v1/discovery-searches',{method:'POST',headers,body:'{'},env)).status).toBe(400);
  });
  it('uses authenticated history, saves selection, then creates chosen episode without AI',async()=>{
    const state=setup();const response=await search();expect(response.status).toBe(200);
    const body=DiscoverySearchResponse.parse(await response.json());
    expect(body.selectionSetId).toBe(selection);expect(body.options[0].alreadyHeard).toBe(true);
    expect(state.saved.user_id).toBe(user);expect(JSON.stringify(body)).not.toContain('excerpts');
    expect(JSON.stringify(body)).not.toContain('reviewedBy');
    const chosen=await app.request('/api/v1/episodes',{method:'POST',headers,body:JSON.stringify({mode:'chosen',selectionSetId:body.selectionSetId,discoveryId:body.options[0].id})},env);
    expect(chosen.status).toBe(200);
    expect(state.fetchMock.mock.calls.every(([u])=>new URL(String(u)).hostname==='example.supabase.co')).toBe(true);
  });
  it('does not return choices when selection persistence fails',async()=>{
    setup({storageFailed:true});const response=await search();expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('options');
  });
  it('distinguishes total source outage from zero eligible studies',async()=>{
    setup({sourceFailed:true});const response=await search();expect(response.status).toBe(503);
    expect((await response.json() as any).error.code).toBe('RESEARCH_UNAVAILABLE');
  });
  it('honors shared rate limit without making a provider request',async()=>{
    const state=setup({cached:false});expect((await search()).status).toBe(503);
    expect(state.fetchMock.mock.calls.some(([u])=>String(u).includes('export.arxiv'))).toBe(false);
  });
  it('filters history by supplied authenticated owner in Store',async()=>{
    setup({historyUser:'other-verified-user'});await new Store(env).getCompletedStudyKeys('other-verified-user','physics');
  });
});
