import { afterEach, expect, it, vi } from 'vitest';
import { generate, generateJson } from '../src/providers/gemini/client';
import { z } from 'zod';
import { ScriptCandidate } from '@eureka/contracts';
import { Store } from '../src/shared/persistence';
afterEach(()=>vi.unstubAllGlobals());
it('sends a compact output grammar but retains full script constraints for local validation',async()=>{
  const schema=z.toJSONSchema(ScriptCandidate);
  vi.stubGlobal('fetch',vi.fn(async (_url,init)=>{
    const body=JSON.parse(init.body);
    const ref=body.generationConfig.responseJsonSchema.properties.claims.items.properties.references.items.properties.sourceId;
    expect(ref).toEqual({type:'string'});
    expect(body.generationConfig.responseJsonSchema.required).toContain('evidenceCard');
    expect(JSON.parse(body.contents[0].parts[0].text).schema).toEqual(schema);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]});
  }));
  await expect(generateJson({LIVE_AI_ENABLED:'true',GEMINI_API_KEY:'test'},'test-model','Generate',{schema})).resolves.toEqual({});
  expect(ScriptCandidate.safeParse({}).success).toBe(false);
});
it('Gemini and database requests reject redirects using a Workers-supported mode',async()=>{
  const mock=vi.fn(async (_url:unknown,init:RequestInit)=>{expect(init.redirect).toBe('manual');return new Response(null,{status:307,headers:{Location:'https://untrusted.example'}});});
  vi.stubGlobal('fetch',mock);
  await expect(generate({LIVE_AI_ENABLED:'true',GEMINI_API_KEY:'test'},'test-model',{})).rejects.toThrow('PROVIDER_UNAVAILABLE');
  await expect(new Store({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test'}).request('/rest/v1/test')).rejects.toThrow('STORAGE_UNAVAILABLE');
  expect(mock).toHaveBeenCalledTimes(2);
});
