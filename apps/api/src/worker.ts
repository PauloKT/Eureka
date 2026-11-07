import app from './index';
import { cleanupExpiredAudio } from './modules/speech/cleanup';
import type { Bindings } from './shared/persistence';

export default {
  fetch: app.fetch,
  async scheduled(_event: unknown, env: Bindings) {
    try { console.log(JSON.stringify({event:'audio-cleanup',...await cleanupExpiredAudio(env)})); }
    catch { console.log(JSON.stringify({event:'audio-cleanup',status:'unavailable'})); }
  },
};
