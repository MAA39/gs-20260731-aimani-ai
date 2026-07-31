import { Hono } from 'hono';
import type { Context } from 'hono';
import { acceptTodoHandoffBodySchema, organizationPathSchema, requestTodoHandoffBodySchema, requestTodoHandoffPathSchema, todoHandoffPathSchema } from '@aimani-ai/contracts';
import type { ApiEnv } from '../app';
import type { RequestTodoHandoff } from '../application/request-todo-handoff';
import type { AcceptTodoHandoff } from '../application/accept-todo-handoff';
import type { RejectTodoHandoff } from '../application/reject-todo-handoff';
import type { CancelTodoHandoff } from '../application/cancel-todo-handoff';
import type { GetTodoHandoffWorkspace } from '../application/get-todo-handoff-workspace';
import type { GetAssignedTodoWorkspace } from '../application/get-assigned-todo-workspace';
import { ApiError } from '../errors/api-error';

async function currentUserId(c: Context<ApiEnv>): Promise<string> {
  const auth = await c.get('scope').resolve('auth'); const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) throw new ApiError('unauthorized', 'Authentication required'); return session.user.id;
}
async function optionalJsonObject(c: Context<ApiEnv>): Promise<unknown> { const text = await c.req.text(); if (!text.trim()) return {}; try { return JSON.parse(text) as unknown; } catch { return undefined; } }
export function createTodoHandoffRoutes() {
  return new Hono<ApiEnv>()
    .post('/organizations/:organizationId/todos/:todoId/handoffs', async (c) => { const path = requestTodoHandoffPathSchema.safeParse(c.req.param()); const body = requestTodoHandoffBodySchema.safeParse(await c.req.json()); if (!path.success || !body.success) throw new ApiError('validation_error', 'Invalid Handoff.'); const useCase = await c.get('scope').resolve<RequestTodoHandoff>('requestTodoHandoff'); const outcome = await useCase.execute(await currentUserId(c), { ...path.data, ...body.data }); return c.json({ handoff: outcome.handoff, todo: outcome.todo }, outcome.kind === 'created' ? 201 : 200); })
    .post('/organizations/:organizationId/handoffs/:handoffId/accept', async (c) => { const path = todoHandoffPathSchema.safeParse(c.req.param()); const body = acceptTodoHandoffBodySchema.safeParse(await optionalJsonObject(c)); if (!path.success || !body.success) throw new ApiError('validation_error', 'Invalid Handoff acceptance.'); const outcome = await (await c.get('scope').resolve<AcceptTodoHandoff>('acceptTodoHandoff')).execute(await currentUserId(c), { ...path.data, ...body.data }); return c.json({ handoff: outcome.handoff, todo: outcome.todo }); })
    .post('/organizations/:organizationId/handoffs/:handoffId/reject', async (c) => { const path = todoHandoffPathSchema.safeParse(c.req.param()); if (!path.success) throw new ApiError('validation_error', 'Invalid path.'); const outcome = await (await c.get('scope').resolve<RejectTodoHandoff>('rejectTodoHandoff')).execute(await currentUserId(c), path.data); return c.json({ handoff: outcome.handoff, todo: outcome.todo }); })
    .post('/organizations/:organizationId/handoffs/:handoffId/cancel', async (c) => { const path = todoHandoffPathSchema.safeParse(c.req.param()); if (!path.success) throw new ApiError('validation_error', 'Invalid path.'); const outcome = await (await c.get('scope').resolve<CancelTodoHandoff>('cancelTodoHandoff')).execute(await currentUserId(c), path.data); return c.json({ handoff: outcome.handoff, todo: outcome.todo }); })
    .get('/organizations/:organizationId/handoffs', async (c) => { const path = organizationPathSchema.safeParse(c.req.param()); if (!path.success) throw new ApiError('validation_error', 'Invalid path.'); return c.json(await (await c.get('scope').resolve<GetTodoHandoffWorkspace>('getTodoHandoffWorkspace')).execute(await currentUserId(c), path.data)); })
    .get('/organizations/:organizationId/todos/assigned-to-me', async (c) => { const path = organizationPathSchema.safeParse(c.req.param()); if (!path.success) throw new ApiError('validation_error', 'Invalid path.'); return c.json(await (await c.get('scope').resolve<GetAssignedTodoWorkspace>('getAssignedTodoWorkspace')).execute(await currentUserId(c), path.data)); });
}
