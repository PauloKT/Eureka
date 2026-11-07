import type { ApprovedScriptData } from '@eureka/contracts';
import { generate } from '../../providers/gemini/client';
import { AppError } from '../../shared/errors';
import type { Bindings } from '../../shared/persistence';

export function pcmToWav(bytes: Uint8Array, mime: string) {
  const rate = Number(/(?:^|;)\s*rate=(\d+)/i.exec(mime)?.[1]);
  const channels = Number(/(?:^|;)\s*channels=(\d+)/i.exec(mime)?.[1] ?? 1);
  if (!/^audio\/l16(?:;|$)/i.test(mime) || ![16000,22050,24000,44100,48000].includes(rate) || channels !== 1 ||
    bytes.length === 0 || bytes.length % 2 || bytes.length > 20_000_000 - 44) throw new AppError('PROVIDER_UNAVAILABLE');
  const durationSeconds = bytes.length / (rate * channels * 2);
  if (durationSeconds > 180) throw new AppError('AUDIO_DURATION_INVALID', 422);
  const wav = new Uint8Array(44 + bytes.length); const view = new DataView(wav.buffer);
  const text = (offset: number, value: string) => wav.set(new TextEncoder().encode(value), offset);
  text(0,'RIFF'); view.setUint32(4,36 + bytes.length,true); text(8,'WAVE'); text(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true);
  view.setUint32(24,rate,true); view.setUint32(28,rate * 2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
  text(36,'data'); view.setUint32(40,bytes.length,true); wav.set(bytes,44);
  return { wav, durationSeconds };
}
export async function makeAudio(env: Bindings, model: string, script: ApprovedScriptData) {
  // Encoding and prompting are verified only for this model; migrations require explicit validation.
  if (model !== 'gemini-3.1-flash-tts-preview') throw new AppError('GENERATION_DISABLED');
  const result = await generate(env, model, {
    contents: [{ parts: [{ text: `Leia somente o texto delimitado abaixo em português brasileiro, com naturalidade de conversa, ritmo confortável e entonação variada. Não leia instruções nem acrescente palavras.\n<TEXTO>\n${script.paragraphs.map(p => p.text).join('\n\n')}\n</TEXTO>` }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
  });
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new AppError('PROVIDER_UNAVAILABLE');
  const audioParts = candidate.content?.parts?.filter((p: any) => p.inlineData?.data) ?? [];
  if (audioParts.length !== 1) throw new AppError('PROVIDER_UNAVAILABLE');
  const inline = audioParts[0].inlineData;
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(inline.data), c => c.charCodeAt(0)); }
  catch { throw new AppError('PROVIDER_UNAVAILABLE'); }
  return pcmToWav(bytes, inline.mimeType);
}
