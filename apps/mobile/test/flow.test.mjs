import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApi, createEpisodeFlow, formatDate, audioExpired } from '../src/api.mjs';
import { createSecureStorage } from '../src/secure-storage.mjs';

const memory = () => { const values = new Map(); return { getItem: async k => values.get(k) ?? null, setItem: async (k, v) => values.set(k, v), removeItem: async k => values.delete(k) }; };
test('private calls require auth; public calls do not leak tokens', async () => {
  let calls = 0;
  const api = createApi({ baseUrl: 'https://example.test/api/v1/', getToken: async () => null, fetchImpl: async (_url, init) => { calls++; assert.equal(init.headers.Authorization, undefined); return Response.json({ status: 'ok' }); } });
  await assert.rejects(api('/me'), e => e.code === 'UNAUTHORIZED'); assert.equal(calls, 0);
  assert.deepEqual(await api('/health', { publicRoute: true }), { status: 'ok' });
});
test('API preserves error code, rate limit and idempotency; never retries POST', async () => {
  let calls = 0;
  const api = createApi({ baseUrl: 'https://example.test', getToken: async () => 'token', fetchImpl: async (_url, init) => {
    calls++; assert.equal(init.headers.Authorization, 'Bearer token'); assert.equal(init.headers['Idempotency-Key'], 'same-key');
    return Response.json({ error: { code: 'QUOTA_EXHAUSTED', message: 'Limite', retryAfterSeconds: 60 } }, { status: 429 });
  } });
  await assert.rejects(api('/episodes', { method: 'POST', key: 'same-key', body: {} }), e => e.status === 429 && e.code === 'QUOTA_EXHAUSTED' && e.retryAfterSeconds === 60);
  assert.equal(calls, 1);
});
test('network timeout has a recoverable message and makes only one request', async () => {
  let calls = 0;
  const api = createApi({ baseUrl: 'https://example.test', getToken: async () => 'token', timeoutMs: 5, fetchImpl: async (_url, { signal }) => { calls++; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')))); } });
  await assert.rejects(api('/episodes', { method: 'POST' }), e => e.code === 'NETWORK_ERROR'); assert.equal(calls, 1);
});
test('create resumes the same persisted intent after timeout and restart', async () => {
  const storage = memory(), keys = []; let first = true;
  const api = async (path, options) => { assert.equal(path, '/episodes'); keys.push(options.key); if (first) { first = false; throw new ApiError('NETWORK_ERROR', 'timeout'); } return { episode: { id: 'episode', state: 'selected' } }; };
  const args = { api, storage, userId: 'one', uuid: () => 'uuid-1' }, choice = { mode: 'surprise', selectionSetId: 'selection' };
  await assert.rejects(createEpisodeFlow(args).choose(choice));
  const resumed = createEpisodeFlow({ ...args, uuid: () => 'should-not-be-used' });
  assert.equal((await resumed.choose(choice)).id, 'episode'); assert.deepEqual(keys, ['uuid-1', 'uuid-1']);
  assert.equal((await resumed.load()).episodeId, 'episode');
  assert.equal(await createEpisodeFlow({ ...args, userId: 'two' }).load(), null);
});
test('generation checks server state before POST and retains stage key after timeout', async () => {
  const storage = memory(), calls = []; let state = 'selected', fail = true, counter = 0;
  const api = async (path, opts = {}) => { calls.push({ path, ...opts });
    if (path === '/episodes') return { episode: { id: 'episode', state } };
    if (path.endsWith('/script')) { if (fail) { fail = false; throw new Error('offline'); } state = 'script_ready'; }
    return { episode: { id: 'episode', state, script: state === 'script_ready' ? {} : null } };
  };
  const flow = createEpisodeFlow({ api, storage, userId: 'one', uuid: () => `key-${++counter}` });
  await flow.choose({ mode: 'surprise', selectionSetId: 's' }); await assert.rejects(flow.generate('script'));
  await flow.generate('script'); await flow.generate('script');
  const writes = calls.filter(x => x.path.endsWith('/script'));
  assert.equal(writes.length, 2); assert.equal(writes[0].key, writes[1].key);
  assert.equal(calls.filter(x => x.path.endsWith('/audio')).length, 0);
});
test('running or failed episodes cannot trigger automatic regeneration; denied retry retains key', async () => {
  const storage = memory(); let state = 'failed', writes = 0;
  const api = async (path, opts = {}) => {
    if (path.endsWith('/retry')) throw new ApiError('RETRY_LIMIT_REACHED', 'limit');
    if (opts.method === 'POST') writes++;
    return { episode: { id: 'episode', state, script: null } };
  };
  const flow = createEpisodeFlow({ api, storage, userId: 'one', uuid: () => 'new-key' });
  await flow.open('episode'); await assert.rejects(flow.generate('script'), e => e.code === 'INVALID_STATE');
  state = 'script_generating'; await assert.rejects(flow.generate('script')); await assert.rejects(flow.prepareRetry('script'));
  assert.equal(writes, 0); assert.deepEqual((await flow.load()).keys, {});
});
test('approved corrective retry prepares a new key without calling generation', async () => {
  const storage = memory(), paths = [];
  const flow = createEpisodeFlow({ storage, userId: 'one', uuid: () => 'retry-key', api: async path => { paths.push(path); return { episode: { id: 'episode', state: path.endsWith('/retry') ? 'selected' : 'failed' } }; } });
  await flow.open('episode'); await flow.prepareRetry('script');
  assert.equal((await flow.load()).keys.script, 'retry-key'); assert.deepEqual(paths, ['/episodes/episode', '/episodes/episode/retry']);
});
test('dates do not shift with timezone and expired audio stays expired', () => {
  assert.equal(formatDate('2026-11-08'), '08/11/2026');
  assert.equal(audioExpired({ audio: { expiresAt: '2026-11-08T00:00:00Z' } }, Date.parse('2026-11-08T00:00:01Z')), true);
});
test('secure storage chunks long sessions and cleans old values', async () => {
  const values = new Map(); let id = 0;
  const store = { getItemAsync: async k => values.get(k) ?? null, setItemAsync: async (k,v) => { assert.ok(v.length <= 1000); values.set(k,v); }, deleteItemAsync: async k => values.delete(k) };
  const storage = createSecureStorage(store, () => String(++id));
  const session = 'token'.repeat(900);
  await storage.setItem('auth', session); assert.equal(await storage.getItem('auth'), session);
  await storage.setItem('auth', 'replacement'); assert.equal(await storage.getItem('auth'), 'replacement'); assert.equal(values.size, 2);
  await storage.removeItem('auth'); assert.equal(await storage.getItem('auth'), null); assert.equal(values.size, 0);
});
