import {afterEach,expect,it,vi} from 'vitest';
import app from '../src/index';
import {Store} from '../src/shared/persistence';
const user='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test'};
afterEach(()=>vi.unstubAllGlobals());
it('áudio recuperado precisa corresponder ao hash do arquivo validado',async()=>{
  const bytes=new Uint8Array(44);const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  vi.stubGlobal('fetch',vi.fn(async(_input:any,init:any)=>init?.method==='POST' ? Response.json({signedURL:'/object/sign/eureka-audio/test?token=fake'}) : new Response(bytes)));
  const store=new Store(env);
  await expect(store.storedAudioMatches(`${user}/${id}/abc.wav`,44,digest)).resolves.toBeUndefined();
  await expect(store.storedAudioMatches(`${user}/${id}/abc.wav`,44,'wrong')).rejects.toThrow('PROVIDER_OUTCOME_UNKNOWN');
});
it('não tenta baixar nem recuperar operação ainda em andamento',async()=>{
  let other=0;
  vi.stubGlobal('fetch',vi.fn(async(input:any)=>{
    const path=new URL(String(input)).pathname;
    if(path==='/auth/v1/user')return Response.json({id:user});
    if(path==='/rest/v1/eureka_episodes')return Response.json([{id,user_id:user}]);
    if(path==='/rest/v1/eureka_operations')return Response.json([{status:'running',lease_until:new Date(Date.now()+60000).toISOString()}]);
    other++;throw Error();
  }));
  const response=await app.request(`/api/v1/episodes/${id}/recover`,{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({stage:'audio'})},env);
  expect(response.status).toBe(409);expect(other).toBe(0);
});
it('ausência de resultado preservado não autoriza regeneração',async()=>{
  let other=0;
  vi.stubGlobal('fetch',vi.fn(async(input:any)=>{
    const path=new URL(String(input)).pathname;
    if(path==='/auth/v1/user')return Response.json({id:user});
    if(path==='/rest/v1/eureka_episodes')return Response.json([{id,user_id:user}]);
    if(path==='/rest/v1/eureka_operations')return Response.json([{status:'failed',pending_result:null}]);
    other++;throw Error();
  }));
  const response=await app.request(`/api/v1/episodes/${id}/recover`,{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({stage:'script'})},env);
  expect(response.status).toBe(503);expect(other).toBe(0);
});
