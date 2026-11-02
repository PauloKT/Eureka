import { Hono } from 'hono';
import { z } from 'zod';
import { EpisodeChoice, Discovery, ApprovedScript } from '@eureka/contracts';
import { requireSession, type AuthEnvironment } from '../auth/session';
import { Store } from '../../shared/persistence';
import { AppError, knownError } from '../../shared/errors';
import { hash, makeScript } from '../scripts/generate';
import { makeAudio } from '../speech/audio';

const idSchema = z.string().uuid();
const keySchema = z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export function publicEpisode(e: any) {
  return { id: e.id, discoveryId: e.discovery_id, themeId: e.theme_id, state: e.state,
    title: e.discovery.title, createdAt: e.created_at, updatedAt: e.updated_at, errorCode: e.error_code,
    script: e.script ? { title: e.script.title, paragraphs: e.script.paragraphs.map((p: any) => ({ id: p.id, text: p.text })), evidenceCard: e.script.evidenceCard } : null,
    sources: e.discovery.sources.map((s: any) => ({ id: s.id, title: s.title, publisher: s.publisher, url: s.url, publishedAt: s.publishedAt })),
    audio: e.audio ? { durationSeconds: e.audio.durationSeconds, expiresAt: e.audio.expiresAt } : null };
}
export const episodeRoutes = new Hono<AuthEnvironment>();
episodeRoutes.use('*', requireSession);

episodeRoutes.post('/episodes', async c => {
  const choice = EpisodeChoice.parse(await c.req.json().catch(() => null));
  const key = keySchema.parse(c.req.header('Idempotency-Key'));
  const store = new Store(c.env);
  const episode = await store.rpc('eureka_create_episode', {
    p_user: c.get('userId'), p_selection: choice.selectionSetId,
    p_discovery: choice.mode === 'chosen' ? choice.discoveryId : null, p_mode: choice.mode,
    p_key: key, p_hash: await hash(choice),
  });
  return c.json({ episode: publicEpisode(episode) });
});
episodeRoutes.get('/episodes/:id', async c => {
  const episode = await new Store(c.env).episode(c.get('userId'), idSchema.parse(c.req.param('id')));
  return c.json({ episode: publicEpisode(episode) });
});

for (const stage of ['script','audio'] as const) {
  episodeRoutes.post(`/episodes/:id/${stage}`, async c => {
    const id = idSchema.parse(c.req.param('id'));
    const key = keySchema.parse(c.req.header('Idempotency-Key'));
    const user = c.get('userId'); const store = new Store(c.env);
    const existing = await store.episode(user, id);
    if ((stage === 'script' && existing.script) || (stage === 'audio' && existing.state === 'ready')) {
      return c.json({ episode: publicEpisode(existing) });
    }
    const model = stage === 'script' ? c.env.GEMINI_TEXT_MODEL : c.env.GEMINI_TTS_MODEL;
    if (c.env.LIVE_AI_ENABLED !== 'true' || !c.env.GEMINI_API_KEY || !model) throw new AppError('GENERATION_DISABLED');
    // Validate stored trusted-source package before consuming any quota.
    const discovery = Discovery.safeParse(existing.discovery);
    if (!discovery.success) throw knownError('INSUFFICIENT_EVIDENCE');
    if (stage === 'audio') ApprovedScript.parse(existing.script);
    const operation = await store.rpc('eureka_begin_operation', {
      p_user: user, p_episode: id, p_stage: stage, p_key: key, p_model: model,
    });
    if (operation.complete) return c.json({ episode: publicEpisode(operation.episode) });
    const finish = (result: unknown, error: string | null) => store.rpc('eureka_finish_operation', {
      p_user: user, p_episode: id, p_operation: operation.operationId, p_result: result, p_error: error,
    });
    let result: unknown;
    try {
      if (stage === 'script') {
        result = await makeScript(c.env, model, discovery.data);
        await store.rpc('eureka_checkpoint', {p_user:user,p_episode:id,p_operation:operation.operationId,p_result:result});
      }
      else {
        const script = ApprovedScript.parse(operation.episode.script);
        const audio = await makeAudio(c.env, model, script);
        const path = `${user}/${id}/${script.contentHash}.wav`;
        const audioHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', audio.wav as Uint8Array<ArrayBuffer>)), b=>b.toString(16).padStart(2,'0')).join('');
        result = { id: crypto.randomUUID(), storagePath: path, durationSeconds: audio.durationSeconds,
          byteLength: audio.wav.length, mimeType: 'audio/wav', scriptHash: script.contentHash,
          createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), voice: 'Kore', modelId: model, audioHash };
        await store.rpc('eureka_checkpoint', {p_user:user,p_episode:id,p_operation:operation.operationId,p_result:result});
        await store.upload(path, audio.wav);
      }
    } catch (error) {
      const failure = error instanceof AppError ? error : knownError('PROVIDER_OUTCOME_UNKNOWN');
      await finish(null, failure.code).catch(() => {}); // If persistence fails, lease blocks replay.
      throw failure;
    }
    // Do not overwrite the operation with a failure if this commit times out: it may have succeeded.
    const saved = await finish(result, null);
    return c.json({ episode: publicEpisode(saved) });
  });
}

