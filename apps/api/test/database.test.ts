import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const discoveryId = '33333333-3333-4333-8333-333333333333';
const selectionId = '44444444-4444-4444-8444-444444444444';
let db: PGlite;
async function create(key: string, user = owner, hash = 'hash', mode = 'chosen') {
  const result = await db.query<{ result: any }>('select public.eureka_create_episode($1,$2,$3,$4,$5,$6) as result',
    [user,selectionId,mode === 'surprise' ? null : discoveryId,mode,key,hash]);
  return result.rows[0].result;
}
async function begin(id: string, stage = 'script', user = owner, model = 'test-text') {
  const result = await db.query<{ result: any }>('select public.eureka_begin_operation($1,$2,$3,$4,$5) as result', [user,id,stage,'stage-key',model]);
  return result.rows[0].result;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create role anon; create role authenticated; create role service_role bypassrls;
    insert into auth.users values('${owner}'),('${stranger}');`);
  const sql = await readFile(new URL('../../../supabase/migrations/202611020001_episode_foundation.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(await readFile(new URL('../../../supabase/migrations/202611020002_recovery_cleanup.sql', import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../../supabase/migrations/202611070003_research.sql', import.meta.url),'utf8'));
  await db.query('insert into public.eureka_selections(id,user_id,theme_id,options) values($1,$2,$3,$4)',
    [selectionId,owner,'space',JSON.stringify([{id:discoveryId,studyKey:'study',topicKey:'topic'}])]);
  await db.exec("insert into public.eureka_model_budgets values ('test-text',100,100),('test-voice',100,100),('blocked',0,0),('limited',2,2)");
}, 30000);
afterAll(async () => { await db?.close(); });

describe('research persistence permissions and source pacing', () => {
  it('shares source slots across themes and denies repeated claims', async () => {
    const claim = () => db.query<{allowed:boolean}>("select public.eureka_claim_source('arxiv') as allowed");
    expect((await claim()).rows[0].allowed).toBe(true);
    expect((await claim()).rows[0].allowed).toBe(false);
    await db.exec("update public.eureka_source_slots set next_request_at=now()-interval '1 second' where provider='arxiv'");
    expect((await claim()).rows[0].allowed).toBe(true);
  });
  it('keeps independent snapshots per theme and rejects mismatched keys', async () => {
    for (const theme of ['physics','technology']) await db.query(
      'insert into public.eureka_reviewed_discoveries(identifier,theme_id,payload,expires_at) values($1,$2,$3,now()+interval \'1 day\')',
      ['study',theme,JSON.stringify({discovery:{themeId:theme,studyKey:'study'}})]);
    expect((await db.query("select * from public.eureka_reviewed_discoveries where identifier='study'")).rows).toHaveLength(2);
    await expect(db.exec("update public.eureka_reviewed_discoveries set theme_id='brain' where theme_id='physics'")).rejects.toThrow();
  });
  it('denies direct mobile access to editorial snapshots, caches and limiter RPC', async () => {
    for (const role of ['anon','authenticated']) {
      for (const table of ['eureka_reviewed_discoveries','eureka_research_cache','eureka_source_slots']) {
        const result = await db.query<{allowed:boolean}>('select has_table_privilege($1,$2,\'select\') as allowed',[role,`public.${table}`]);
        expect(result.rows[0].allowed).toBe(false);
      }
      const result = await db.query<{allowed:boolean}>('select has_function_privilege($1,\'public.eureka_claim_source(text)\',\'execute\') as allowed',[role]);
      expect(result.rows[0].allowed).toBe(false);
    }
  });
});

describe('PostgreSQL: atomicidade, cotas e autorização', () => {
  it('recupera resultado persistido sem nova reserva e respeita dono/lease', async()=>{
    const e=await create('checkpoint'); const op=await begin(e.id);
    await db.query('select public.eureka_checkpoint($1,$2,$3,$4)',[owner,e.id,op.operationId,JSON.stringify({auditStatus:'approved',contentHash:'recovered'})]);
    await expect(db.query('select public.eureka_recover_result($1,$2,$3)',[owner,e.id,op.operationId])).rejects.toThrow('OPERATION_IN_PROGRESS');
    await db.query("update public.eureka_operations set lease_until=now()-interval '1 minute' where id=$1",[op.operationId]);
    await expect(db.query('select public.eureka_recover_result($1,$2,$3)',[stranger,e.id,op.operationId])).rejects.toThrow('NOT_FOUND');
    const recovered=await db.query<{result:any}>('select public.eureka_recover_result($1,$2,$3) as result',[owner,e.id,op.operationId]);
    expect(recovered.rows[0].result.state).toBe('script_ready');
    expect((await begin(e.id)).complete).toBe(true);
  });
  it('retry preserva cota antiga, exige chave nova e limita correção a uma',async()=>{
    await db.exec("insert into public.eureka_model_budgets values ('retry-text',4,4)");
    const e=await create('retry'); const op=await begin(e.id,'script',owner,'retry-text');
    await db.query('select public.eureka_finish_operation($1,$2,$3,null,$4)',[owner,e.id,op.operationId,'SCRIPT_REJECTED']);
    await db.query('select public.eureka_prepare_retry($1,$2,$3)',[owner,e.id,'script']);
    await expect(begin(e.id,'script',owner,'retry-text')).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    const next=await db.query<{result:any}>('select public.eureka_begin_operation($1,$2,$3,$4,$5) as result',[owner,e.id,'script','new-key','retry-text']);
    await expect(begin((await create('retry-budget')).id,'script',owner,'retry-text')).rejects.toThrow('QUOTA_EXHAUSTED');
    await db.query('select public.eureka_finish_operation($1,$2,$3,null,$4)',[owner,e.id,next.rows[0].result.operationId,'SCRIPT_REJECTED']);
    await expect(db.query('select public.eureka_prepare_retry($1,$2,$3)',[owner,e.id,'script'])).rejects.toThrow('RETRY_LIMIT_REACHED');
  });
  it('resultado incerto não pode ser liberado para nova geração',async()=>{
    const e=await create('unknown');const op=await begin(e.id);
    await db.query('select public.eureka_finish_operation($1,$2,$3,null,$4)',[owner,e.id,op.operationId,'PROVIDER_OUTCOME_UNKNOWN']);
    await expect(db.query('select public.eureka_prepare_retry($1,$2,$3)',[owner,e.id,'script'])).rejects.toThrow('PROVIDER_OUTCOME_UNKNOWN');
  });
  it('limpeza só libera espaço após expiração, preservando episódio e histórico',async()=>{
    const e=await create('cleanup');const op=await begin(e.id);
    await db.query('select public.eureka_finish_operation($1,$2,$3,$4,null)',[owner,e.id,op.operationId,JSON.stringify({auditStatus:'approved',contentHash:'abc'})]);
    const voice=await begin(e.id,'audio',owner,'test-voice');
    const audio={storagePath:`${owner}/${e.id}/abc.wav`,scriptHash:'abc',byteLength:100,durationSeconds:1,expiresAt:'2020-01-01T00:00:00Z'};
    await db.query('select public.eureka_finish_operation($1,$2,$3,$4,null)',[owner,e.id,voice.operationId,JSON.stringify(audio)]);
    await db.query('select public.eureka_complete_episode($1,$2)',[owner,e.id]);
    const items=await db.query<{result:any[]}>('select public.eureka_cleanup_candidates() as result');
    expect(items.rows[0].result.some(x=>x.episode_id===e.id)).toBe(true);
    await expect(db.query('select public.eureka_mark_audio_deleted($1,$2,$3)',[e.id,voice.operationId,'wrong/path'])).rejects.toThrow('INVALID_STATE');
    await db.query('select public.eureka_mark_audio_deleted($1,$2,$3)',[e.id,voice.operationId,audio.storagePath]);
    const rows=await db.query<{audio:any}>('select audio from public.eureka_episodes where id=$1',[e.id]);
    expect(rows.rows[0].audio.byteLength).toBe(0);expect(rows.rows[0].audio.deletedAt).toBeTruthy();
    expect((await db.query('select * from public.eureka_history where episode_id=$1',[e.id])).rows).toHaveLength(1);
  });
  it('cria uma vez e rejeita mesma chave com escolha diferente', async () => {
    const first = await create('create-one');
    expect((await create('create-one')).id).toBe(first.id);
    await expect(create('create-one',owner,'changed')).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });
  it('surpresa escolhe somente da seleção e não aceita seleção de outro usuário', async () => {
    expect((await create('surprise',owner,'hash','surprise')).discovery_id).toBe(discoveryId);
    await expect(create('intruder',stranger)).rejects.toThrow('NOT_FOUND');
  });
  it('bloqueia seleção expirada', async () => {
    await db.query("update public.eureka_selections set expires_at = now() - interval '1 minute' where id=$1",[selectionId]);
    await expect(create('expired')).rejects.toThrow('SELECTION_EXPIRED');
    await db.query("update public.eureka_selections set expires_at = now() + interval '1 day' where id=$1",[selectionId]);
  });
  it('reserva duas chamadas de texto uma vez e bloqueia repetição e invasor', async () => {
    const e = await create('locked');
    await begin(e.id);
    await expect(begin(e.id)).rejects.toThrow('OPERATION_IN_PROGRESS');
    await expect(begin(e.id,'script',stranger)).rejects.toThrow('NOT_FOUND');
    const rows = await db.query<{ reserved_calls: number }>('select reserved_calls from public.eureka_operations where episode_id=$1',[e.id]);
    expect(rows.rows).toEqual([{reserved_calls:2}]);
  });
  it('lease vencido não autoriza outra geração', async () => {
    const e = await create('expired-lease'); await begin(e.id);
    await db.query("update public.eureka_operations set lease_until = now() - interval '1 minute' where episode_id=$1",[e.id]);
    await expect(begin(e.id)).rejects.toThrow('PROVIDER_OUTCOME_UNKNOWN');
  });
  it('cota global é compartilhada e zero bloqueia sem mudar episódio', async () => {
    const e = await create('zero');
    await expect(begin(e.id,'script',owner,'blocked')).rejects.toThrow('QUOTA_EXHAUSTED');
    const states = await db.query<{ state: string }>('select state from public.eureka_episodes where id=$1',[e.id]);
    expect(states.rows[0].state).toBe('selected');
    await begin((await create('limit-one')).id,'script',owner,'limited');
    await expect(begin((await create('limit-two')).id,'script',owner,'limited')).rejects.toThrow('QUOTA_EXHAUSTED');
  });
  it('rejeita áudio antes de roteiro aprovado; preserva roteiro quando áudio falha', async () => {
    const e = await create('audio-check');
    await expect(begin(e.id,'audio',owner,'test-voice')).rejects.toThrow('INVALID_STATE');
    const op = await begin(e.id);
    await db.query('select public.eureka_finish_operation($1,$2,$3,$4,null)',[owner,e.id,op.operationId,JSON.stringify({auditStatus:'approved',contentHash:'abc'})]);
    const audio = await begin(e.id,'audio',owner,'test-voice');
    await db.query('select public.eureka_finish_operation($1,$2,$3,null,$4)',[owner,e.id,audio.operationId,'STORAGE_UNAVAILABLE']);
    const result = await db.query<{ script: any; state: string }>('select script,state from public.eureka_episodes where id=$1',[e.id]);
    expect(result.rows[0].script.contentHash).toBe('abc');
    expect(result.rows[0].state).toBe('failed');
  });
  it('não permite clientes escreverem dados nem chamarem funções administrativas', async () => {
    await db.exec('set role authenticated');
    try {
      await expect(db.query('select * from public.eureka_selections')).rejects.toThrow('permission denied');
      await expect(create('client-bypass')).rejects.toThrow('permission denied');
    } finally { await db.exec('reset role'); }
    const rows = await db.query<{ public: boolean }>("select public from storage.buckets where id='eureka-audio'");
    expect(rows.rows[0].public).toBe(false);
  });
});
