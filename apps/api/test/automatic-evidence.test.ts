import { afterEach, expect, it, vi } from 'vitest';
import { assembleEvidence, prepareDiscoveries, type Candidate } from '../src/modules/research/prepare';
import { Store } from '../src/shared/persistence';
import { generateJson } from '../src/providers/gemini/client';
vi.mock('../src/providers/gemini/client',()=>({generateJson:vi.fn()}));
const record:Candidate={identifier:'test-source',title:'Test study',abstract:'Researchers observed a change in the laboratory. The study used ten samples. Results cannot establish causality.',url:'https://example.org/study',publisher:'Test journal',publishedAt:new Date().toISOString().slice(0,10),editorialStatus:'preprint'};
const item={candidateIndex:0,title:'Estudo em laboratório',summary:'Mudança observada em dez amostras, sem estabelecer causalidade.',result:{text:'Foi observada uma mudança.',excerptIds:['s0']},evidence:{text:'Foram usadas dez amostras.',excerptIds:['s1']},limitation:{text:'Não estabelece causalidade.',excerptIds:['s2']}};
const batch={discoveries:[item]}, audit={reviews:[{candidateIndex:0,supported:true,relevant:true,checkedFields:['title','summary','result','evidence','limitation'] as any,issues:[]}]};
afterEach(()=>vi.clearAllMocks());
it('builds automated evidence with server-owned source metadata and verified quotations',async()=>{
  const entries=await assembleEvidence([record],batch,audit,'physics','test-model');
  expect(entries).toHaveLength(1);expect(entries[0].reviewMethod).toBe('automated');expect(entries[0].reviewStatus).toBe('preprint');
  expect(entries[0].discovery.sources[0].url).toBe(record.url);
  expect(entries[0].discovery.evidenceCard.limitation.references[0].excerptId).toBe('s2');
});
it('rejects invented quotations, duplicate IDs and missing audit entries',async()=>{
  await expect(assembleEvidence([record],{discoveries:[{...item,result:{text:'Inventado',excerptIds:['s999']}}]},audit,'physics','model')).rejects.toThrow('SCRIPT_REJECTED');
  await expect(assembleEvidence([record],{discoveries:[item,item]},audit,'physics','model')).rejects.toThrow('SCRIPT_REJECTED');
  await expect(assembleEvidence([record],batch,{reviews:[]},'physics','model')).rejects.toThrow('SCRIPT_REJECTED');
});
it('semantic rejection, wrong theme and preprints in health/brain never become options',async()=>{
  for(const theme of ['health','brain']) expect(await assembleEvidence([record],batch,audit,theme,'model')).toEqual([]);
  for(const change of [{supported:false},{relevant:false},{issues:['Unsupported causal claim']},{checkedFields:['title']}])
    expect(await assembleEvidence([record],batch,{reviews:[{...audit.reviews[0],...change}] as any},'physics','model')).toEqual([]);
});
it('reserves two shared calls before any AI work and never sends user identity',async()=>{
  const rpc=vi.fn().mockResolvedValue({complete:false});
  vi.mocked(generateJson).mockResolvedValueOnce(batch).mockResolvedValueOnce(audit);
  const entries=await prepareDiscoveries({AUTO_RESEARCH_ENABLED:'true',LIVE_AI_ENABLED:'true',GEMINI_API_KEY:'test',GEMINI_TEXT_MODEL:'test-model'},{rpc} as unknown as Store,[record],{themeId:'physics',userId:'private-user'});
  expect(entries).toHaveLength(1);expect(rpc.mock.calls[0][0]).toBe('eureka_begin_research');
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(generateJson).mock.invocationCallOrder[0]);
  expect(JSON.stringify(vi.mocked(generateJson).mock.calls.map(c=>c[3]))).not.toContain('private-user');
  expect(rpc.mock.calls[1][0]).toBe('eureka_finish_research');
});
it('cached result makes no AI call and exhausted quota stops before the provider',async()=>{
  const env={AUTO_RESEARCH_ENABLED:'true',LIVE_AI_ENABLED:'true',GEMINI_API_KEY:'test',GEMINI_TEXT_MODEL:'test-model'};
  expect(await prepareDiscoveries(env,{rpc:vi.fn().mockResolvedValue({complete:true,result:[]})} as any,[record],{themeId:'physics',userId:'user'})).toEqual([]);
  await expect(prepareDiscoveries(env,{rpc:vi.fn().mockRejectedValue(new Error('QUOTA_EXHAUSTED'))} as any,[record],{themeId:'physics',userId:'user'})).rejects.toThrow('QUOTA_EXHAUSTED');
  expect(generateJson).not.toHaveBeenCalled();
});
