import { Hono } from 'hono';
import { requireSession, type AuthEnvironment } from './modules/auth/session';
import { episodeRoutes } from './modules/episodes/routes';
import { researchRoutes } from './modules/research/routes';
import { AppError, errors } from './shared/errors';
import { ZodError } from 'zod';
import { bodyLimit } from 'hono/body-limit';

// Fundação do Marco 0. Não anunciar geração antes da integração completa.
const app = new Hono<AuthEnvironment>();
app.use('*', bodyLimit({ maxSize: 8192, onError: c => c.json({ error: { code: 'INVALID_INPUT', message: 'Requisição muito grande.', retryable: false, retryAfterSeconds: null, requestId: crypto.randomUUID() } }, 413) }));

app.get('/api/v1/me', requireSession, (c) => c.json({ user: { id: c.get('userId') } }));

app.get('/api/v1/health', (c) => c.json({ status: 'ok', service: 'eureka-api' }));
app.get('/api/v1/capabilities', (c) => {
  const env = c.env ?? {};
  const enabled = env.LIVE_AI_ENABLED === 'true' && Boolean(env.GEMINI_API_KEY && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  return c.json({
    textEnabled: enabled && Boolean(env.GEMINI_TEXT_MODEL),
    speechEnabled: enabled && env.GEMINI_TTS_MODEL === 'gemini-3.1-flash-tts-preview',
    followupsEnabled: false,
  });
});
app.get('/api/v1/themes', (c) => c.json({ themes: [
  { id: 'space', name: 'Espaço' },
  { id: 'health', name: 'Saúde' },
  { id: 'brain', name: 'Cérebro' },
  { id: 'technology', name: 'Tecnologia' },
  { id: 'nature', name: 'Natureza' },
  { id: 'physics', name: 'Física' },
] }));

app.route('/api/v1', researchRoutes);
app.route('/api/v1', episodeRoutes);

app.notFound((c) => c.json({ error: {
  code: 'NOT_FOUND', message: 'Recurso não encontrado.', retryable: false,
  retryAfterSeconds: null, requestId: crypto.randomUUID(),
} }, 404));
app.onError((error, c) => {
  if (error instanceof ZodError || error instanceof AppError) {
    const code = error instanceof ZodError ? 'INVALID_INPUT' : error.code;
    const info = errors[code] ?? errors.PROVIDER_UNAVAILABLE;
    return c.json({ error: { code, message: info.message, retryable: false, retryAfterSeconds: null, requestId: crypto.randomUUID() } }, info.status);
  }
  return c.json({ error: {
  code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a operação.',
  retryable: false, retryAfterSeconds: null, requestId: crypto.randomUUID(),
} }, 500);
});

export default app;
