import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadEpisode } from '../src/download.mjs';
const episode={id:'11111111-1111-4111-8111-111111111111',state:'ready',audio:{expiresAt:'2026-11-10T00:00:00Z'}};
function setup({cancel=false,broken=false,writeFails=false}={}) {
  const calls=[];let temp;
  const destination={exists:true,delete:()=>calls.push('delete-destination'),write:async bytes=>{calls.push('write');assert.equal(new TextDecoder().decode(bytes),'RIFF0000WAVE0000');if(writeFails)throw Error('DISK_FULL');}};
  class File {
    constructor(){temp=this;this.exists=false;this.uri='file:///cache/audio.wav';this.size=100;}
    static async downloadFileAsync(url,file){calls.push(['download',url]);file.exists=true;}
    async bytes(){return new TextEncoder().encode(broken?'not a wave file':'RIFF0000WAVE0000');}
    async copy(){throw Error('SAF overwrite-copy must not be used');}
    delete(){calls.push('delete-cache');this.exists=false;}
  }
  const deps={File,Paths:{cache:'file:///cache/'},platform:'android',now:()=>Date.parse('2026-11-08T00:00:00Z'),
    Directory:{pickDirectoryAsync:async()=>{calls.push('pick');if(cancel)throw Error('User cancelled');return {createFile:()=>{calls.push('create');return destination;}};}},
    api:async path=>{calls.push(path);return {url:'https://storage.example/audio?token=test'};},
    Sharing:{isAvailableAsync:async()=>true,shareAsync:async()=>calls.push('share')},
  };
  return {deps,calls};
}
test('downloads existing audio to chosen Android folder without generation or completion calls',async()=>{
  const {deps,calls}=setup();assert.equal(await downloadEpisode(episode,deps),'saved');
  assert.ok(calls.includes('write'));assert.equal(calls.at(-1),'delete-cache');
  assert.deepEqual(calls.filter(x=>typeof x==='string'&&x.startsWith('/')), [`/episodes/${episode.id}/audio-access`]);
});
test('cancel or expired audio never downloads a file',async()=>{
  const {deps,calls}=setup({cancel:true});assert.equal(await downloadEpisode(episode,deps),'cancelled');assert.deepEqual(calls,['pick']);
  await assert.rejects(downloadEpisode({...episode,audio:{expiresAt:'2026-01-01'}},deps),/não está disponível/);
  assert.deepEqual(calls,['pick']);
});
test('invalid content and failed writes clean temporary and incomplete files',async()=>{
  const bad=setup({broken:true});await assert.rejects(downloadEpisode(episode,bad.deps),/WAV válido/);assert.ok(!bad.calls.includes('create'));assert.equal(bad.calls.at(-1),'delete-cache');
  const failed=setup({writeFails:true});await assert.rejects(downloadEpisode(episode,failed.deps),{code:'DOWNLOAD_WRITE'});assert.ok(failed.calls.includes('delete-destination'));assert.equal(failed.calls.at(-1),'delete-cache');
});
test('iOS offers the downloaded file through the native share sheet',async()=>{
  const {deps,calls}=setup();assert.equal(await downloadEpisode(episode,{...deps,platform:'ios'}),'shared');assert.ok(calls.includes('share'));assert.ok(!calls.includes('pick'));
});
