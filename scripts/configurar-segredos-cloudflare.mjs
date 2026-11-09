import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Send approved backend values over stdin, never command arguments or temporary files.
const root = new URL('../', import.meta.url);
try {
  const local = parseEnv(await readFile(new URL('apps/api/.dev.vars', root), 'utf8'));
  const names = ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','GEMINI_TEXT_MODEL','GEMINI_TTS_MODEL'];
  const secrets = Object.fromEntries(names.map(name => [name, local[name]?.trim()]));
  if (Object.values(secrets).some(value => !value)) throw new Error('MISSING_CONFIGURATION');
  const child = spawn(process.execPath, [fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js', root)), 'secret', 'bulk'], {
    cwd: fileURLToPath(new URL('apps/api/', root)),
    stdio: ['pipe','pipe','pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: fileURLToPath(new URL('.tools/wrangler-logs/', root)) },
  });
  // Provider errors can contain request details: do not print raw child output.
  child.stdout.resume(); child.stderr.resume();
  child.stdin.on('error', () => {});
  child.stdin.end(JSON.stringify(secrets));
  child.on('error', () => { console.error('SECRET_UPLOAD_FAILED'); process.exitCode = 1; });
  child.on('close', code => {
    console.log(code === 0 ? 'Backend secrets configured; values not displayed.' : 'SECRET_UPLOAD_FAILED');
    process.exitCode = code === 0 ? 0 : 1;
  });
} catch { console.error('CONFIGURATION_UNAVAILABLE'); process.exitCode = 1; }
