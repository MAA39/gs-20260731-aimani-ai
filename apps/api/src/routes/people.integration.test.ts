import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

const databaseUrl = process.env.TEST_DATABASE_URL;
const env = { DATABASE_URL: databaseUrl, BETTER_AUTH_SECRET: 'integration-secret-at-least-32-chars', BETTER_AUTH_URL: 'http://localhost:8787' };

describe('People API tenant boundary', () => {
  it('rejects a user requesting another organization', async () => {
    const app = createApp();
    const signIn = await app.fetch(new Request('http://localhost:8787/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'sato@amidala.local', password: 'amidala-demo-2026' }) }), env);
    const cookies = signIn.headers.getSetCookie();
    const response = await app.fetch(new Request('http://localhost:8787/organizations/org_northstar_lab/people', { headers: { cookie: cookies.join('; ') } }), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'forbidden', message: 'This organization is not available to this user.' } });
  });
});
