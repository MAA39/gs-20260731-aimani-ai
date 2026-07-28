import { z } from 'zod';

export const processStepStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'completed',
]);

export const processStepAssigneeSchema = z.object({
  membershipId: z.string().min(1),
  name: z.string().min(1),
  image: z.string().nullable(),
});

export const processBoardSchema = z.object({
  boardId: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string().min(1),
  revision: z.number().int().nonnegative(),
});

export const processStepSchema = z.object({
  stepId: z.string().min(1),
  boardId: z.string().min(1),
  organizationId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: processStepStatusSchema,
  assignee: processStepAssigneeSchema.nullable(),
  dueDate: z.string().nullable(),
});

export const stepDependencySchema = z.object({
  predecessorStepId: z.string().min(1),
  successorStepId: z.string().min(1),
});

export const processStepLayoutSchema = z.object({
  stepId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
});

export const processLabWorkspaceSchema = z
  .object({
    board: processBoardSchema,
    steps: z.array(processStepSchema),
    dependencies: z.array(stepDependencySchema),
    layouts: z.array(processStepLayoutSchema),
  })
  .superRefine((workspace, context) => {
    const stepIds = new Set(workspace.steps.map((step) => step.stepId));
    for (const dependency of workspace.dependencies) {
      if (
        !stepIds.has(dependency.predecessorStepId) ||
        !stepIds.has(dependency.successorStepId)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Dependency references an unknown process step.',
          path: ['dependencies'],
        });
      }
    }
  });

export const organizationProcessLabPathSchema = z.object({
  organizationId: z.string().min(1),
});

export const processStepPathSchema = organizationProcessLabPathSchema.extend({
  stepId: z.string().min(1),
});

export const processDependencyPathSchema = organizationProcessLabPathSchema.extend({
  predecessorStepId: z.string().min(1),
  successorStepId: z.string().min(1),
});

export const updateProcessStepBodySchema = z.object({
  status: processStepStatusSchema,
});

export const moveProcessStepBodySchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const connectProcessStepsBodySchema = z.object({
  predecessorStepId: z.string().min(1),
  successorStepId: z.string().min(1),
});

export type ProcessStepStatus = z.infer<typeof processStepStatusSchema>;
export type ProcessBoard = z.infer<typeof processBoardSchema>;
export type ProcessStep = z.infer<typeof processStepSchema>;
export type StepDependency = z.infer<typeof stepDependencySchema>;
export type ProcessStepLayout = z.infer<typeof processStepLayoutSchema>;
export type ProcessLabWorkspace = z.infer<typeof processLabWorkspaceSchema>;
export type ConnectProcessStepsInput = z.infer<
  typeof connectProcessStepsBodySchema
>;
