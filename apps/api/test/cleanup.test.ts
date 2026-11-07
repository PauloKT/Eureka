import {afterEach,expect,it,vi} from 'vitest';
import {cleanupExpiredAudio} from '../src/modules/speech/cleanup';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test'};
const user='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
afterEach(()=>vi.unstubAllGlobals());
it('não libera espaço quando o Storage falha; ignora caminho de outro usuário',async()=>{
  let marks=0,deletes=0;
  vi.stubGlobal('fetch',vi.fn(async(input:any,init:any)=>{
    if(String(input).includes('eureka_cleanup_candidates'))return Response.json([
      {user_id:user,episode_id:id,operation_id:'op',audio:{storagePath:`${user}/${id}/abc.wav`,expiresAt:'2020-01-01T00:00:00Z'}},
      {user_id:user,episode_id:id,operation_id:'op2',audio:{storagePath:'someone/else.wav',expiresAt:'2020-01-01T00:00:00Z'}}]);
    if(init.method==='DELETE'){deletes++;return new Response('{}',{status:503});}
    marks++;return Response.json(null);
  }));
  expect(await cleanupExpiredAudio(env)).toEqual({deleted:0,failed:2});
  expect(deletes).toBe(1);expect(marks).toBe(0);
});
it('remove arquivo antes de confirmar liberação no banco',async()=>{
  const actions:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:any,init:any)=>{
    if(String(input).includes('eureka_cleanup_candidates'))return Response.json([{user_id:user,episode_id:id,operation_id:'op',audio:{storagePath:`${user}/${id}/abc.wav`,expiresAt:'2020-01-01T00:00:00Z'}}]);
    actions.push(init.method==='DELETE'?'storage':'database');return Response.json(null);
  }));
  expect(await cleanupExpiredAudio(env)).toEqual({deleted:1,failed:0});expect(actions).toEqual(['storage','database']);
});
