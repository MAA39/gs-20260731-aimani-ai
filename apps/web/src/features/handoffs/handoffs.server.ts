import '@tanstack/react-start/server-only';
import { getRequestHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { assignedTodoWorkspaceSchema, todoHandoffResponseSchema, todoHandoffWorkspaceSchema } from '@amidala/contracts';
import type { AssignedTodoWorkspaceResult, TodoHandoffMutationResult, TodoHandoffWorkspaceResult, RequestTodoHandoffInput, AcceptTodoHandoffInput, RejectTodoHandoffInput, CancelTodoHandoffInput } from './handoff-schema';

const unavailable = () => ({ status: 'error' as const, error: { code: 'service_unavailable' as const, message: 'Todo Handoff data is temporarily unavailable.' } });
const messageOf = (body: unknown, fallback: string) => typeof body === 'object' && body !== null && 'error' in body && typeof (body as { error?: { message?: unknown }}).error?.message === 'string' ? (body as { error: { message: string }}).error.message : fallback;
async function bodyOf(response: Response) { try { return await response.json(); } catch { return undefined; } }
function fetcher(cookie: string): typeof fetch { return async (input, init) => { const headers = new Headers(init?.headers); if (cookie) headers.set('cookie', cookie); return env.API.fetch(new Request(input, { ...init, headers })); }; }
function classify(response: Response, body: unknown) {
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) return { status: 'forbidden' as const, error: { code: 'forbidden' as const, message: messageOf(body, 'この組織では操作できません。') } };
  if (response.status === 404) return { status: 'not_found' as const, error: { code: 'not_found' as const, message: messageOf(body, '対象の引き継ぎが見つかりません。') } };
  if (response.status === 409) return { status: 'conflict' as const, error: { code: 'conflict' as const, message: messageOf(body, '引き継ぎの状態が更新されています。') } };
  if (response.status === 400) return { status: 'error' as const, error: { code: 'validation_error' as const, message: messageOf(body, '入力内容を確認してください。') } };
  return null;
}
async function call(input: RequestTodoHandoffInput | AcceptTodoHandoffInput | RejectTodoHandoffInput | CancelTodoHandoffInput, verb?: 'accept' | 'reject' | 'cancel') {
  const cookie = getRequestHeader('cookie') ?? '';
  const requestInput = input as RequestTodoHandoffInput;
  const path = verb ? `/organizations/${input.organizationId}/handoffs/${(input as AcceptTodoHandoffInput).handoffId}/${verb}` : `/organizations/${input.organizationId}/todos/${requestInput.todoId}/handoffs`;
  const response = await fetcher(cookie)(`http://api.internal${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: verb ? undefined : JSON.stringify({ recipientMembershipId: requestInput.recipientMembershipId, requestMessage: requestInput.requestMessage }) });
  return { response, body: await bodyOf(response) };
}
export async function getTodoHandoffWorkspace(input: { organizationId: string }): Promise<TodoHandoffWorkspaceResult> { const cookie = getRequestHeader('cookie') ?? ''; let response: Response; try { response = await fetcher(cookie)(`http://api.internal/organizations/${input.organizationId}/handoffs`, { headers: { cookie } }); } catch { return unavailable(); } const body = await bodyOf(response); const error = classify(response, body); if (error) return error; if (response.status !== 200) return unavailable(); const parsed = todoHandoffWorkspaceSchema.safeParse(body); return parsed.success ? { status: 'ok', workspace: parsed.data } : unavailable(); }
export async function getAssignedTodoWorkspace(input: { organizationId: string }): Promise<AssignedTodoWorkspaceResult> { const cookie = getRequestHeader('cookie') ?? ''; let response: Response; try { response = await fetcher(cookie)(`http://api.internal/organizations/${input.organizationId}/todos/assigned-to-me`, { headers: { cookie } }); } catch { return unavailable(); } const body = await bodyOf(response); const error = classify(response, body); if (error) return error; if (response.status !== 200) return unavailable(); const parsed = assignedTodoWorkspaceSchema.safeParse(body); return parsed.success ? { status: 'ok', workspace: parsed.data } : unavailable(); }
export async function requestTodoHandoff(input: RequestTodoHandoffInput): Promise<TodoHandoffMutationResult> { let result: Awaited<ReturnType<typeof call>>; try { result = await call(input); } catch { return unavailable(); } const { response, body } = result; const error = classify(response, body); if (error) return error; if (response.status !== 201 && response.status !== 200) return unavailable(); const parsed = todoHandoffResponseSchema.safeParse(body); return parsed.success ? { status: 'ok', handoff: parsed.data.handoff, todo: parsed.data.todo } : unavailable(); }
async function decide(input: AcceptTodoHandoffInput | RejectTodoHandoffInput | CancelTodoHandoffInput, verb: 'accept' | 'reject' | 'cancel'): Promise<TodoHandoffMutationResult> { let result: Awaited<ReturnType<typeof call>>; try { result = await call(input, verb); } catch { return unavailable(); } const { response, body } = result; const error = classify(response, body); if (error) return error; if (response.status !== 200) return unavailable(); const parsed = todoHandoffResponseSchema.safeParse(body); return parsed.success ? { status: 'ok', handoff: parsed.data.handoff, todo: parsed.data.todo } : unavailable(); }
export const acceptTodoHandoff = (input: AcceptTodoHandoffInput) => decide(input, 'accept');
export const rejectTodoHandoff = (input: RejectTodoHandoffInput) => decide(input, 'reject');
export const cancelTodoHandoff = (input: CancelTodoHandoffInput) => decide(input, 'cancel');
