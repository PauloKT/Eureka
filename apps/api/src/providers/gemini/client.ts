import type { Bindings } from '../../shared/persistence';
import { AppError } from '../../shared/errors';

export async function generate(env: Bindings, model: string, body: unknown) {
  if (!env.GEMINI_API_KEY || env.LIVE_AI_ENABLED !== 'true' || !/^[a-z0-9.-]+$/.test(model)) throw new AppError('GENERATION_DISABLED');
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(body), signal: AbortSignal.timeout(90000), redirect: 'manual',
    });
  } catch { throw new AppError('PROVIDER_OUTCOME_UNKNOWN'); }
  if (response.status === 429) throw new AppError('QUOTA_EXHAUSTED', 429);
  if (!response.ok) {
    const error = await response.json().catch(() => null) as any;
    const message = String(error?.error?.message ?? 'Unavailable')
      .split(env.GEMINI_API_KEY).join('[redacted]')
      .replace(/https?:\/\/\S+/g, '[url]').slice(0, 800);
    console.warn(JSON.stringify({event:'provider-request-rejected',status:response.status,message}));
    throw new AppError('PROVIDER_UNAVAILABLE');
  }
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
  const schema = data && typeof data === 'object' && 'schema' in data ? data.schema : undefined;
  const result = await generate(env, model, {
    systemInstruction: { parts: [{ text: instruction }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
    generationConfig: { responseMimeType: 'application/json', ...(schema ? {responseJsonSchema:schema} : {}), maxOutputTokens: 6000, temperature: 0.2,
      ...(model === 'gemini-3.1-flash-lite' ? {thinkingConfig:{thinkingLevel:'minimal'}} : {}) },
  });
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') {
    console.warn(JSON.stringify({event:'model-output-rejected',reason:candidate?.finishReason ?? 'no-candidate'}));
    throw new AppError('SCRIPT_REJECTED', 422);
  }
  const text = candidate.content?.parts?.filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('');
  try { return JSON.parse(text); } catch { throw new AppError('SCRIPT_REJECTED', 422); }
}
