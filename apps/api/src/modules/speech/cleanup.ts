import { Store, type Bindings } from '../../shared/persistence';

export async function cleanupExpiredAudio(env: Bindings) {
  const store=new Store(env);
  const candidates=await store.rpc('eureka_cleanup_candidates',{});
  let deleted=0,failed=0;
  for (const item of candidates) {
    try {
      const prefix=`${item.user_id}/${item.episode_id}/`;
      if (typeof item.audio?.storagePath!=='string' || !item.audio.storagePath.startsWith(prefix) ||
        !Number.isFinite(Date.parse(item.audio.expiresAt)) || Date.parse(item.audio.expiresAt)>Date.now()) throw new Error();
      await store.deleteAudio(item.audio.storagePath);
      await store.rpc('eureka_mark_audio_deleted',{p_episode:item.episode_id,p_operation:item.operation_id,p_path:item.audio.storagePath});
      deleted++;
    } catch { failed++; } // Retry next scheduled run; do not release capacity before confirmed removal.
  }
  return {deleted,failed};
}
