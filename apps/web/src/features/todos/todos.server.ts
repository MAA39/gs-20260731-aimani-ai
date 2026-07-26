import '@tanstack/react-start/server-only';
import { createApiClient } from '@amidala/api-client';
import { assignedTodoWorkspaceSchema, createTodoBodySchema, personTodoPathSchema, sharedTodoWorkspaceSchema } from '@amidala/contracts';
import {
  createSharedTodoResponseSchema,
  type CreateSharedTodoInput,
  type CreateSharedTodoResult,
  type PersonTodoPath,
  type SharedTodoWorkspaceResult,
} from './todo-schema';
import { env } from 'cloudflare:workers';
import { getRequestHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
export async function getAssignedTodoWorkspaceFromApi(input: { organizationId: string }) {
  const cookie = getRequestHeader('cookie') ?? '';
  let response: Response;
  try { response = await createApiFetcher(cookie)(`http://api.internal/organizations/${input.organizationId}/todos/assigned-to-me`, { headers: { cookie } }); } catch { return unavailable(); }
  const body = await readBody(response);
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) return { status: 'forbidden' as const, error: { code: 'forbidden' as const, message: errorMessage(body, 'この組織では閲覧できません。') } };
  if (response.status === 404) return { status: 'not_found' as const, error: { code: 'not_found' as const, message: errorMessage(body, '対象が見つかりません。') } };
  if (response.status === 409) return { status: 'conflict' as const, error: { code: 'conflict' as const, message: errorMessage(body, 'Todoの状態が更新されています。') } };
  if (response.status === 400) return { status: 'error' as const, error: { code: 'validation_error' as const, message: errorMessage(body, 'Todoの指定を確認してください。') } };
  if (response.status !== 200) return unavailable();
  const parsed = assignedTodoWorkspaceSchema.safeParse(body);
  return parsed.success ? { status: 'ok' as const, workspace: parsed.data } : unavailable();
}

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error?: { message?: unknown } }).error;
    if (typeof error?.message === 'string') return error.message;
  }
  return fallback;
}

function unavailable(): { status: 'error'; error: { code: 'service_unavailable'; message: string } } {
  return { status: 'error', error: { code: 'service_unavailable', message: 'Todo data is temporarily unavailable.' } };
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function createApiFetcher(cookie: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookie) headers.set('cookie', cookie);
    return env.API.fetch(new Request(input, { ...init, headers }));
  };
}

export async function getSharedTodoWorkspaceFromApi(input: PersonTodoPath): Promise<SharedTodoWorkspaceResult> {
  const parsedInput = personTodoPathSchema.safeParse(input);
  if (!parsedInput.success) {
    return { status: 'error', error: { code: 'validation_error', message: 'Invalid Todo path.' } };
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
    return unavailable();
  }
  const body = await readBody(response);
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) return { status: 'forbidden', error: { code: 'forbidden', message: errorMessage(body, 'この組織では閲覧できません。') } };
  if (response.status === 404) return { status: 'not_found', error: { code: 'not_found', message: errorMessage(body, '対象のメンバーが見つかりません。') } };
  if (response.status === 400) return { status: 'error', error: { code: 'validation_error', message: errorMessage(body, 'Todoの指定を確認してください。') } };
  if (response.status !== 200) return unavailable();
  const parsed = sharedTodoWorkspaceSchema.safeParse(body);
  return parsed.success ? { status: 'ok', workspace: parsed.data } : unavailable();
}

export async function createSharedTodoFromApi(input: CreateSharedTodoInput): Promise<CreateSharedTodoResult> {
  const parsedPath = personTodoPathSchema.safeParse(input);
  const parsedBody = createTodoBodySchema.safeParse(input);
  if (!parsedPath.success || !parsedBody.success) {
    return { status: 'error', error: { code: 'validation_error', message: 'Invalid Todo input.' } };
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
    return unavailable();
  }
  const body = await readBody(response);
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) return { status: 'forbidden', error: { code: 'forbidden', message: errorMessage(body, 'この組織では作成できません。') } };
  if (response.status === 404) return { status: 'not_found', error: { code: 'not_found', message: errorMessage(body, '対象のメンバーが見つかりません。') } };
  if (response.status === 400) return { status: 'error', error: { code: 'validation_error', message: errorMessage(body, '入力内容を確認してください。') } };
  if (response.status !== 201) return unavailable();
  const parsed = createSharedTodoResponseSchema.safeParse(body);
  return parsed.success ? { status: 'ok', todo: parsed.data.todo } : unavailable();
}
