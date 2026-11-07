import { THEMES, searchTheme, rankCandidates } from './research.mjs';
import { DiscoverySearchResponse } from './public-contract.mjs';

export async function discoverySearch({ userId, themeId, providers, store, cache, prepareDiscovery, now = new Date() }) {
  if (!userId) throw new Error('SESSION_REQUIRED');
  if (!THEMES.includes(themeId)) throw new Error('INVALID_THEME');
  const cacheKey = `research-candidates:${themeId}`;
  let result = await cache?.get(cacheKey);
  if (!result || Date.parse(result.cachedUntil) <= now.getTime()) {
    result = await searchTheme(themeId, providers, { now });
    result.cachedUntil = new Date(now.getTime() + 15 * 60_000).toISOString();
    await cache?.set(cacheKey, result);
  }
  const history = await store.getCompletedStudyKeys(userId, themeId);
  result.options = rankCandidates(result.providerResults.flatMap(x => x.records), { themeId, heardStudyKeys: history, now });
  const options = [];
  const alreadyHeard = new Map();
  const reviewStatus = new Map();
  for (const record of result.options) {
    if (options.length === 3) break;
    let packageEntry = await store.getEvidenceDiscovery?.(record.identifier);
    if (!packageEntry) {
      packageEntry = await prepareDiscovery?.(record, { themeId, userId });
      if (packageEntry) await store.saveEvidenceDiscovery?.(record.identifier, packageEntry);
    }
    const discovery = packageEntry?.discovery;
    if (discovery) { options.push(discovery); alreadyHeard.set(discovery.id, history.includes(discovery.studyKey)); reviewStatus.set(discovery.id, packageEntry.reviewStatus || 'unknown'); }
  }
  const saved = await store.saveSelection(userId, { themeId, options });
  if (!saved?.id || !saved?.expires_at) throw new Error('SELECTION_SAVE_FAILED');
  const body = { selectionSetId: saved.id, expiresAt: saved.expires_at, options: options.map(x => ({ id: x.id, themeId: x.themeId, title: x.title, summary: x.summary, publishedAt: x.publishedAt, reviewStatus: reviewStatus.get(x.id), alreadyHeard: alreadyHeard.get(x.id), sources: x.sources.map(s => ({ id: s.id, title: s.title, publisher: s.publisher, url: s.url, publishedAt: s.publishedAt })) })), partial: result.partial, emptyReason: options.length ? null : result.partial ? 'sources_unavailable_or_incomplete' : 'no_eligible_evidence' };
  return DiscoverySearchResponse.parse(body);
}

export function newEvidencePackageId() { return crypto.randomUUID(); }
