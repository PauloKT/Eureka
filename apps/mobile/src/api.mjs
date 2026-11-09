export class ApiError extends Error {
  constructor(code, message, status = 0, retryAfterSeconds = null) {
    super(message); this.code = code; this.status = status; this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function createApi({ baseUrl, getToken, fetchImpl = fetch, timeoutMs = 240000 }) {
  const base = baseUrl.replace(/\/+$/, '');
  if (!base.startsWith('https://')) throw new Error('A API precisa de um endereço HTTPS.');
  return async function request(path, { method = 'GET', body, key, publicRoute = false } = {}) {
    const token = publicRoute ? null : await getToken();
    if (!publicRoute && !token) throw new ApiError('UNAUTHORIZED', 'Entre na sua conta para continuar.', 401);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(base + path, {
        method, signal: controller.signal,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(data?.error?.code ?? 'HTTP_ERROR', data?.error?.message ?? 'Não foi possível concluir. Tente consultar novamente.', response.status, data?.error?.retryAfterSeconds);
      if (!data) throw new ApiError('INVALID_RESPONSE', 'O serviço respondeu em um formato inesperado.');
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('NETWORK_ERROR', 'Conexão interrompida. Consulte o estado antes de retomar; sua tentativa foi preservada.');
    } finally { clearTimeout(timer); }
  };
}

export const formatDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value.split('-').reverse().join('/') : 'Data não informada';
export const stageFor = episode => episode?.script ? 'audio' : 'script';
export const audioExpired = (episode, now = Date.now()) => !episode?.audio || !Number.isFinite(Date.parse(episode.audio.expiresAt)) || Date.parse(episode.audio.expiresAt) <= now;

// One persisted key per user intent. A failed request never creates a replacement key.
export function createEpisodeFlow({ api, storage, userId, uuid }) {
  const storageKey = `eureka.flow.${userId}`;
  let active;
  let locked = false;
  const save = async value => { await storage.setItem(storageKey, JSON.stringify(value)); active = value; return value; };
  const load = async () => {
    if (active) return active;
    const raw = await storage.getItem(storageKey);
    active = raw ? JSON.parse(raw) : null;
    return active;
  };
  const exclusive = task => async (...args) => {
    if (locked) throw new ApiError('BUSY', 'Aguarde a operação atual.');
    locked = true;
    try { return await task(...args); } finally { locked = false; }
  };
  return {
    load,
    choose: exclusive(async choice => {
      const old = await load();
      const same = old && JSON.stringify(old.choice) === JSON.stringify(choice);
      const intent = same ? old : await save({ choice, createKey: uuid(), keys: {}, episodeId: null });
      if (intent.episodeId) return (await api(`/episodes/${intent.episodeId}`)).episode;
      const { episode } = await api('/episodes', { method: 'POST', body: intent.choice, key: intent.createKey });
      await save({ ...intent, episodeId: episode.id });
      return episode;
    }),
    open: exclusive(async id => {
      const { episode } = await api(`/episodes/${id}`);
      const old = await load();
      if (old?.episodeId !== id) await save({ episodeId: id, keys: {}, choice: null, createKey: null });
      return episode;
    }),
    generate: exclusive(async stage => {
      const intent = await load();
      if (!intent?.episodeId) throw new ApiError('NO_EPISODE', 'Escolha uma descoberta primeiro.');
      const { episode } = await api(`/episodes/${intent.episodeId}`);
      if ((stage === 'script' && episode.script) || (stage === 'audio' && episode.state === 'ready')) return episode;
      if (episode.state !== (stage === 'script' ? 'selected' : 'script_ready')) throw new ApiError('INVALID_STATE', 'Consulte ou recupere a etapa atual antes de gerar.');
      const next = intent.keys[stage] ? intent : await save({ ...intent, keys: { ...intent.keys, [stage]: uuid() } });
      return (await api(`/episodes/${intent.episodeId}/${stage}`, { method: 'POST', key: next.keys[stage] })).episode;
    }),
    recover: exclusive(async stage => {
      const intent = await load();
      return (await api(`/episodes/${intent.episodeId}/recover`, { method: 'POST', body: { stage } })).episode;
    }),
    prepareRetry: exclusive(async stage => {
      const intent = await load();
      const { episode } = await api(`/episodes/${intent.episodeId}/retry`, { method: 'POST', body: { stage } });
      // Only the server's explicit retry permission permits a new generation key.
      await save({ ...intent, keys: { ...intent.keys, [stage]: uuid() } });
      return episode;
    }),
  };
}
