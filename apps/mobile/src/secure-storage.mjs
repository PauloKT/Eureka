// Chunk sessions to stay below per-value platform limits. Publish the new index last.
export function createSecureStorage(store, uuid) {
  return {
    async getItem(key) {
      const raw = await store.getItemAsync(key);
      if (!raw) return null;
      const { version, count } = JSON.parse(raw);
      const parts = await Promise.all(Array.from({ length: count }, (_, i) => store.getItemAsync(`${key}.${version}.${i}`)));
      return parts.every(part => part !== null) ? parts.join('') : null;
    },
    async setItem(key, value) {
      const old = await store.getItemAsync(key);
      const version = uuid();
      const parts = value.match(/[\s\S]{1,500}/g) ?? [''];
      for (let i = 0; i < parts.length; i++) await store.setItemAsync(`${key}.${version}.${i}`, parts[i]);
      await store.setItemAsync(key, JSON.stringify({ version, count: parts.length }));
      if (old) {
        const previous = JSON.parse(old);
        await Promise.all(Array.from({ length: previous.count }, (_, i) => store.deleteItemAsync(`${key}.${previous.version}.${i}`).catch(() => {})));
      }
    },
    async removeItem(key) {
      const old = await store.getItemAsync(key);
      await store.deleteItemAsync(key);
      if (old) {
        const previous = JSON.parse(old);
        await Promise.all(Array.from({ length: previous.count }, (_, i) => store.deleteItemAsync(`${key}.${previous.version}.${i}`)));
      }
    },
  };
}
