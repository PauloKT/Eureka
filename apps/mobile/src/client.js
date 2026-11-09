import { createClient, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { createSecureStorage } from './secure-storage.mjs';
import { createApi } from './api.mjs';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
export const configError = !url?.startsWith('https://') || !key || !baseUrl?.startsWith('https://')
  ? 'Configure apps/mobile/.env com a URL da API e a URL/chave publicável do Supabase. Reinicie o Expo depois.' : null;
export const supabase = configError ? null : createClient(url, key, {
  auth: { storage: createSecureStorage(SecureStore, randomUUID), autoRefreshToken: true,
    persistSession: true, detectSessionInUrl: false, lock: processLock },
});
export const api = configError ? null : createApi({ baseUrl, getToken: async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token;
} });
