import { createMiddleware } from 'hono/factory';
import type { Bindings } from '../../shared/persistence';

export type AuthEnvironment = {
  Bindings: Bindings;
  Variables: { userId: string };
};

export const requireSession = createMiddleware<AuthEnvironment>(async (c, next) => {
  const fail = (code: string, message: string, status: 401 | 503) => c.json({ error: {
    code, message, retryable: status === 503,
    retryAfterSeconds: null, requestId: crypto.randomUUID(),
  } }, status);
  const authorization = c.req.header('Authorization');
  if (!authorization || !/^Bearer [^\s]+$/i.test(authorization)) {
    return fail('UNAUTHORIZED', 'Entre na sua conta para continuar.', 401);
  }
  const base = c.env?.SUPABASE_URL;
  const key = c.env?.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) { console.warn(JSON.stringify({event:'auth-unavailable',reason:'missing-config'})); return fail('AUTH_UNAVAILABLE', 'Autenticação indisponível.', 503); }
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.endsWith('.supabase.co')) {
      console.warn(JSON.stringify({event:'auth-unavailable',reason:'invalid-project-url'}));
      return fail('AUTH_UNAVAILABLE', 'Autenticação indisponível.', 503);
    }
    // Ask Supabase to validate the token; never trust a client-supplied user ID.
    const response = await fetch(new URL('/auth/v1/user', url), {
      headers: { apikey: key, Authorization: authorization },
      signal: AbortSignal.timeout(10000), redirect: 'manual',
    });
    if (response.status === 401 || response.status === 403) {
      return fail('UNAUTHORIZED', 'Sessão inválida ou expirada. Entre novamente.', 401);
    }
    if (!response.ok) { console.warn(JSON.stringify({event:'auth-unavailable',reason:'upstream-http',status:response.status})); return fail('AUTH_UNAVAILABLE', 'Autenticação temporariamente indisponível.', 503); }
    const user: unknown = await response.json();
    if (!user || typeof user !== 'object' || !('id' in user) || typeof user.id !== 'string' || !user.id) {
      console.warn(JSON.stringify({event:'auth-unavailable',reason:'invalid-user-response'}));
      return fail('AUTH_UNAVAILABLE', 'Não foi possível validar a sessão.', 503);
    }
    c.set('userId', user.id);
  } catch {
    console.warn(JSON.stringify({event:'auth-unavailable',reason:'request-or-json-failed'}));
    return fail('AUTH_UNAVAILABLE', 'Autenticação temporariamente indisponível.', 503);
  }
  await next();
});
