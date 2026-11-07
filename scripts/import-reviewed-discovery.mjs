import { readFile } from 'node:fs/promises';
import { ReviewedDiscovery } from '../packages/contracts/src/index.ts';
const args = process.argv.slice(2);
if (!args[0] || args.some((x, i) => i > 0 && x !== '--write')) throw new Error('Usage: node scripts/import-reviewed-discovery.mjs reviewed.json [--write]');
const payload = ReviewedDiscovery.parse(JSON.parse(await readFile(args[0], 'utf8')));
if (Date.parse(payload.expiresAt) <= Date.now() || Date.parse(payload.reviewedAt) > Date.now()) throw new Error('Review is expired or in the future');
if (!args.includes('--write')) {
  console.log('Valid editorial snapshot. Dry run only; nothing uploaded.');
} else {
  const base = new URL(process.env.SUPABASE_URL || '');
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') || base.username || base.password || !secret) throw new Error('Missing or invalid server configuration');
  const headers = {apikey:secret, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal'};
  if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;
  const response = await fetch(new URL('/rest/v1/eureka_reviewed_discoveries',base), {
    method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(15000),
    body:JSON.stringify({identifier:payload.discovery.studyKey,theme_id:payload.discovery.themeId,payload,expires_at:payload.expiresAt}),
  });
  if (!response.ok) throw new Error(`Snapshot upload failed (${response.status})`);
  console.log('Reviewed snapshot stored.');
}
