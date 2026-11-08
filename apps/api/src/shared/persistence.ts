import { AppError, errors, knownError } from './errors';
import { SelectionInput, ReviewedDiscovery, ThemeId } from '@eureka/contracts';

export type Bindings = {
  SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string;
  GEMINI_API_KEY?: string; GEMINI_TEXT_MODEL?: string; GEMINI_TTS_MODEL?: string;
  LIVE_AI_ENABLED?: string;
  RECENCY_DAYS?: string;
  AUTO_RESEARCH_ENABLED?: string;
};
export class Store {
  private base: URL;
  private headers: Record<string, string>;
  constructor(env: Bindings) {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key || !env.SUPABASE_URL) throw new AppError('STORAGE_UNAVAILABLE');
    this.base = new URL(env.SUPABASE_URL);
    if (this.base.protocol !== 'https:' || !this.base.hostname.endsWith('.supabase.co') || this.base.username || this.base.password) throw new AppError('STORAGE_UNAVAILABLE');
    this.headers = { apikey: key };
    if (!key.startsWith('sb_secret_')) this.headers.Authorization = `Bearer ${key}`;
  }
  async request(path: string, method = 'GET', body?: unknown): Promise<any> {
    try {
      const response = await fetch(new URL(path, this.base), {
        method, headers: { ...this.headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000), redirect: 'manual',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        if (error.message && errors[error.message]) throw knownError(error.message);
        throw new AppError('STORAGE_UNAVAILABLE');
      }
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) { if (error instanceof AppError) throw error; throw new AppError('STORAGE_UNAVAILABLE'); }
  }
  rpc(name: string, args: Record<string, unknown>) { return this.request(`/rest/v1/rpc/${name}`, 'POST', args); }
  async episode(userId: string, id: string) {
    const query = new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${userId}`, select: '*', limit: '1' });
    const rows = await this.request(`/rest/v1/eureka_episodes?${query}`);
    if (!Array.isArray(rows) || !rows[0]) throw knownError('NOT_FOUND');
    return rows[0];
  }
  // Internal integration point for Person 2. No public route accepts research payloads.
  async getCompletedStudyKeys(userId: string, themeId: string): Promise<string[]> {
    ThemeId.parse(themeId);
    const keys = new Set<string>();
    for (let offset = 0; ; offset += 1000) {
      const query = new URLSearchParams({ user_id: `eq.${userId}`, 'eureka_episodes.theme_id': `eq.${themeId}`,
        select: 'study_key,eureka_episodes!inner(theme_id)', order: 'episode_id.asc', limit: '1000', offset: String(offset) });
      const rows = await this.request(`/rest/v1/eureka_history?${query}`);
      if (!Array.isArray(rows)) throw knownError('STORAGE_UNAVAILABLE');
      for (const row of rows) keys.add(row.study_key);
      if (rows.length < 1000) return [...keys];
    }
  }
  async getEvidenceDiscovery(identifier: string, themeId: string) {
    const query = new URLSearchParams({ identifier: `eq.${identifier}`, theme_id: `eq.${ThemeId.parse(themeId)}`,
      expires_at: `gt.${new Date().toISOString()}`, select: 'payload', limit: '1' });
    const rows = await this.request(`/rest/v1/eureka_reviewed_discoveries?${query}`);
    if (!rows?.[0]) return null;
    const parsed = ReviewedDiscovery.safeParse(rows[0].payload);
    if (!parsed.success) throw knownError('STORAGE_UNAVAILABLE');
    return parsed.data;
  }
  // Administrative ingestion only; no public route exposes this method.
  async saveEvidenceDiscovery(identifier: string, themeId: string, input: unknown) {
    const payload = ReviewedDiscovery.parse(input);
    if (payload.discovery.themeId !== themeId || payload.discovery.studyKey !== identifier ||
      Date.parse(payload.expiresAt) <= Date.now() || Date.parse(payload.reviewedAt) > Date.now()) throw knownError('INVALID_INPUT');
    await this.upsertResearch('eureka_reviewed_discoveries', { identifier, theme_id: themeId, payload, expires_at: payload.expiresAt });
  }
  private async upsertResearch(table: string, body: unknown) {
    // PostgREST resolves the primary key; separate from request() to request upsert explicitly.
    try {
      const response = await fetch(new URL(`/rest/v1/${table}`, this.base), {
        method: 'POST', headers: { ...this.headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'manual',
      });
      if (!response.ok) throw knownError('STORAGE_UNAVAILABLE');
    } catch { throw knownError('STORAGE_UNAVAILABLE'); }
  }
  async getResearchCache(key: string) {
    const query = new URLSearchParams({ cache_key: `eq.${key}`, expires_at: `gt.${new Date().toISOString()}`, select: 'payload', limit: '1' });
    const rows = await this.request(`/rest/v1/eureka_research_cache?${query}`);
    return rows?.[0]?.payload ?? null;
  }
  async saveResearchCache(key: string, payload: { cachedUntil: string }) {
    if (!Number.isFinite(Date.parse(payload.cachedUntil))) throw knownError('INVALID_INPUT');
    await this.upsertResearch('eureka_research_cache', { cache_key: key, payload, expires_at: payload.cachedUntil });
  }
  async claimResearchSource(provider: string) { return (await this.rpc('eureka_claim_source', {p_provider: provider})) === true; }

  async saveSelection(userId: string, input: unknown) {
    const data = SelectionInput.parse(input);
    const rows = await this.request('/rest/v1/eureka_selections', 'POST', { user_id: userId, theme_id: data.themeId, options: data.options });
    return rows[0];
  }
  async upload(path: string, audio: Uint8Array) {
    try {
      const response = await fetch(new URL(`/storage/v1/object/eureka-audio/${path}`, this.base), {
        method: 'POST', headers: { ...this.headers, 'Content-Type': 'audio/wav', 'x-upsert': 'false' },
        body: audio as unknown as BodyInit, signal: AbortSignal.timeout(30000), redirect: 'manual',
      });
      if (!response.ok) throw new AppError('STORAGE_UNAVAILABLE');
    } catch { throw new AppError('STORAGE_UNAVAILABLE'); }
  }
  async signedUrl(path: string) {
    if (!/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9]+\.wav$/.test(path)) throw new AppError('STORAGE_UNAVAILABLE');
    const result = await this.request(`/storage/v1/object/sign/eureka-audio/${path}`, 'POST', { expiresIn: 300 });
    if (typeof result?.signedURL !== 'string') throw new AppError('STORAGE_UNAVAILABLE');
    const url = new URL(result.signedURL.startsWith('/object/') ? `/storage/v1${result.signedURL}` : result.signedURL, this.base);
    if (url.origin !== this.base.origin) throw new AppError('STORAGE_UNAVAILABLE');
    return { url: url.toString(), expiresIn: 300 };
  }
  async operation(userId: string, episodeId: string, stage: string) {
    await this.episode(userId, episodeId);
    const query = new URLSearchParams({ episode_id: `eq.${episodeId}`, stage: `eq.${stage}`, select: '*', limit: '1' });
    const rows = await this.request(`/rest/v1/eureka_operations?${query}`);
    if (!rows?.[0]) throw knownError('NOT_FOUND');
    return rows[0];
  }
  async storedAudioMatches(path: string, length: number, digest: string) {
    const { url } = await this.signedUrl(path);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'manual' });
      if (!response.ok || !response.body || length < 44 || length > 20000000) throw new Error();
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const {value,done} = await reader.read(); if (done) break; size += value.length;
        if (size > length) { await reader.cancel(); throw new Error(); } chunks.push(value); }
      if (size !== length) throw new Error();
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
      const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b=>b.toString(16).padStart(2,'0')).join('');
      if (actual !== digest) throw new Error();
    } catch { throw new AppError('PROVIDER_OUTCOME_UNKNOWN'); }
  }
  async deleteAudio(path: string) {
    if (!/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9]+\.wav$/.test(path)) throw new AppError('STORAGE_UNAVAILABLE');
    await this.request('/storage/v1/object/eureka-audio', 'DELETE', { prefixes: [path] });
  }
}
