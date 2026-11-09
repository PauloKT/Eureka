import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe('API inicial', () => {
  it('não anuncia IA disponível antes da validação e integração', async () => {
    const response = await app.request('/api/v1/capabilities');
    expect(await response.json()).toEqual({
      textEnabled: false, speechEnabled: false, followupsEnabled: false,
    });
  });

  it('preserva os seis temas exigidos pelo app', async () => {
    const response = await app.request('/api/v1/themes');
    const body = await response.json() as { themes: { id: string }[] };
    expect(body.themes.map((theme) => theme.id)).toEqual([
      'space', 'health', 'brain', 'technology', 'nature', 'physics',
    ]);
  });

  it('não simula geração de episódio ainda não implementada', async () => {
    const response = await app.request('/api/v1/episodes', { method: 'POST' });
    expect(response.status).toBe(401);
  });
});
