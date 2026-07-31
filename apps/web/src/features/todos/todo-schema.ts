import { completeTodoPathSchema, completeTodoResponseSchema, todoSummarySchema } from '@aimani-ai/contracts';
import type { SharedTodoWorkspace, TodoSummary } from '@aimani-ai/contracts';
import { z } from 'zod';

export const personTodoPathInputSchema = z.object({
  organizationId: z.string().min(1),
  contextMembershipId: z.string().min(1),
});
export const createSharedTodoInputSchema = z.object({
  organizationId: z.string().min(1),
  contextMembershipId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  assigneeMembershipId: z.string().min(1),
});
export const assignedTodoWorkspaceInputSchema = z.object({ organizationId: z.string().min(1) });

export const createSharedTodoResponseSchema = {
  safeParse(input: unknown) {
    if (typeof input !== 'object' || input === null || !('todo' in input)) return { success: false as const };
    const parsed = todoSummarySchema.safeParse((input as { todo: unknown }).todo);
    return parsed.success ? { success: true as const, data: { todo: parsed.data } } : { success: false as const };
  },
};

export type PersonTodoPath = { organizationId: string; contextMembershipId: string };
export type CreateSharedTodoInput = z.infer<typeof createSharedTodoInputSchema>;
export type AssignedTodoWorkspaceInput = z.infer<typeof assignedTodoWorkspaceInputSchema>;
export type { SharedTodoWorkspace, TodoSummary } from '@aimani-ai/contracts';
export const completeTodoInputSchema = completeTodoPathSchema;
export type CompleteTodoInput = (typeof completeTodoInputSchema)['_output'];
export { completeTodoResponseSchema };
export type CompleteTodoResult =
  | { status: 'ok'; todo: TodoSummary }
  | { status: 'forbidden' | 'not_found' | 'conflict'; error: { code: string; message: string } }
  | { status: 'error'; error: { code: 'validation_error' | 'service_unavailable'; message: string } };

export type SharedTodoWorkspaceResult =
  | { status: 'ok'; workspace: SharedTodoWorkspace }
  | { status: 'forbidden'; error: { code: 'forbidden'; message: string } }
  | { status: 'not_found'; error: { code: 'not_found'; message: string } }
  | { status: 'error'; error: { code: 'validation_error' | 'service_unavailable'; message: string } };

export type CreateSharedTodoResult =
  | { status: 'ok'; todo: TodoSummary }
  | { status: 'forbidden'; error: { code: 'forbidden'; message: string } }
  | { status: 'not_found'; error: { code: 'not_found'; message: string } }
  | { status: 'error'; error: { code: 'validation_error' | 'service_unavailable'; message: string } };
