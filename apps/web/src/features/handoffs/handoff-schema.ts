import {
  assignedTodoWorkspaceSchema,
  requestTodoHandoffBodySchema,
  requestTodoHandoffPathSchema,
  todoHandoffPathSchema,
  todoHandoffResponseSchema,
  todoHandoffWorkspaceSchema,
} from '@amidala/contracts';
import { z } from 'zod';
import type {
  AssignedTodoWorkspace,
  TodoHandoffSummary,
  TodoHandoffWorkspace,
  TodoSummary,
} from '@amidala/contracts';

export const requestTodoHandoffInputSchema = requestTodoHandoffPathSchema.and(requestTodoHandoffBodySchema) as unknown as z.ZodType<{ organizationId: string; todoId: string; recipientMembershipId: string; requestMessage?: string }>;
export const acceptTodoHandoffInputSchema = todoHandoffPathSchema as unknown as z.ZodType<{ organizationId: string; handoffId: string }>;
export const rejectTodoHandoffInputSchema = acceptTodoHandoffInputSchema;
export const cancelTodoHandoffInputSchema = acceptTodoHandoffInputSchema;

export type RequestTodoHandoffInput = z.infer<typeof requestTodoHandoffInputSchema>;
export type AcceptTodoHandoffInput = z.infer<typeof acceptTodoHandoffInputSchema>;
export type RejectTodoHandoffInput = z.infer<typeof rejectTodoHandoffInputSchema>;
export type CancelTodoHandoffInput = z.infer<typeof cancelTodoHandoffInputSchema>;

export type HandoffErrorCode = 'validation_error' | 'service_unavailable';
export type HandoffResult<T> =
  | { status: 'ok'; handoff: TodoHandoffSummary; todo: T }
  | { status: 'forbidden'; error: { code: 'forbidden'; message: string } }
  | { status: 'not_found'; error: { code: 'not_found'; message: string } }
  | { status: 'conflict'; error: { code: 'conflict'; message: string } }
  | { status: 'error'; error: { code: HandoffErrorCode; message: string } };
export type TodoHandoffMutationResult = HandoffResult<TodoSummary>;
export type TodoHandoffWorkspaceResult =
  | { status: 'ok'; workspace: TodoHandoffWorkspace }
  | { status: 'forbidden'; error: { code: 'forbidden'; message: string } }
  | { status: 'not_found'; error: { code: 'not_found'; message: string } }
  | { status: 'conflict'; error: { code: 'conflict'; message: string } }
  | { status: 'error'; error: { code: HandoffErrorCode; message: string } };
export type AssignedTodoWorkspaceResult =
  | { status: 'ok'; workspace: AssignedTodoWorkspace }
  | { status: 'forbidden'; error: { code: 'forbidden'; message: string } }
  | { status: 'not_found'; error: { code: 'not_found'; message: string } }
  | { status: 'conflict'; error: { code: 'conflict'; message: string } }
  | { status: 'error'; error: { code: HandoffErrorCode; message: string } };

export { assignedTodoWorkspaceSchema, todoHandoffResponseSchema, todoHandoffWorkspaceSchema };
