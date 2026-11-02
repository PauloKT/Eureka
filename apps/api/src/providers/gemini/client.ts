import type { Bindings } from '../../shared/persistence';
import { AppError } from '../../shared/errors';

export async function generate(env: Bindings, model: string, body: unknown) {
  if (!env.GEMINI_API_KEY || env.LIVE_AI_ENABLED !== 'true' || !/^[a-z0-9.-]+$/.test(model)) throw new AppError('GENERATION_DISABLED');
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(body), signal: AbortSignal.timeout(90000), redirect: 'error',
    });
  } catch { throw new AppError('PROVIDER_OUTCOME_UNKNOWN'); }
  if (response.status === 429) throw new AppError('QUOTA_EXHAUSTED', 429);
  if (!response.ok) throw new AppError('PROVIDER_UNAVAILABLE');
  try {
    // Bound memory before decoding base64. A 180s mono 24kHz WAV fits this limit.
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 28_000_000) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { throw new AppError('PROVIDER_OUTCOME_UNKNOWN'); }
}

export async function generateJson(env: Bindings, model: string, instruction: string, data: unknown) {
  const result = await generate(env, model, {
    systemInstruction: { parts: [{ text: instruction }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 6000, temperature: 0.2 },
  });
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new AppError('SCRIPT_REJECTED', 422);
  const text = candidate.content?.parts?.filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('');
  try { return JSON.parse(text); } catch { throw new AppError('SCRIPT_REJECTED', 422); }
}
