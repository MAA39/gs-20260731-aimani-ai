import { Hono } from 'hono';
import { createTodoBodySchema, personTodoPathSchema } from '@amidala/contracts';
import type { ApiEnv } from '../app';
import { ApiError } from '../errors/api-error';
import type { CreateSharedTodo } from '../application/create-todo';
import type { GetSharedTodoWorkspace } from '../application/list-shared-todos';

export function createTodoRoutes() {
  return new Hono<ApiEnv>()
    .post('/organizations/:organizationId/people/:contextMembershipId/todos', async (context) => {
      const path = personTodoPathSchema.safeParse(context.req.param());
      if (!path.success) throw new ApiError('validation_error', 'Invalid path.');
      const body = createTodoBodySchema.safeParse(await context.req.json());
      if (!body.success) throw new ApiError('validation_error', 'Invalid Todo.');
      const session = await (await context.get('scope').resolve('auth')).api.getSession({ headers: context.req.raw.headers });
      if (!session?.user) throw new ApiError('unauthorized', 'Authentication required');
      const useCase = await context.get('scope').resolve<CreateSharedTodo>('createSharedTodo');
      return context.json({ todo: await useCase.execute(session.user.id, { ...path.data, ...body.data }) }, 201);
    })
    .get('/organizations/:organizationId/people/:contextMembershipId/todos', async (context) => {
      const path = personTodoPathSchema.safeParse(context.req.param());
      if (!path.success) throw new ApiError('validation_error', 'Invalid path.');
      const session = await (await context.get('scope').resolve('auth')).api.getSession({ headers: context.req.raw.headers });
      if (!session?.user) throw new ApiError('unauthorized', 'Authentication required');
      const useCase = await context.get('scope').resolve<GetSharedTodoWorkspace>('getSharedTodoWorkspace');
      return context.json(await useCase.execute(session.user.id, path.data));
    });
}
