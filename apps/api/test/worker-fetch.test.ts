import { afterEach, expect, it, vi } from 'vitest';
import { generate } from '../src/providers/gemini/client';
import { Store } from '../src/shared/persistence';
afterEach(()=>vi.unstubAllGlobals());
it('Gemini and database requests reject redirects using a Workers-supported mode',async()=>{
  const mock=vi.fn(async (_url:unknown,init:RequestInit)=>{expect(init.redirect).toBe('manual');return new Response(null,{status:307,headers:{Location:'https://untrusted.example'}});});
  vi.stubGlobal('fetch',mock);
  await expect(generate({LIVE_AI_ENABLED:'true',GEMINI_API_KEY:'test'},'test-model',{})).rejects.toThrow('PROVIDER_UNAVAILABLE');
  await expect(new Store({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test'}).request('/rest/v1/test')).rejects.toThrow('STORAGE_UNAVAILABLE');
  expect(mock).toHaveBeenCalledTimes(2);
});
