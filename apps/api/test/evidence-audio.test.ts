import { describe, expect, it } from 'vitest';
import { Discovery, ScriptCandidate } from '@eureka/contracts';
import { validateReferences } from '../src/modules/scripts/generate';
import { pcmToWav } from '../src/modules/speech/audio';

const sourceId = '11111111-1111-4111-8111-111111111111';
const references = [{ sourceId, excerptId: 'e1' }];
const card = { result: {text:'Resultado de teste',references}, evidence: {text:'Evidência de teste',references}, limitation:{text:'Limitação de teste',references} };
const discovery = Discovery.parse({ id: sourceId, themeId:'space', title:'Fixture',summary:'Fixture',publishedAt:'2026-11-01',studyKey:'test',topicKey:'test',eligible:true,evidencePackageId:sourceId,evidenceCard:card,
  sources:[{id:sourceId,title:'Fixture',url:'https://example.org/test',publisher:'Fixture',publishedAt:'2026-11-01',contentHash:'test',excerpts:[{id:'e1',text:'Material fictício exclusivo para teste.'}]}] });
const script = () => ScriptCandidate.parse({title:'Teste',paragraphs:[{id:'p1',text:'Resultado de teste.',claimIds:['c1']}], claims:[{id:'c1',text:'Resultado de teste.',references}],evidenceCard:card});

describe('evidências', () => {
  it('rejeita referência inexistente', () => {
    const value = script(); value.claims[0].references[0].excerptId = 'invented';
    expect(() => validateReferences(value,discovery)).toThrow('SCRIPT_REJECTED');
  });
  it('rejeita parágrafo com afirmação não declarada', () => {
    const value = script(); value.paragraphs[0].claimIds = ['missing'];
    expect(() => validateReferences(value,discovery)).toThrow('SCRIPT_REJECTED');
  });
  it('aceita apenas a integridade referencial; revisão semântica é outra etapa', () => {
    expect(() => validateReferences(script(),discovery)).not.toThrow();
  });
});
describe('áudio', () => {
  it('mede duração por amostras e cria WAV válido', () => {
    const { wav,durationSeconds } = pcmToWav(new Uint8Array(48000),'audio/l16; rate=24000; channels=1');
    expect(durationSeconds).toBe(1);
    expect(new TextDecoder().decode(wav.slice(0,4))).toBe('RIFF');
    expect(new DataView(wav.buffer).getUint32(40,true)).toBe(48000);
  });
  it('rejeita mais de três minutos sem truncar', () => {
    expect(() => pcmToWav(new Uint8Array(48000*181),'audio/l16; rate=24000')).toThrow('AUDIO_DURATION_INVALID');
  });
  it('rejeita formato desconhecido e amostra incompleta', () => {
    expect(() => pcmToWav(new Uint8Array(4),'audio/mp3')).toThrow();
    expect(() => pcmToWav(new Uint8Array(3),'audio/l16; rate=24000')).toThrow();
  });
});
