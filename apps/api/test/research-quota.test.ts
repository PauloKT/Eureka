import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, expect, it } from 'vitest';
let db: PGlite;
const user='11111111-1111-4111-8111-111111111111';
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${user}');
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create role anon;create role authenticated;create role service_role bypassrls;`);
  for(const name of ['202611020001_episode_foundation.sql','202611020002_recovery_cleanup.sql','202611070003_research.sql','202611080004_automatic_research.sql'])
    await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`,import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
const begin=(key:string,model:string)=>db.query<{result:any}>('select public.eureka_begin_research($1,$2,$3) as result',[user,key.repeat(64),model]);
it('research and episode generation share the same budget in both directions',async()=>{
  await db.exec("insert into public.eureka_model_budgets values('shared',2,2),('reverse',2,2)");
  expect((await begin('a','shared')).rows[0].result.complete).toBe(false);
  const selection=await db.query<{id:string}>('insert into public.eureka_selections(user_id,theme_id,options) values($1,\'space\',$2) returning id',[user,JSON.stringify([{id:user,studyKey:'study',topicKey:'study'}])]);
  const create=async(key:string)=>(await db.query<{e:any}>('select public.eureka_create_episode($1,$2,$3,\'chosen\',$4,\'hash\') e',[user,selection.rows[0].id,user,key])).rows[0].e;
  const e=await create('first');
  await expect(db.query('select public.eureka_begin_operation($1,$2,\'script\',\'script-key\',\'shared\')',[user,e.id])).rejects.toThrow('QUOTA_EXHAUSTED');
  await db.query('select public.eureka_begin_operation($1,$2,\'script\',\'script-key\',\'reverse\')',[user,e.id]);
  await expect(begin('b','reverse')).rejects.toThrow('QUOTA_EXHAUSTED');
});
it('completed preparation is reused; failed/unknown reservations cannot be replayed',async()=>{
  await db.exec("insert into public.eureka_model_budgets values('cache',10,10)");
  await begin('c','cache'); await expect(begin('c','cache')).rejects.toThrow('OPERATION_IN_PROGRESS');
  await db.query('select public.eureka_finish_research($1,\'[]\',null)',['c'.repeat(64)]);
  expect((await begin('c','cache')).rows[0].result).toEqual({complete:true,result:[]});
  await begin('d','cache'); await db.query('select public.eureka_finish_research($1,null,\'PROVIDER_OUTCOME_UNKNOWN\')',['d'.repeat(64)]);
  await expect(begin('d','cache')).rejects.toThrow('PROVIDER_OUTCOME_UNKNOWN');
  expect((await db.query<{calls:number}>("select sum(reserved_calls)::int calls from public.eureka_model_reservations where model='cache'")).rows[0].calls).toBe(4);
});
it('direct client access is denied for quota reservation and cached evidence',async()=>{
  for(const role of ['anon','authenticated']) {
    expect((await db.query<{ok:boolean}>("select has_function_privilege($1,'public.eureka_begin_research(uuid,text,text)','execute') ok",[role])).rows[0].ok).toBe(false);
    for(const table of ['eureka_model_reservations','eureka_research_operations']) expect((await db.query<{ok:boolean}>("select has_table_privilege($1,$2,'select') ok",[role,table])).rows[0].ok).toBe(false);
  }
});
