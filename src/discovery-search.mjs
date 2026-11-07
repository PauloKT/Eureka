import { THEMES, searchTheme, rankCandidates } from './research.mjs';
import { DiscoverySearchResponse, ReviewedDiscovery, SelectionInput } from '../packages/contracts/src/index.ts';

export async function discoverySearch({ userId, themeId, providers, store, cache, prepareDiscovery, now = new Date(), recencyDays = 90 }) {
  if (!userId) throw new Error('SESSION_REQUIRED');
  if (!THEMES.includes(themeId)) throw new Error('INVALID_THEME');
  const cacheKey = `research-candidates:v1:${themeId}:${recencyDays}`;
  let result = await cache?.get(cacheKey);
  if (!result || !(Date.parse(result.cachedUntil) > now.getTime())) {
    result = await searchTheme(themeId, providers, { now, recencyDays });
    result.cachedUntil = new Date(now.getTime() + (result.partial ? 30_000 : 15 * 60_000)).toISOString();
    await cache?.set(cacheKey, result);
  }
  if (result.providerResults.every(x => x.status !== 'ok')) throw new Error('SOURCES_UNAVAILABLE');
  const history = await store.getCompletedStudyKeys(userId, themeId);
  const candidates = rankCandidates(result.providerResults.flatMap(x => x.records), { themeId, heardStudyKeys: history, now, recencyDays });
  const options = [];
  const alreadyHeard = new Map();
  const reviewStatus = new Map();
  for (const record of candidates) {
    if (options.length === 3) break;
    let packageEntry = await store.getEvidenceDiscovery(record.identifier, themeId);
    if (!packageEntry) {
      packageEntry = await prepareDiscovery?.(record, { themeId, userId });
      if (packageEntry) await store.saveEvidenceDiscovery(record.identifier, themeId, ReviewedDiscovery.parse(packageEntry));
    }
    if (!packageEntry) continue;
    const parsed = ReviewedDiscovery.safeParse(packageEntry);
    if (!parsed.success) continue;
    packageEntry = parsed.data;
    const discovery = packageEntry.discovery;
    if (discovery.themeId !== themeId || discovery.studyKey !== record.identifier || discovery.publishedAt !== record.publishedAt || Date.parse(packageEntry.expiresAt) <= now.getTime() || Date.parse(packageEntry.reviewedAt) > now.getTime()) continue;
    if (['health', 'brain'].includes(themeId) && packageEntry.reviewStatus === 'preprint') continue;
    if (options.some(x => x.id === discovery.id)) continue;
    options.push(discovery); alreadyHeard.set(discovery.id, history.includes(discovery.studyKey)); reviewStatus.set(discovery.id, packageEntry.reviewStatus);
  }
  const saved = await store.saveSelection(userId, SelectionInput.parse({ themeId, options }));
  if (!saved?.id || !saved?.expires_at) throw new Error('SELECTION_SAVE_FAILED');
  const body = { selectionSetId: saved.id, expiresAt: saved.expires_at, options: options.map(x => ({ id: x.id, themeId: x.themeId, title: x.title, summary: x.summary, publishedAt: x.publishedAt, reviewStatus: reviewStatus.get(x.id), alreadyHeard: alreadyHeard.get(x.id), sources: x.sources.map(s => ({ id: s.id, title: s.title, publisher: s.publisher, url: s.url, publishedAt: s.publishedAt })) })), partial: result.partial, emptyReason: options.length ? null : result.partial ? 'sources_unavailable_or_incomplete' : 'no_eligible_evidence' };
  return DiscoverySearchResponse.parse(body);
}

export function newEvidencePackageId() { return crypto.randomUUID(); }
