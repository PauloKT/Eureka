// Explicit live test. Uses a dedicated Auth test account, never prints credentials.
// node scripts/testar-fluxo-online.mjs --generate [--theme=space]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createApi, createEpisodeFlow } from '../apps/mobile/src/api.mjs';
import { DiscoverySearchResponse } from '../packages/contracts/src/index.ts';
const root=new URL('../',import.meta.url), folder=new URL('.tools/live-test/',root);
const theme=process.argv.find(x=>x.startsWith('--theme='))?.split('=')[1] ?? 'space';
const generate=process.argv.includes('--generate');
const optionIndex=Number(process.argv.find(x=>x.startsWith('--option='))?.split('=')[1]??0);
const report={at:new Date().toISOString(),theme,checks:[]};
const note=(name,data={})=>{report.checks.push({name,...data});console.log(JSON.stringify({name,...data}));};
try {
  const env=parseEnv(await readFile(new URL('apps/api/.dev.vars',root),'utf8'));
  await mkdir(folder,{recursive:true});
  const secret=env.SUPABASE_SERVICE_ROLE_KEY;
  const adminHeaders={apikey:secret,'Content-Type':'application/json',...(!secret.startsWith('sb_secret_')?{Authorization:`Bearer ${secret}`}:{})};
  let account;
  try { account=JSON.parse(await readFile(new URL('account.json',folder),'utf8')); } catch {}
  if(!account) {
    const credentials={email:`eureka-smoke-${randomUUID()}@example.invalid`,password:randomUUID()+randomUUID()};
    const created=await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`,{method:'POST',headers:adminHeaders,body:JSON.stringify({...credentials,email_confirm:true,user_metadata:{purpose:'eureka-automated-smoke-test'}})});
    if(!created.ok) throw Error(`TEST_ACCOUNT_FAILED_${created.status}`);
    const user=await created.json(); account={...credentials,id:user.id};
    await writeFile(new URL('account.json',folder),JSON.stringify(account));
    note('dedicated-test-account-created');
  }
  const login=await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});
  if(!login.ok)throw Error(`LOGIN_FAILED_${login.status}`);
  const session=await login.json();
  const baseUrl='https://eureka-api.eureka-api.workers.dev/api/v1';
  const api=createApi({baseUrl,getToken:async()=>session.access_token});
  const stateFile=new URL(`flow-${theme}.json`,folder);
  let state={};try {state=JSON.parse(await readFile(stateFile,'utf8'));}catch{}
  const flow=createEpisodeFlow({api,userId:account.id,uuid:randomUUID,storage:{getItem:async k=>state[k]??null,setItem:async(k,v)=>{state[k]=v;await writeFile(stateFile,JSON.stringify(state));}}});
  assert.equal((await api('/me')).user.id,account.id);note('authenticated-api');
  const anonymous=await fetch(baseUrl+'/history');assert.equal(anonymous.status,401);note('anonymous-denied');
  const capabilities=await api('/capabilities',{publicRoute:true});note('capabilities',capabilities);
  let episode;
  const saved=await flow.load();
  if(saved?.episodeId && !process.argv.includes('--new-search')) {episode=await flow.open(saved.episodeId);note('episode-resumed',{state:episode.state});}
  else {
    note('search-started');
    const selection=DiscoverySearchResponse.parse(await api('/discovery-searches',{method:'POST',body:{themeId:theme}}));
    note('search-complete',{options:selection.options.length,partial:selection.partial,emptyReason:selection.emptyReason,titles:selection.options.map(o=>o.title)});
    await writeFile(new URL(`selection-${theme}.json`,folder),JSON.stringify(selection,null,2));
    if(generate && selection.options[optionIndex]) {episode=await flow.choose({mode:'chosen',selectionSetId:selection.selectionSetId,discoveryId:selection.options[optionIndex].id});note('episode-created',{id:episode.id,state:episode.state});}
  }
  if(generate && episode) {
    if(process.argv.includes('--retry') && episode.state==='failed') {
      episode=await flow.prepareRetry(episode.script?'audio':'script');note('corrective-retry-prepared',{state:episode.state});
    }
    if(episode.state==='selected') {note('script-started');episode=await flow.generate('script');note('script-complete',{state:episode.state});}
    if(episode.state==='script_ready') {note('audio-started');episode=await flow.generate('audio');note('audio-complete',{state:episode.state,durationSeconds:episode.audio?.durationSeconds});}
    await writeFile(new URL(`episode-${theme}.json`,folder),JSON.stringify(episode,null,2));
    if(episode.state!=='ready')throw Error(`EPISODE_NOT_READY_${episode.state}`);
    assert.ok(episode.audio.durationSeconds>0 && episode.audio.durationSeconds<=180);
    const {url}=await api(`/episodes/${episode.id}/audio-access`);
    const response=await fetch(url);assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
    await writeFile(new URL(`episode-${theme}.wav`,folder),bytes);note('private-wav-verified',{bytes:bytes.length,durationSeconds:episode.audio.durationSeconds});
    // Endpoint test in the isolated test account; this is not a claim of human listening.
    await api(`/episodes/${episode.id}/completion`,{method:'POST'});await api(`/episodes/${episode.id}/completion`,{method:'POST'});
    const history=await api('/history');assert.equal(history.items.filter(x=>x.episode_id===episode.id).length,1);note('completion-idempotency-and-history');
    const repeated=await flow.generate('audio');assert.equal(repeated.id,episode.id);note('ready-audio-reused');
  }
} catch(error) {
  note('failed',{code:error.code??(String(error.message).match(/^[A-Z_0-9]+$/)?error.message:'LIVE_TEST_FAILED')});process.exitCode=1;
} finally {await writeFile(new URL(`report-${theme}.json`,folder),JSON.stringify(report,null,2)).catch(()=>{});}
