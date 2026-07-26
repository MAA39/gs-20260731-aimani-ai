import type { Hono } from 'hono';
import type { ApiEnv } from '../app';
export function mountAuth(app: Hono<ApiEnv>) { app.on(['GET', 'POST'], '/api/auth/*', async (c) => (await c.get('scope').resolve('auth')).handler(c.req.raw)); }
