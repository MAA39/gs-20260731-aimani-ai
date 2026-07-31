import '@tanstack/react-start/server-only';
import { createApiClient } from '@aimani-ai/api-client';
import { assignedTodoWorkspaceSchema, createTodoBodySchema, personTodoPathSchema, sharedTodoWorkspaceSchema } from '@aimani-ai/contracts';
import {
  createSharedTodoResponseSchema,
  type CreateSharedTodoInput,
  type CreateSharedTodoResult,
  type PersonTodoPath,
  type SharedTodoWorkspaceResult,
  completeTodoResponseSchema,
  completeTodoInputSchema,
  type CompleteTodoInput,
  type CompleteTodoResult,
} from './todo-schema';
import { createApiFetcher, readApiBody } from '../server/api-fetcher.server';
import { getRequestHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { todoFailureMessage, type TodoOperationContext } from './todo-error-presentation';
export async function getAssignedTodoWorkspaceFromApi(input: { organizationId: string }) {
  const cookie = getRequestHeader('cookie') ?? '';
  let response: Response;
  try { response = await createApiFetcher(cookie)(`http://api.internal/organizations/${input.organizationId}/todos/assigned-to-me`, { headers: { cookie } }); } catch { return unavailable('assigned_workspace'); }
  const body = await readApiBody(response);
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) return { status: 'forbidden' as const, error: { code: 'forbidden' as const, message: todoFailureMessage('assigned_workspace', response.status) } };
  if (response.status === 404) return { status: 'not_found' as const, error: { code: 'not_found' as const, message: todoFailureMessage('assigned_workspace', response.status) } };
  if (response.status === 409) return { status: 'conflict' as const, error: { code: 'conflict' as const, message: todoFailureMessage('assigned_workspace', response.status) } };
  if (response.status === 400) return { status: 'error' as const, error: { code: 'validation_error' as const, message: todoFailureMessage('assigned_workspace', response.status) } };
  if (response.status !== 200) return unavailable('assigned_workspace');
  const parsed = assignedTodoWorkspaceSchema.safeParse(body);
  return parsed.success ? { status: 'ok' as const, workspace: parsed.data } : unavailable('assigned_workspace');
}

function unavailable(context: TodoOperationContext): { status: 'error'; error: { code: 'service_unavailable'; message: string } } {
  return { status: 'error', error: { code: 'service_unavailable', message: todoFailureMessage(context, 503) } };
}

export async function getSharedTodoWorkspaceFromApi(input: PersonTodoPath): Promise<SharedTodoWorkspaceResult> {
  const parsedInput = personTodoPathSchema.safeParse(input);
  if (!parsedInput.success) {
    return { status: 'error', error: { code: 'validation_error', message: todoFailureMessage('shared_workspace', 400) } };
  }
  const cookie = getRequestHeader('cookie') ?? '';
  let response: Response;
  try {
    type TodoGetEndpoint = { organizations: { ':organizationId': { people: { ':contextMembershipId': { todos: { $get: (args: { param: PersonTodoPath }, options: { headers: HeadersInit }) => Promise<Response> } } } } } };
    response = await (createApiClient(createApiFetcher(cookie)) as unknown as TodoGetEndpoint).organizations[':organizationId'].people[':contextMembershipId'].todos.$get(
      { param: parsedInput.data },
      { headers: { cookie } },
    );
  } catch {
    return unavailable('shared_workspace');
  }
  const body = await readApiBody(response);
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) return { status: 'forbidden', error: { code: 'forbidden', message: todoFailureMessage('shared_workspace', response.status) } };
  if (response.status === 404) return { status: 'not_found', error: { code: 'not_found', message: todoFailureMessage('shared_workspace', response.status) } };
  if (response.status === 400) return { status: 'error', error: { code: 'validation_error', message: todoFailureMessage('shared_workspace', response.status) } };
  if (response.status !== 200) return unavailable('shared_workspace');
  const parsed = sharedTodoWorkspaceSchema.safeParse(body);
  return parsed.success ? { status: 'ok', workspace: parsed.data } : unavailable('shared_workspace');
}

