import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverySearch } from '../src/discovery-search.mjs';
import { createEvidencePackage, buildDiscovery } from '../src/evidence.mjs';
import { SelectionInput } from '../packages/contracts/src/index.ts';
const now = new Date('2026-11-07T00:00:00Z');
const record = i => ({identifier:`study-${i}`, title:`Study ${i}`, url:`https://example.org/${i}`, publishedAt:'2026-11-01', abstract:'Explicit test evidence only.', publisher:'Test', editorialStatus:'unknown'});
async function reviewed(r, themeId) {
  const pkg = await createEvidencePackage(r, {excerpts:['Explicit test evidence only.']});
  const text = {text:'Test only', references:[{sourceId:pkg.source.id, excerptId:'abstract-1'}]};
  return {discovery:buildDiscovery({themeId, title:r.title, summary:'Test',record:r,packageData:pkg,result:text,evidence:text,limitation:text,reviewedByHuman:true}), reviewStatus:'unknown', reviewedBy:'test-reviewer',reviewedAt:'2026-11-06T00:00:00Z',expiresAt:'2026-11-08T00:00:00Z'};
}
function store(entries = new Map()) { return {
  getCompletedStudyKeys: async () => [],
  getEvidenceDiscovery: async (id, theme) => entries.get(`${id}:${theme}`),
  saveEvidenceDiscovery: async (id, theme, value) => { entries.set(`${id}:${theme}`,value); },
  saveSelection: async (_u, input) => { SelectionInput.parse(input); return {id:crypto.randomUUID(),expires_at:'2026-11-08T00:00:00Z'}; },
}; }
test('same paper has separate reviewed discoveries for physics and technology', async () => {
  const r = record(0), entries = new Map();
  entries.set(`${r.identifier}:physics`, await reviewed(r, 'physics'));
  entries.set(`${r.identifier}:technology`, await reviewed(r, 'technology'));
  const result = await discoverySearch({userId:'user',themeId:'technology',providers:{arxiv:async()=>[r],openalex:async()=>[]},store:store(entries),now});
  assert.equal(result.options.length,1); assert.equal(result.options[0].themeId,'technology');
});
test('fourth candidate is reviewed when first three lack evidence', async () => {
  const records = [0,1,2,3].map(record), visited = [];
  const result = await discoverySearch({userId:'user',themeId:'physics',providers:{arxiv:async()=>records,openalex:async()=>[]},store:store(),now,
    prepareDiscovery:async r => {visited.push(r.identifier); return r.identifier === 'study-3' ? reviewed(r,'physics') : null;}});
  assert.deepEqual(visited,records.map(r=>r.identifier)); assert.equal(result.options.length,1);
});
test('wrong-theme and expired snapshots are not returned', async () => {
  const r = record(0), wrong = await reviewed(r,'physics');
  const s = store(); s.getEvidenceDiscovery = async()=>wrong;
  const args = {userId:'user',themeId:'technology',providers:{arxiv:async()=>[r]},store:s,now};
  assert.equal((await discoverySearch(args)).options.length,0);
  wrong.discovery.themeId='technology'; wrong.expiresAt='2026-11-06T12:00:00Z';
  assert.equal((await discoverySearch(args)).options.length,0);
});
test('stop after three approved discoveries and strip private evidence', async () => {
  const result = await discoverySearch({userId:'user',themeId:'physics',providers:{arxiv:async()=>[0,1,2,3,4].map(record)},store:store(),now,prepareDiscovery:r=>reviewed(r,'physics')});
  assert.equal(result.options.length,3); assert.equal(result.emptyReason,null);
  assert.equal(JSON.stringify(result).includes('excerpts'),false); assert.equal(JSON.stringify(result).includes('reviewedBy'),false);
});

test('automatic batch is prepared once, saved and reused without human input', async () => {
  const records=[0,1,2].map(record), entries=new Map(), s=store(entries); let calls=0;
  const args={userId:'user',themeId:'physics',providers:{arxiv:async()=>records},store:s,now,
    prepareDiscoveries:async rs=>{calls++;return Promise.all(rs.map(async r=>({...await reviewed(r,'physics'),reviewMethod:'automated',reviewedBy:'automated:test'})));}};
  const first=await discoverySearch(args);assert.equal(first.options.length,3);assert.equal(first.options[0].evidenceReview,'automated');
  const second=await discoverySearch(args);assert.equal(second.options.length,3);assert.equal(calls,1);
});

test('evidence approved during a slow search is returned in that first response',async t=>{
  const initial=Date.parse('2026-11-07T00:00:00Z');let clock=initial;
  t.mock.method(Date,'now',()=>clock);
  const r=record(0);
  const result=await discoverySearch({userId:'user',themeId:'physics',now:new Date(initial),providers:{arxiv:async()=>[r]},store:store(),
    prepareDiscoveries:async()=>{clock+=30000;const item=await reviewed(r,'physics');item.reviewedAt=new Date(clock).toISOString();return [item];}});
  assert.equal(result.options.length,1);
});

test('expired stored packages are renewed in a batch instead of suppressing preparation', async () => {
  const records = [0,1,2].map(record), entries = new Map();
  for (const r of records) entries.set(`${r.identifier}:physics`, {...await reviewed(r,'physics'), expiresAt:'2026-11-06T12:00:00Z'});
  let calls = 0;
  const args = {userId:'user', themeId:'physics', providers:{arxiv:async()=>records,openalex:async()=>[]}, store:store(entries), now,
    prepareDiscoveries:async rs => { calls++; assert.equal(rs.length,3); return Promise.all(rs.map(r=>reviewed(r,'physics'))); }};
  assert.equal((await discoverySearch(args)).options.length,3);
  assert.equal((await discoverySearch(args)).options.length,3);
  assert.equal(calls,1);
});

test('invalid stored packages allow individual preparation', async () => {
  const r = record(0), entries = new Map([[`${r.identifier}:physics`, {invalid:true}]]);
  let calls = 0;
  const result = await discoverySearch({userId:'user',themeId:'physics',providers:{arxiv:async()=>[r],openalex:async()=>[]},store:store(entries),now,
    prepareDiscovery: async item => {calls++; return reviewed(item,'physics');}});
  assert.equal(result.options.length,1);
  assert.equal(calls,1);
});
