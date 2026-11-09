export const THEMES = Object.freeze(['space', 'health', 'brain', 'technology', 'nature', 'physics']);
export const THEME_QUERIES = Object.freeze({
  space: { primary: ['nasa_ntrs', 'arxiv'], query: 'space science astronomy astrophysics', queries: { arxiv:'cat:astro-ph.*' } },
  health: { primary: ['europepmc'], query: 'health clinical biomedical research' },
  brain: { primary: ['europepmc'], query: 'brain neuroscience cognition' },
  technology: { primary: ['arxiv', 'openalex'], query: 'technology engineering computer science', queries: { arxiv:'cat:cs.AI cat:cs.RO cat:cs.LG cat:cs.HC cat:eess.*' } },
  nature: { primary: ['europepmc', 'openalex'], query: 'ecology biodiversity environmental biology' },
  physics: { primary: ['arxiv', 'openalex'], query: 'physics', queries: { arxiv:'cat:quant-ph cat:cond-mat.* cat:physics.*' } },
});
const DAY = 86_400_000;
const isoDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0,10) === v;
const normalizeUrl = raw => { try { const u = new URL(raw); if (u.protocol !== 'https:') return null; u.hash = ''; return u.toString().replace(/\/$/, ''); } catch { return null; } };
const key = x => (x.identifier || '').replace(/^https?:\/\/(doi\.org\/)?/i, '').toLowerCase().trim();
const titleKey = x => (x.title || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function deduplicate(records) {
  const seenIds = new Set(), seenUrls = new Set(), seenTitles = new Set(), result = [];
  for (const item of records) {
    const id = key(item), url = normalizeUrl(item.url), title = titleKey(item);
    if ((id && seenIds.has(id)) || (url && seenUrls.has(url)) || (title && seenTitles.has(title))) continue;
    if (id) seenIds.add(id); if (url) seenUrls.add(url); if (title) seenTitles.add(title);
    result.push({ ...item, url });
  }
  return result;
}

export function eligibility(record, { themeId, now = new Date(), recencyDays = 90 } = {}) {
  if (!THEMES.includes(themeId)) return { eligible: false, reason: 'unknown_theme' };
  if (!record.title || !record.abstract || !record.url || !record.identifier) return { eligible: false, reason: 'insufficient_source_content' };
  if (!isoDay(record.publishedAt)) return { eligible: false, reason: 'publication_date_unknown' };
  const published = Date.parse(`${record.publishedAt}T00:00:00Z`), today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  if (published > today) return { eligible: false, reason: 'publication_date_in_future' };
  if (published < today - recencyDays * DAY) return { eligible: false, reason: 'outside_recency_window' };
  if ((themeId === 'health' || themeId === 'brain') && record.editorialStatus === 'preprint') return { eligible: false, reason: 'preprint_excluded_for_theme' };
  return { eligible: true, reason: null };
}

export function rankCandidates(records, { themeId, heardStudyKeys = [], now = new Date(), recencyDays = 90, limit = Infinity } = {}) {
  const eligible = records.map(item => ({ ...item, url: normalizeUrl(item.url) })).filter(item => eligibility(item, { themeId, now, recencyDays }).eligible);
  const deduped = deduplicate(eligible).map(item => ({ item }));
  const heard = new Set(heardStudyKeys);
  return deduped.sort((a, b) => Number(heard.has(a.item.studyKey || a.item.identifier)) - Number(heard.has(b.item.studyKey || b.item.identifier)) || b.item.publishedAt.localeCompare(a.item.publishedAt)).slice(0, Math.max(0, limit)).map(x => ({ ...x.item, alreadyHeard: heard.has(x.item.studyKey || x.item.identifier) }));
}

export async function searchTheme(themeId, providers, options = {}) {
  const definition = THEME_QUERIES[themeId];
  if (!definition) throw new Error('INVALID_THEME');
  const settled = await Promise.all(definition.primary.map(async provider => {
    if (typeof providers[provider] !== 'function') return { provider, status: 'unconfigured', records: [] };
    try { return { provider, status: 'ok', records: await providers[provider](definition.queries?.[provider] ?? definition.query, { limit: 10, now: options.now ?? new Date(), recencyDays: options.recencyDays ?? 90 }) }; }
    catch (error) { return { provider, status: 'failed', records: [], error: error instanceof Error ? error.message : 'SOURCE_UNAVAILABLE' }; }
  }));
  return { themeId, providerResults: settled, partial: settled.some(x => x.status !== 'ok'), options: rankCandidates(settled.flatMap(x => x.records), { ...options, themeId }) };
}
