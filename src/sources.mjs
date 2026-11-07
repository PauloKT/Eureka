const API = {
  europepmc: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search',
  openalex: 'https://api.openalex.org/works',
  arxiv: 'https://export.arxiv.org/api/query',
  ntrs: 'https://ntrs.nasa.gov/api/citations/search',
};

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const nextRequestAt = new Map();
const providerGapMs = new Map([
  ['www.ebi.ac.uk', 1_000],       // conservative because no numeric EPMC limit was published in the reference checked
  ['export.arxiv.org', 3_000],    // arXiv API manual asks for 3 seconds between successive requests
  ['api.openalex.org', 250],      // local safety pacing; still bounded by the current shared OpenAlex daily/quota policy
  ['ntrs.nasa.gov', 1_000],       // conservative until NTRS publishes/confirm an anonymous rate limit
]);

async function pace(host) {
  const gap = providerGapMs.get(host);
  if (!gap) throw new Error('SOURCE_RATE_LIMIT_NOT_CONFIGURED');
  const now = Date.now();
  const waitUntil = Math.max(now, nextRequestAt.get(host) || now);
  nextRequestAt.set(host, waitUntil + gap);
  if (waitUntil > now) await new Promise(resolve => setTimeout(resolve, waitUntil - now));
}

async function readBounded(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) throw new Error('SOURCE_PAYLOAD_TOO_LARGE');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('SOURCE_EMPTY_RESPONSE');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('SOURCE_PAYLOAD_TOO_LARGE'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function requestText(url, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !Object.values(API).some(base => parsed.origin === new URL(base).origin)) {
    throw new Error('SOURCE_URL_NOT_ALLOWED');
  }
  await pace(parsed.hostname);
  const response = await fetchImpl(parsed, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error', headers: { Accept: 'application/json, application/atom+xml, application/xml' } });
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
  return readBounded(response);
}

function safeDate(value) {
  if (typeof value !== 'string') return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0,10) === day ? day : null;
}
function clean(value) { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''; }
function record(provider, fields) {
  return { provider, title: clean(fields.title), authors: fields.authors || [], publisher: clean(fields.publisher), publishedAt: safeDate(fields.publishedAt), updatedAt: safeDate(fields.updatedAt), identifier: clean(fields.identifier) || null, url: fields.url || null, abstract: clean(fields.abstract), editorialStatus: fields.editorialStatus || 'unknown', access: fields.access || 'metadata_only', collectedAt: new Date().toISOString() };
}
function httpsUrl(value, hostSuffix) {
  try { const u = new URL(value); return u.protocol === 'https:' && (u.hostname === hostSuffix || u.hostname.endsWith(`.${hostSuffix}`)) ? u.toString() : null; } catch { return null; }
}

export async function searchEuropePmc(query, { fetchImpl, limit = 10, now = new Date(), recencyDays = 90 } = {}) {
  const from = new Date(now.getTime() - recencyDays * 86400000).toISOString().slice(0, 10);
  query = `(${query.split(/\s+/).join(' OR ')}) AND FIRST_PDATE:[${from} TO ${now.toISOString().slice(0, 10)}] sort_date:y`;
  const url = new URL(API.europepmc); url.searchParams.set('query', query); url.searchParams.set('format', 'json'); url.searchParams.set('resultType', 'core'); url.searchParams.set('pageSize', String(Math.min(10, Math.max(1, limit))));
  const data = JSON.parse(await requestText(url, { fetchImpl }));
  if (!Array.isArray(data.results) && !Array.isArray(data.resultList?.result)) throw new Error('SOURCE_SCHEMA_INVALID');
  return (data.resultList?.result || []).map(x => record('europepmc', { title: x.title, authors: (x.authorList?.author || []).map(a => a.fullName).filter(Boolean), publisher: x.journalInfo?.journal?.title || x.journalTitle || 'Europe PMC record', publishedAt: x.firstPublicationDate || x.pubYear, updatedAt: x.firstIndexDate, identifier: x.doi || (x.pmid ? `pmid:${x.pmid}` : x.pmcid), url: x.doi ? `https://doi.org/${encodeURI(x.doi)}` : x.pmcid ? `https://europepmc.org/articles/${encodeURIComponent(x.pmcid)}` : x.pmid ? `https://europepmc.org/article/MED/${encodeURIComponent(x.pmid)}` : null, abstract: x.abstractText, editorialStatus: x.source === 'PPR' || x.pubTypeList?.pubType?.some(t => /preprint/i.test(t)) ? 'preprint' : 'unknown', access: x.isOpenAccess === 'Y' ? 'open_access' : 'abstract' }));
}

