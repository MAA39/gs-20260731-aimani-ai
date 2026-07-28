import { Hono } from 'hono';
import type { Context } from 'hono';
import { completeTodoPathSchema, createTodoBodySchema, personTodoPathSchema } from '@amidala/contracts';
import type { ApiEnv } from '../app';
import { ApiError } from '../errors/api-error';
import type { CreateSharedTodo } from '../application/create-todo';
import type { GetSharedTodoWorkspace } from '../application/list-shared-todos';
import type { CompleteTodo } from '../application/complete-todo';

async function currentUserId(context: Context<ApiEnv>): Promise<string> {
  const auth = await context.get('scope').resolve('auth');
  const session = await auth.api.getSession({ headers: context.req.raw.headers });
  if (!session?.user) throw new ApiError('unauthorized', 'Authentication required');
  return session.user.id;
}

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
    })
    .post('/organizations/:organizationId/todos/:todoId/complete', async (context) => {
      const path = completeTodoPathSchema.safeParse(context.req.param());
      if (!path.success) throw new ApiError('validation_error', 'Invalid Todo path.');
      const useCase = await context.get('scope').resolve<CompleteTodo>('completeTodo');
      const outcome = await useCase.execute(await currentUserId(context), path.data);
      return context.json({ todo: outcome.todo });
    });
}
