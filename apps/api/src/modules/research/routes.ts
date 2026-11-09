import { Hono } from 'hono';
import { DiscoverySearchInput, DiscoverySearchResponse } from '@eureka/contracts';
import { requireSession, type AuthEnvironment } from '../auth/session';
import { Store } from '../../shared/persistence';
import { knownError } from '../../shared/errors';
import { prepareDiscoveries } from './prepare';
import { discoverySearch } from '../../../../../src/discovery-search.mjs';
import { searchEuropePmc, searchArxiv, searchOpenAlex, searchNasaNtrs } from '../../../../../src/sources.mjs';

export const researchRoutes = new Hono<AuthEnvironment>();
researchRoutes.post('/discovery-searches', requireSession, async c => {
  const { themeId } = DiscoverySearchInput.parse(await c.req.json().catch(() => null));
  const recencyDays = Number(c.env.RECENCY_DAYS ?? 90);
  if (!Number.isInteger(recencyDays) || recencyDays < 1 || recencyDays > 365) throw knownError('RESEARCH_UNAVAILABLE');
  const store = new Store(c.env);
  const provider = (name: string, search: typeof searchEuropePmc) => async (query: string, options: {limit: number}) => {
    if (!await store.claimResearchSource(name)) throw new Error('SOURCE_BUSY');
    return search(query, {...options, recencyDays});
  };
  const body = await discoverySearch({
    userId: c.get('userId'), themeId, recencyDays, store,
    providers: { europepmc: provider('europepmc', searchEuropePmc), arxiv: provider('arxiv', searchArxiv),
      openalex: provider('openalex', searchOpenAlex), nasa_ntrs: provider('nasa_ntrs', searchNasaNtrs) },
    cache: { get: key => store.getResearchCache(key), set: (key, value) => store.saveResearchCache(key, value) },
    prepareDiscoveries: (records: any[], context: {themeId:string;userId:string}) => prepareDiscoveries(c.env,store,records,context),
  }).catch(error => {
    if (error instanceof Error && error.message === 'SOURCES_UNAVAILABLE') throw knownError('RESEARCH_UNAVAILABLE');
    throw error;
  });
  return c.json(DiscoverySearchResponse.parse(body));
});
