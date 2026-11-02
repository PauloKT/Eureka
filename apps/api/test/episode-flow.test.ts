import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';

const userId = '11111111-1111-4111-8111-111111111111';
const episodeId = '22222222-2222-4222-8222-222222222222';
const sourceId = '33333333-3333-4333-8333-333333333333';
const refs = [{sourceId, excerptId:'e1'}];
const item = {text:'Somente uma fixture para teste.',references:refs};
const card = {result:item,evidence:item,limitation:item};
const candidate = { title:'Fixture', paragraphs:[{id:'p1',text:'Somente uma fixture para teste.',claimIds:['c1']}],claims:[{id:'c1',text:'Somente uma fixture para teste.',references:refs}],evidenceCard:card };
const discovery = {id:sourceId,themeId:'space',title:'Fixture',summary:'Teste',publishedAt:'2026-11-01',studyKey:'test',topicKey:'test',eligible:true,evidencePackageId:sourceId,evidenceCard:card,
  sources:[{id:sourceId,title:'Fixture',url:'https://example.org',publisher:'Test',publishedAt:'2026-11-01',contentHash:'fixture',excerpts:[{id:'e1',text:'Somente uma fixture para teste.'}]}]};
const env = {SUPABASE_URL:'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY:'public-test', SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test', GEMINI_API_KEY:'gemini-test', GEMINI_TEXT_MODEL:'gemini-3.1-flash-lite', GEMINI_TTS_MODEL:'gemini-3.1-flash-tts-preview',LIVE_AI_ENABLED:'true'};
const headers = {Authorization:'Bearer session-test','Idempotency-Key':'attempt-123','Content-Type':'application/json'};
function setup(approved = true) {
  const episode: any = {id:episodeId,user_id:userId,discovery_id:sourceId,theme_id:'space',discovery,state:'selected',script:null,audio:null};
  let calls = 0; let uploads = 0;
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({id:userId});
    if (url.pathname === '/rest/v1/eureka_episodes') return Response.json([episode]);
    if (url.pathname.endsWith('/eureka_begin_operation')) return Response.json({complete:false,operationId:'op-test',episode});
    if (url.pathname.endsWith('/eureka_checkpoint')) return new Response(null,{status:204});
    if (url.pathname.endsWith('/eureka_finish_operation')) {
      const body = JSON.parse(String(init?.body));
      if (body.p_error) {episode.state='failed';episode.error_code=body.p_error;}
      else if (body.p_result.auditStatus) {episode.script=body.p_result;episode.state='script_ready';}
      else {episode.audio=body.p_result;episode.state='ready';}
      return Response.json(episode);
    }
    if (url.host === 'generativelanguage.googleapis.com') {
      calls++;
      const body = JSON.parse(String(init?.body));
      if (body.generationConfig.responseModalities) return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'audio/l16; rate=24000; channels=1',data:btoa('\0'.repeat(48000))}}]}}]});
      const payload = calls === 1 ? candidate : { supported:approved,checkedClaimIds:['c1'],issues:approved ? [] : ['Unsupported'] };
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(payload)}]}}]});
    }
    if (url.pathname.startsWith('/storage/v1/object/eureka-audio/')) {uploads++;return Response.json({Key:'stored'});}
    throw new Error('Unexpected request');
  });
  vi.stubGlobal('fetch',fetchMock);
  return {episode,get calls(){return calls;},get uploads(){return uploads;}};
}
afterEach(()=>vi.unstubAllGlobals());
describe('fluxo integrado com provedores simulados',()=>{
  it('revisa antes de narrar; consulta e repetição de etapas completas não consomem IA',async()=>{
    const state=setup();
    const send=(path:string,method='POST')=>app.request(`/api/v1/episodes/${episodeId}${path}`,{method,headers},env);
    expect((await send('/script')).status).toBe(200);
    expect(state.calls).toBe(2);
    expect(state.episode.state).toBe('script_ready');
    expect((await send('/audio')).status).toBe(200);
    expect(state.calls).toBe(3);expect(state.uploads).toBe(1);
    expect(state.episode.audio.durationSeconds).toBe(1);
    await send('/audio');await send('/script');
    const response=await send('','GET');const body=await response.json();
    expect(state.calls).toBe(3);
    expect(JSON.stringify(body)).not.toContain('storagePath');
    expect(JSON.stringify(body)).not.toContain('contentHash');
    expect(JSON.stringify(body)).not.toContain('excerpts');
  });
  it('roteiro reprovado não produz nem envia áudio',async()=>{
    const state=setup(false);
    const response=await app.request(`/api/v1/episodes/${episodeId}/script`,{method:'POST',headers},env);
    expect(response.status).toBe(422);expect(state.calls).toBe(2);expect(state.uploads).toBe(0);
    expect(state.episode.state).toBe('failed');
  });
  it('geração desligada não faz chamadas Gemini',async()=>{
    const state=setup();
    const response=await app.request(`/api/v1/episodes/${episodeId}/script`,{method:'POST',headers},{...env,LIVE_AI_ENABLED:'false'});
    expect(response.status).toBe(503);expect(state.calls).toBe(0);
  });
});
