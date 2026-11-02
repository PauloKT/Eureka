import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

try {
  const env = parseEnv(await readFile(new URL('../apps/api/.dev.vars', import.meta.url), 'utf8'));
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) throw new Error('CONFIG_MISSING');
  const url = new URL(env.SUPABASE_URL);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password) throw new Error('INVALID_PROJECT_URL');
  const response = await fetch(new URL('/auth/v1/settings', url), {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
    signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  console.log(JSON.stringify({ service: 'supabase-auth', status: response.status, reachable: response.ok }));
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.log(['CONFIG_MISSING', 'INVALID_PROJECT_URL'].includes(error.message) ? error.message : 'CONNECTION_FAILED');
  process.exitCode = 1;
}
