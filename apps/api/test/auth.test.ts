import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test-key' };
const request = () => new Request('https://api.example/api/v1/me?userId=attacker', {
  headers: { Authorization: 'Bearer test-token' },
});
afterEach(() => vi.unstubAllGlobals());

describe('sessão do aplicativo Expo', () => {
  it('nega acesso sem token antes de consultar serviços', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect((await app.request('/api/v1/me', {}, env)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('usa apenas a identidade validada no Supabase', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'verified-user', email: 'private@example.test' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await app.fetch(request(), env);
    expect(await response.json()).toEqual({ user: { id: 'verified-user' } });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });
  it('rejeita sessão expirada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    expect((await app.fetch(request(), env)).status).toBe(401);
  });
  it('distingue indisponibilidade de senha/token inválido e não vaza erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret internal details')));
    const response = await app.fetch(request(), env);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret internal');
  });
  it('falha com segurança sem configuração', async () => {
    expect((await app.fetch(request(), {})).status).toBe(503);
  });
});
