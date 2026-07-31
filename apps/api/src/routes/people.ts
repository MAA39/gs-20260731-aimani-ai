import { Hono } from 'hono';
import type { ApiEnv } from '../app';
import { ApiError } from '../errors/api-error';
import { listPeopleInputSchema } from '@aimani-ai/contracts';
export function createPeopleRoutes() {
  return new Hono<ApiEnv>().get('/organizations/:organizationId/people', async (c) => {
    const parsed = listPeopleInputSchema.safeParse({ organizationId: c.req.param('organizationId') });
    if (!parsed.success) throw new ApiError('validation_error', 'Invalid organization ID.');
    const scope = c.get('scope');
    const session = await (await scope.resolve('auth')).api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) throw new ApiError('unauthorized', 'Authentication required');
    const listPeople = await scope.resolve('listMembersForCurrentOrganization');
    return c.json({ people: await listPeople.execute(session.user.id, parsed.data.organizationId) });
  });
}
