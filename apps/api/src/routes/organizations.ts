import type { Hono } from 'hono';
import type { ApiEnv } from '../app';
import { ApiError } from '../errors/api-error';
export function mountOrganizations(app: Hono<ApiEnv>) {
  app.get('/organizations', async (c) => {
    const scope = c.get('scope'); const auth = await scope.resolve('auth');
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) throw new ApiError('unauthorized', 'Authentication required');
    const listOrganizationMembershipsForUser = await scope.resolve('listOrganizationMembershipsForUser');
    return c.json({ organizationMemberships: await listOrganizationMembershipsForUser.execute(session.user.id) });
  });
}
