import { processLabWorkspaceSchema, type ProcessLabWorkspace } from '@aimani-ai/contracts';
import { z } from 'zod';

export const processLabInputSchema = z.object({
  organizationId: z.string().min(1),
});

export const updateProcessStepInputSchema = processLabInputSchema.extend({
  stepId: z.string().min(1),
  status: z.enum(['not_started', 'in_progress', 'completed']),
});

export const moveProcessStepInputSchema = processLabInputSchema.extend({
  stepId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
});

export const connectProcessStepsInputSchema = processLabInputSchema.extend({
  predecessorStepId: z.string().min(1),
  successorStepId: z.string().min(1),
});

export const disconnectProcessStepsInputSchema = connectProcessStepsInputSchema;

export type ProcessLabInput = z.infer<typeof processLabInputSchema>;
export type UpdateProcessStepInput = z.infer<
  typeof updateProcessStepInputSchema
>;
export type MoveProcessStepInput = z.infer<typeof moveProcessStepInputSchema>;
export type ProcessDependencyInput = z.infer<
  typeof connectProcessStepsInputSchema
>;

export type ProcessLabResult =
  | { status: 'ok'; workspace: ProcessLabWorkspace }
  | {
      status: 'forbidden' | 'not_found' | 'conflict';
      error: { code: string; message: string };
    }
  | {
      status: 'error';
      error: {
        code: 'validation_error' | 'service_unavailable';
        message: string;
      };
    };

export function parseProcessLabWorkspace(input: unknown) {
  const parsed = processLabWorkspaceSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export { processLabWorkspaceSchema };
