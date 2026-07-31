import '@tanstack/react-start/server-only';
import { getRequestHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { assignedTodoWorkspaceSchema, todoHandoffResponseSchema, todoHandoffWorkspaceSchema } from '@aimani-ai/contracts';
import type { AssignedTodoWorkspaceResult, TodoHandoffMutationResult, TodoHandoffWorkspaceResult, RequestTodoHandoffInput, AcceptTodoHandoffInput, RejectTodoHandoffInput, CancelTodoHandoffInput } from './handoff-schema';
import { classifyTodoHandoffFailure } from './handoff-error-presentation';
import { createApiFetcher, readApiBody } from '../server/api-fetcher.server';

const unavailable = () => ({ status: 'error' as const, error: { code: 'service_unavailable' as const, message: '引き継ぎ情報を取得できませんでした。時間をおいてもう一度お試しください。' } });
function classify(response: Response, body: unknown) {
  if (response.status === 401) throw redirect({ to: '/login' });
  return classifyTodoHandoffFailure(response.status, body);
}
async function call(input: RequestTodoHandoffInput | AcceptTodoHandoffInput | RejectTodoHandoffInput | CancelTodoHandoffInput, verb?: 'accept' | 'reject' | 'cancel') {
  const cookie = getRequestHeader('cookie') ?? '';
  const requestInput = input as RequestTodoHandoffInput;
  const path = verb ? `/organizations/${input.organizationId}/handoffs/${(input as AcceptTodoHandoffInput).handoffId}/${verb}` : `/organizations/${input.organizationId}/todos/${requestInput.todoId}/handoffs`;
  const body = verb === 'accept'
    ? JSON.stringify({ nextAction: (input as AcceptTodoHandoffInput).nextAction })
    : verb
      ? undefined
      : JSON.stringify({ recipientMembershipId: requestInput.recipientMembershipId, requestMessage: requestInput.requestMessage });
  const response = await createApiFetcher(cookie)(`http://api.internal${path}`, { method: 'POST', headers: { cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body });
  return { response, body: await readApiBody(response) };
}
export async function getTodoHandoffWorkspace(input: { organizationId: string }): Promise<TodoHandoffWorkspaceResult> { const cookie = getRequestHeader('cookie') ?? ''; let response: Response; try { response = await createApiFetcher(cookie)(`http://api.internal/organizations/${input.organizationId}/handoffs`, { headers: { cookie } }); } catch { return unavailable(); } const body = await readApiBody(response); const error = classify(response, body); if (error) return error; if (response.status !== 200) return unavailable(); const parsed = todoHandoffWorkspaceSchema.safeParse(body); return parsed.success ? { status: 'ok', workspace: parsed.data } : unavailable(); }
export async function requestTodoHandoff(input: RequestTodoHandoffInput): Promise<TodoHandoffMutationResult> { let result: Awaited<ReturnType<typeof call>>; try { result = await call(input); } catch { return unavailable(); } const { response, body } = result; const error = classify(response, body); if (error) return error; if (response.status !== 201 && response.status !== 200) return unavailable(); const parsed = todoHandoffResponseSchema.safeParse(body); return parsed.success ? { status: 'ok', handoff: parsed.data.handoff, todo: parsed.data.todo } : unavailable(); }
async function decide(input: AcceptTodoHandoffInput | RejectTodoHandoffInput | CancelTodoHandoffInput, verb: 'accept' | 'reject' | 'cancel'): Promise<TodoHandoffMutationResult> { let result: Awaited<ReturnType<typeof call>>; try { result = await call(input, verb); } catch { return unavailable(); } const { response, body } = result; const error = classify(response, body); if (error) return error; if (response.status !== 200) return unavailable(); const parsed = todoHandoffResponseSchema.safeParse(body); return parsed.success ? { status: 'ok', handoff: parsed.data.handoff, todo: parsed.data.todo } : unavailable(); }
export const acceptTodoHandoff = (input: AcceptTodoHandoffInput) => decide(input, 'accept');
export const rejectTodoHandoff = (input: RejectTodoHandoffInput) => decide(input, 'reject');
export const cancelTodoHandoff = (input: CancelTodoHandoffInput) => decide(input, 'cancel');