export async function createSharedTodoFromApi(input: CreateSharedTodoInput): Promise<CreateSharedTodoResult> {
  const parsedPath = personTodoPathSchema.safeParse(input);
  const parsedBody = createTodoBodySchema.safeParse(input);
  if (!parsedPath.success || !parsedBody.success) {
    return { status: 'error', error: { code: 'validation_error', message: todoFailureMessage('create', 400) } };
  }
  const cookie = getRequestHeader('cookie') ?? '';
  const client = createApiClient(createApiFetcher(cookie));
  // The API validates this body at its application boundary, but the current
  // Hono client type cannot infer JSON for a route that parses req.json()
  // directly. Keep the transport cast here, at this server-only adapter.
  type TodoPostEndpoint = { organizations: { ':organizationId': { people: { ':contextMembershipId': { todos: { $post: (args: { param: PersonTodoPath; json: Omit<CreateSharedTodoInput, 'organizationId' | 'contextMembershipId'> }, options: { headers: HeadersInit }) => Promise<Response> } } } } } };
  const postTodo = (client as unknown as TodoPostEndpoint).organizations[':organizationId'].people[':contextMembershipId'].todos.$post;
  let response: Response;
  try {
    response = await postTodo(
      { param: { organizationId: input.organizationId, contextMembershipId: input.contextMembershipId }, json: { title: input.title, description: input.description, assigneeMembershipId: input.assigneeMembershipId } },
      { headers: { cookie } },
    );
  } catch {
    return unavailable('create');
  }
  const body = await readApiBody(response);
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) return { status: 'forbidden', error: { code: 'forbidden', message: todoFailureMessage('create', response.status) } };
  if (response.status === 404) return { status: 'not_found', error: { code: 'not_found', message: todoFailureMessage('create', response.status) } };
  if (response.status === 400) return { status: 'error', error: { code: 'validation_error', message: todoFailureMessage('create', response.status) } };
  if (response.status !== 201) return unavailable('create');
  const parsed = createSharedTodoResponseSchema.safeParse(body);
  return parsed.success ? { status: 'ok', todo: parsed.data.todo } : unavailable('create');
}

export async function completeTodoFromApi(input: CompleteTodoInput): Promise<CompleteTodoResult> {
  const parsedInput = completeTodoInputSchema.safeParse(input);
  if (!parsedInput.success) return { status: 'error', error: { code: 'validation_error', message: todoFailureMessage('complete', 400) } };
  const cookie = getRequestHeader('cookie') ?? '';
  let response: Response;
  try { response = await createApiFetcher(cookie)(`http://api.internal/organizations/${input.organizationId}/todos/${input.todoId}/complete`, { method: 'POST' }); }
  catch { return { status: 'error', error: { code: 'service_unavailable', message: todoFailureMessage('complete', 503) } }; }
  const body = await readApiBody(response);
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) return { status: 'forbidden', error: { code: 'forbidden', message: todoFailureMessage('complete', 403) } };
  if (response.status === 404) return { status: 'not_found', error: { code: 'not_found', message: todoFailureMessage('complete', 404) } };
  if (response.status === 409) {
    const reason = typeof body === 'object' && body !== null && 'error' in body && typeof (body as { error?: unknown }).error === 'object' && (body as { error: { message?: unknown } }).error?.message;
    return { status: 'conflict', error: { code: 'conflict', message: todoFailureMessage('complete', 409, reason === 'handoff_pending' ? reason : undefined) } };
  }
  if (response.status === 400) return { status: 'error', error: { code: 'validation_error', message: todoFailureMessage('complete', 400) } };
  if (response.status !== 200) return { status: 'error', error: { code: 'service_unavailable', message: todoFailureMessage('complete', 503) } };
  const parsed = completeTodoResponseSchema.safeParse(body);
  return parsed.success ? { status: 'ok', todo: parsed.data.todo } : { status: 'error', error: { code: 'service_unavailable', message: todoFailureMessage('complete', 503) } };
}
