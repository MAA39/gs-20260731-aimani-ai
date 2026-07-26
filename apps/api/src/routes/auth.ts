import type { Hono } from 'hono';
import type { ApiEnv } from '../app';
export function mountAuth(app: Hono<ApiEnv>) { app.on(['GET', 'POST'], '/api/auth/*', (c) => c.get('scope').resolve('auth').handler(c.req.raw)); }
