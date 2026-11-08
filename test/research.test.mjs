import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, THEME_QUERIES, eligibility, deduplicate, rankCandidates, searchTheme } from '../src/research.mjs';
import { searchEuropePmc, searchOpenAlex, searchArxiv, searchNasaNtrs, SOURCE_ENDPOINTS, requestText } from '../src/sources.mjs';
import { createEvidencePackage, buildDiscovery, auditScriptReferences } from '../src/evidence.mjs';
import { discoverySearch } from '../src/discovery-search.mjs';

const valid = (extra = {}) => ({ title: 'Ensino de Ciência', identifier: 'doi:10.5555/test', url: 'https://doi.org/10.5555/test', publisher: 'Journal', publishedAt: '2026-10-01', abstract: 'O estudo observou uma associação em adultos. O tamanho da amostra foi limitado.', editorialStatus: 'peer_reviewed', access: 'abstract', studyKey: 'doi:10.5555/test', ...extra });
test('NASA uses real nested publication fields and numeric identifiers without claiming peer review',async()=>{
  const [r] = await searchNasaNtrs('space',{limit:1,now:new Date('2026-11-07T00:00:00Z'),fetchImpl:async url=>{
    assert.equal(url.searchParams.get('page.size'),'1');assert.equal(url.searchParams.get('published.gte'),'2026-08-09');
    return Response.json({results:[{id:20260000001,title:'Test',publications:[{publicationDate:'2026-10-20T00:00:00Z'}],abstract:'Test abstract',modified:'2026-11-06',technicalReviewType:'TECHNICAL_REVIEW_TYPE_NONE',authorAffiliations:[{meta:{author:{name:'Test author'}}}]}]});
  }});
  assert.equal(r.identifier,'ntrs:20260000001');assert.equal(r.publishedAt,'2026-10-20');assert.equal(r.editorialStatus,'unknown');assert.deepEqual(r.authors,['Test author']);
});
test('OpenAlex reconstructs available abstracts and requests a bounded date window',async()=>{
  const [r] = await searchOpenAlex('physics',{now:new Date('2026-11-07T00:00:00Z'),fetchImpl:async url=>{
    assert.match(url.searchParams.get('filter'),/from_publication_date:2026-08-09/);
    return Response.json({results:[{id:'https://openalex.org/W1',doi:'https://doi.org/10.1/test',title:'Test',publication_date:'2026-11-01',type:'preprint',abstract_inverted_index:{Test:[0],evidence:[1]}}]});
  }});
  assert.equal(r.abstract,'Test evidence');assert.equal(r.identifier,'10.1/test');assert.equal(r.editorialStatus,'preprint');
});
test('mantém os seis temas e os provedores previstos por tema', () => {
  assert.deepEqual(THEMES, ['space','health','brain','technology','nature','physics']);
  for (const theme of THEMES) assert.ok(THEME_QUERIES[theme].primary.length > 0);
});
test('elegibilidade exclui datas ausentes, futuras, antigas e preprints em saúde/cérebro', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  assert.equal(eligibility(valid({ publishedAt: null }), { themeId:'physics', now }).reason, 'publication_date_unknown');
  assert.equal(eligibility(valid({ publishedAt:'2026-11-08' }), { themeId:'physics', now }).reason, 'publication_date_in_future');
  assert.equal(eligibility(valid({ publishedAt:'2026-01-01' }), { themeId:'physics', now }).reason, 'outside_recency_window');
  assert.equal(eligibility(valid({ editorialStatus:'preprint' }), { themeId:'health', now }).reason, 'preprint_excluded_for_theme');
  assert.equal(eligibility(valid({ editorialStatus:'preprint' }), { themeId:'space', now }).eligible, true);
});
test('deduplicates by identifier, canonical URL, then normalized title', () => {
  assert.equal(deduplicate([valid(), valid({ identifier:'DOI:10.5555/test', title:'Outro', url:'https://example.org/other' }), valid({ identifier:'other', title:'Ensino de Ciência', url:'https://example.org/third' })]).length, 1);
});
test('history only affects ordering and does not remove previously heard candidates', () => {
  const a = valid({ publishedAt:'2026-11-05', studyKey:'heard' }); const b = valid({ identifier:'doi:10.5555/second', url:'https://doi.org/10.5555/second', title:'Outra descoberta', publishedAt:'2026-11-04', studyKey:'new' });
  const ranked = rankCandidates([a,b], { themeId:'physics', heardStudyKeys:['heard'], now:new Date('2026-11-07T00:00:00Z') });
  assert.deepEqual(ranked.map(x=>x.studyKey), ['new','heard']); assert.equal(ranked[1].alreadyHeard, true);
});
test('provider failures are represented as partial failures, not empty proof', async () => {
  const result = await searchTheme('physics', { arxiv: async()=>{ throw Error('timeout'); }, openalex: async()=>[] });
  assert.equal(result.partial, true); assert.equal(result.providerResults.find(x=>x.provider==='arxiv').status, 'failed');
});
test('Europe PMC adapter maps publication metadata and never treats missing date as a date', async () => {
  const fetchImpl = async url => {assert.ok(!url.searchParams.get('query').includes('sort_date'));assert.match(url.searchParams.get('query'),/HAS_ABSTRACT:Y/);return new Response(JSON.stringify({ resultList:{result:[{title:'Study',authorList:{author:[{fullName:'A Author'}]},journalTitle:'Journal',firstPublicationDate:'2026-11-01',doi:'10.1/a',abstractText:'Abstract',isOpenAccess:'Y',pubTypeList:{pubType:['Journal Article']}}]}}));};
  const [r] = await searchEuropePmc('brain', { fetchImpl }); assert.equal(r.publishedAt,'2026-11-01'); assert.equal(r.editorialStatus,'unknown'); assert.equal(r.access,'open_access');
});
test('OpenAlex maps only metadata; it does not claim an abstract or editorial review', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({results:[{title:'Work',doi:'https://doi.org/10.1/x',publication_date:'2026-11-02',updated_date:'2026-11-03',authorships:[],primary_location:{source:{display_name:'Journal'}},open_access:{is_oa:true}}]}));
  const [r] = await searchOpenAlex('physics', { fetchImpl }); assert.equal(r.editorialStatus,'unknown'); assert.equal(r.abstract,''); assert.equal(r.publishedAt,'2026-11-02'); assert.equal(r.updatedAt,'2026-11-03');
});
test('arXiv marks records as preprints and preserves submitted versus updated dates', async () => {
  const xml = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2601.12345v2</id><title> A paper </title><published>2026-01-02T00:00:00Z</published><updated>2026-02-01T00:00:00Z</updated><summary>An abstract.</summary><author><name>Author One</name></author></entry></feed>';
  const [r] = await searchArxiv('cat:astro-ph', { fetchImpl: async()=>new Response(xml) }); assert.equal(r.editorialStatus,'preprint'); assert.equal(r.publishedAt,'2026-01-02'); assert.equal(r.updatedAt,'2026-02-01');
});
test('requests reject redirection, oversized bodies and URLs outside the allowlist', async () => {
  await assert.rejects(requestText('https://127.0.0.1/private'), /SOURCE_URL_NOT_ALLOWED/);
  await assert.rejects(requestText(SOURCE_ENDPOINTS.europepmc, { fetchImpl: async()=>new Response('', {status:302}) }), /SOURCE_HTTP_302/);
  const body = new Uint8Array(1_000_001);
  await assert.rejects(requestText(SOURCE_ENDPOINTS.europepmc, { fetchImpl: async()=>new Response(body) }), /SOURCE_PAYLOAD_TOO_LARGE/);
});
test('evidence package retains only verified excerpts and rejects invented quotations', async () => {
  const record = valid(); const pkg = await createEvidencePackage(record,{excerpts:[{id:'a',text:'O estudo observou uma associação em adultos.'}]});
  assert.equal(pkg.source.contentHash.length,64);
  await assert.rejects(createEvidencePackage(record,{excerpts:['frase que não aparece'] }), /EXCERPT_NOT_VERIFIABLE/);
  const refs = [{sourceId:pkg.source.id, excerptId:'a'}];
  assert.throws(()=>buildDiscovery({themeId:'physics',title:'x',summary:'y',record,packageData:pkg,result:{text:'x',references:refs},evidence:{text:'y',references:refs},limitation:{text:'z',references:refs}}), /HUMAN_EVIDENCE_REVIEW_REQUIRED/);
  const d = buildDiscovery({themeId:'physics',title:'x',summary:'y',record,packageData:pkg,result:{text:'x',references:refs},evidence:{text:'y',references:refs},limitation:{text:'z',references:refs},reviewedByHuman:true}); assert.equal(d.eligible,true);
});
test('script audit rejects citations that do not resolve to retained evidence', () => {
  const audit = auditScriptReferences({claims:[{id:'c1',text:'claim',references:[{sourceId:'bad',excerptId:'x'}]}],evidenceCard:{result:{references:[]},evidence:{references:[]},limitation:{references:[]}}},[]);
  assert.equal(audit.supported,false);
});
test('search handler uses user history, saves a real Store selection, and returns no fabricated choices', async () => {
  const savedInput = []; let id = 'fa33b9c2-80f3-4fc5-9e22-2f3cf9043ad9';
  const store = { getCompletedStudyKeys: async()=>[], saveSelection: async(_u,input)=>{ savedInput.push(input); return {id,expires_at:'2026-11-08T00:00:00.000Z'}; } };
  const result = await discoverySearch({userId:'user-1',themeId:'space',providers:{nasa_ntrs:async()=>[],arxiv:async()=>[]},store,prepareDiscovery:async()=>null,now:new Date('2026-11-07T00:00:00Z')});
  assert.deepEqual(result.options,[]); assert.equal(savedInput[0].themeId,'space'); assert.equal(result.emptyReason,'no_eligible_evidence');
  await assert.rejects(discoverySearch({themeId:'space',providers:{},store}), /SESSION_REQUIRED/);
});
