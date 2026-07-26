import type { Hono } from 'hono';
import type { ApiEnv } from '../app';
import { ApiError } from '../errors/api-error';
export function mountOrganizations(app: Hono<ApiEnv>) {
  app.get('/organizations', async (c) => {
    const scope = c.get('scope'); const auth = scope.resolve('auth');
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) throw new ApiError('unauthorized', 'Authentication required');
    return c.json({ organizations: await scope.resolve('listOrganizations').execute(session.user.id) });
  });
}