episodeRoutes.post('/episodes/:id/recover', async c => {
  const id=idSchema.parse(c.req.param('id')); const user=c.get('userId'); const store=new Store(c.env);
  const {stage}=z.object({stage:z.enum(['script','audio'])}).strict().parse(await c.req.json().catch(()=>null));
  const operation=await store.operation(user,id,stage);
  if (operation.status==='complete') return c.json({episode:publicEpisode(await store.episode(user,id))});
  if (operation.status==='running' && Date.parse(operation.lease_until)>Date.now()) throw knownError('OPERATION_IN_PROGRESS');
  const result=operation.pending_result;
  if (!result) throw knownError('PROVIDER_OUTCOME_UNKNOWN');
  if (stage==='script') ApprovedScript.parse(result);
  else {
    if (!Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt)<=Date.now()) throw knownError('AUDIO_EXPIRED');
    if (typeof result.audioHash!=='string') throw knownError('PROVIDER_OUTCOME_UNKNOWN');
    await store.storedAudioMatches(result.storagePath,result.byteLength,result.audioHash);
  }
  const saved=await store.rpc('eureka_recover_result',{p_user:user,p_episode:id,p_operation:operation.id});
  return c.json({episode:publicEpisode(saved)});
});
episodeRoutes.post('/episodes/:id/retry', async c => {
  const id=idSchema.parse(c.req.param('id')); const user=c.get('userId');
  const {stage}=z.object({stage:z.enum(['script','audio'])}).strict().parse(await c.req.json().catch(()=>null));
  const saved=await new Store(c.env).rpc('eureka_prepare_retry',{p_user:user,p_episode:id,p_stage:stage});
  return c.json({episode:publicEpisode(saved)});
});

episodeRoutes.get('/episodes/:id/audio-access', async c => {
  const store = new Store(c.env);
  const episode = await store.episode(c.get('userId'), idSchema.parse(c.req.param('id')));
  if (episode.state !== 'ready' || !episode.audio) throw knownError('INVALID_STATE');
  if (episode.audio.deletedAt || !Number.isFinite(Date.parse(episode.audio.expiresAt)) || Date.parse(episode.audio.expiresAt) <= Date.now()) throw knownError('AUDIO_EXPIRED');
  return c.json(await store.signedUrl(episode.audio.storagePath));
});
episodeRoutes.post('/episodes/:id/completion', async c => {
  await new Store(c.env).rpc('eureka_complete_episode', { p_user: c.get('userId'), p_episode: idSchema.parse(c.req.param('id')) });
  return c.json({ completed: true });
});
episodeRoutes.get('/history', async c => {
  const cursor = c.req.query('cursor');
  let decoded: { at: string; id: string } | undefined;
  if (cursor) {
    try { decoded = z.object({ at: z.string().datetime({ offset: true }), id: idSchema }).parse(JSON.parse(atob(cursor))); }
    catch { throw knownError('INVALID_INPUT'); }
  }
  const query = new URLSearchParams({ user_id: `eq.${c.get('userId')}`, select: 'episode_id,discovery_id,study_key,topic_key,completed_at', order: 'completed_at.desc,episode_id.desc', limit: '21' });
  if (decoded) query.set('or', `(completed_at.lt.${decoded.at},and(completed_at.eq.${decoded.at},episode_id.lt.${decoded.id}))`);
  const rows = await new Store(c.env).request(`/rest/v1/eureka_history?${query}`);
  const items = rows.slice(0,20); const last = items.at(-1);
  return c.json({ items, nextCursor: rows.length > 20 && last ? btoa(JSON.stringify({ at: last.completed_at, id: last.episode_id })) : null });
});