export async function searchOpenAlex(query, { fetchImpl, limit = 10, mailto, now = new Date(), recencyDays = 90 } = {}) {
  const url = new URL(API.openalex); url.searchParams.set('search', query); url.searchParams.set('per_page', String(Math.min(10, Math.max(1, limit)))); url.searchParams.set('select', 'id,doi,title,publication_date,updated_date,authorships,primary_location,open_access,abstract_inverted_index,type'); if (mailto) url.searchParams.set('mailto', mailto);
  url.searchParams.set('filter', `from_publication_date:${new Date(now.getTime()-recencyDays*86400000).toISOString().slice(0,10)},to_publication_date:${now.toISOString().slice(0,10)}`);
  url.searchParams.set('sort','publication_date:desc');
  const data = JSON.parse(await requestText(url, { fetchImpl }));
  if (!Array.isArray(data.results) && !Array.isArray(data.resultList?.result)) throw new Error('SOURCE_SCHEMA_INVALID');
  return (data.results || []).map(x => record('openalex', { title: x.title, authors: (x.authorships || []).map(a => a.author?.display_name).filter(Boolean), publisher: x.primary_location?.source?.display_name || 'OpenAlex index record', publishedAt: x.publication_date, updatedAt: x.updated_date, identifier: x.doi?.replace(/^https?:\/\/doi.org\//i,'') || x.id, url: httpsUrl(x.doi || x.id, 'doi.org') || httpsUrl(x.id, 'openalex.org'), abstract: restoreAbstract(x.abstract_inverted_index), editorialStatus: x.type === 'preprint' ? 'preprint' : 'unknown', access: x.open_access?.is_oa ? 'open_access_linked' : 'metadata_only' }));
}

function restoreAbstract(index) {
  if (!index || typeof index !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) return '';
    for (const position of positions) {
      if (!Number.isInteger(position) || position < 0 || position > 20000 || words[position] !== undefined) return '';
      words[position] = word;
    }
  }
  for (let i = 0; i < words.length; i++) if (words[i] === undefined) return '';
  return words.join(' ');
}

function xmlText(entry, tag) {
  const found = entry.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return found ? found[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim() : '';
}
export async function searchArxiv(query, { fetchImpl, limit = 10, now = new Date(), recencyDays = 90 } = {}) {
  const from = new Date(now.getTime() - recencyDays * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
  const to = now.toISOString().slice(0, 10).replaceAll('-', '');
  query = `(${query.split(/\s+/).map(word => word.includes(':') ? word : `all:${word}`).join(' OR ')}) AND submittedDate:[${from}0000 TO ${to}2359]`;
  const url = new URL(API.arxiv); url.searchParams.set('search_query', query); url.searchParams.set('start', '0'); url.searchParams.set('max_results', String(Math.min(10, Math.max(1, limit))));
  url.searchParams.set('sortBy', 'submittedDate'); url.searchParams.set('sortOrder', 'descending');
  const xml = await requestText(url, { fetchImpl });
  if (!/<feed[\s>]/i.test(xml) || /<id>https?:\/\/arxiv.org\/api\/errors/i.test(xml)) throw new Error('SOURCE_SCHEMA_INVALID');
  return [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map(([, e]) => {
    const id = xmlText(e, 'id').replace(/^http:/, 'https:');
    const published = xmlText(e, 'published');
    return record('arxiv', { title: xmlText(e, 'title'), authors: [...e.matchAll(/<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)].map(m => clean(m[1])), publisher: 'arXiv', publishedAt: published, updatedAt: xmlText(e, 'updated'), identifier: id.split('/abs/')[1] || id, url: httpsUrl(id, 'arxiv.org'), abstract: xmlText(e, 'summary'), editorialStatus: 'preprint', access: 'open_access' });
  });
}

export async function searchNasaNtrs(query, { fetchImpl, limit = 10, now = new Date(), recencyDays = 90 } = {}) {
  const url = new URL(API.ntrs); url.searchParams.set('q', query); url.searchParams.set('page.from', '0'); url.searchParams.set('page.size', String(Math.min(10, Math.max(1, limit))));
  url.searchParams.set('published.gte',new Date(now.getTime()-recencyDays*86400000).toISOString().slice(0,10));
  url.searchParams.set('published.lte',now.toISOString().slice(0,10));
  const data = JSON.parse(await requestText(url, { fetchImpl }));
  if (!Array.isArray(data.results) && !Array.isArray(data.resultList?.result)) throw new Error('SOURCE_SCHEMA_INVALID');
  return (data.results || []).slice(0, Math.min(10, Math.max(1,limit))).map(x => record('nasa_ntrs', { title: x.title, authors: (x.authorAffiliations || []).map(a => a.meta?.author?.name).filter(Boolean), publisher: 'NASA Technical Reports Server', publishedAt: x.publications?.[0]?.publicationDate || x.issueDate || x.publicationDate, updatedAt: x.modified, identifier: x.id ? `ntrs:${x.id}` : null, url: x.id ? `https://ntrs.nasa.gov/citations/${encodeURIComponent(x.id)}` : null, abstract: x.abstract, editorialStatus: 'unknown', access: x.downloadsAvailable ? 'open_access_linked' : 'abstract' }));
}

export const SOURCE_ENDPOINTS = Object.freeze({ ...API });
