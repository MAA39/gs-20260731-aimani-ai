import { and, asc, eq } from 'drizzle-orm';
import {
  membership,
  processLabBoard,
  processLabDependency,
  processLabStep,
  processLabStepLayout,
  user,
} from '@amidala/db/schema';
import type { AmidalaDatabase } from '@amidala/db/client';
import type {
  ConnectProcessStepsInput,
  ProcessLabWorkspace,
  ProcessStepStatus,
} from '@amidala/contracts';
import {
  deriveStepAvailability,
  isWeaklyConnected,
  validateDependencyChange,
  type ProcessGraphViolation,
} from './process-graph';

export type ProcessLabRepositoryViolation =
  | ProcessGraphViolation
  | 'forbidden'
  | 'not_found'
  | 'predecessor_incomplete'
  | 'dependency_not_found'
  | 'graph_disconnected';

export class ProcessLabRepositoryError extends Error {
  constructor(public readonly reason: ProcessLabRepositoryViolation) {
    super(reason);
    this.name = 'ProcessLabRepositoryError';
  }
}

type DatabaseExecutor = AmidalaDatabase;

export class ProcessLabRepository {
  constructor(private readonly database: AmidalaDatabase) {}

  private async assertMembership(
    database: DatabaseExecutor,
    userId: string,
    organizationId: string,
  ) {
    const [activeMembership] = await database
      .select({ membershipId: membership.id })
      .from(membership)
      .where(
        and(
          eq(membership.userId, userId),
          eq(membership.organizationId, organizationId),
          eq(membership.status, 'active'),
        ),
      )
      .limit(1);
    if (!activeMembership) throw new ProcessLabRepositoryError('forbidden');
  }

  private async getWorkspace(
    database: DatabaseExecutor,
    organizationId: string,
  ): Promise<ProcessLabWorkspace> {
    const [board] = await database
      .select()
      .from(processLabBoard)
      .where(eq(processLabBoard.organizationId, organizationId))
      .limit(1);
    if (!board) throw new ProcessLabRepositoryError('not_found');

    const stepRows = await database
        .select({
          step: processLabStep,
          assigneeName: membership.displayName,
          assigneeImage: user.image,
        })
        .from(processLabStep)
        .leftJoin(
          membership,
          and(
            eq(membership.id, processLabStep.assigneeMembershipId),
            eq(membership.organizationId, processLabStep.organizationId),
          ),
        )
        .leftJoin(user, eq(user.id, membership.userId))
        .where(
          and(
            eq(processLabStep.boardId, board.id),
            eq(processLabStep.organizationId, organizationId),
          ),
        )
        .orderBy(asc(processLabStep.createdAt), asc(processLabStep.id));
    const dependencies = await database
        .select({
          predecessorStepId: processLabDependency.predecessorStepId,
          successorStepId: processLabDependency.successorStepId,
        })
        .from(processLabDependency)
        .where(
          and(
            eq(processLabDependency.boardId, board.id),
            eq(processLabDependency.organizationId, organizationId),
          ),
        )
        .orderBy(
          asc(processLabDependency.predecessorStepId),
          asc(processLabDependency.successorStepId),
        );
    const layouts = await database
        .select({
          stepId: processLabStepLayout.stepId,
          x: processLabStepLayout.x,
          y: processLabStepLayout.y,
        })
        .from(processLabStepLayout)
        .where(
          and(
            eq(processLabStepLayout.boardId, board.id),
            eq(processLabStepLayout.organizationId, organizationId),
          ),
        );

    return {
      board: {
        boardId: board.id,
        organizationId: board.organizationId,
        name: board.name,
        revision: board.revision,
      },
      steps: stepRows.map(({ step, assigneeName, assigneeImage }) => ({
        stepId: step.id,
        boardId: step.boardId,
        organizationId: step.organizationId,
        title: step.title,
        description: step.description,
        status: step.status as ProcessStepStatus,
        assignee: step.assigneeMembershipId
          ? {
              membershipId: step.assigneeMembershipId,
              name: assigneeName ?? '',
              image: assigneeImage ?? null,
            }
          : null,
        dueDate: step.dueDate,
      })),
      dependencies,
      layouts,
    };
  }

  async getWorkspaceForMember(userId: string, organizationId: string) {
    await this.assertMembership(this.database, userId, organizationId);
    return this.getWorkspace(this.database, organizationId);
  }

  private async mutate(
    userId: string,
    organizationId: string,
    now: Date,
    mutation: (
      database: DatabaseExecutor,
      workspace: ProcessLabWorkspace,
    ) => Promise<void>,
  ) {
    return this.database.transaction(async (transaction) => {
      const database = transaction as unknown as DatabaseExecutor;
      await this.assertMembership(database, userId, organizationId);
      const [board] = await database
        .select({ id: processLabBoard.id })
        .from(processLabBoard)
        .where(eq(processLabBoard.organizationId, organizationId))
        .for('update')
        .limit(1);
      if (!board) throw new ProcessLabRepositoryError('not_found');
      const workspace = await this.getWorkspace(database, organizationId);
      await mutation(database, workspace);
      await database
        .update(processLabBoard)
        .set({ revision: workspace.board.revision + 1, updatedAt: now })
        .where(
          and(
            eq(processLabBoard.id, workspace.board.boardId),
            eq(processLabBoard.organizationId, organizationId),
          ),
        );
      return this.getWorkspace(database, organizationId);
    });
  }

  updateStepStatus(
    userId: string,
    organizationId: string,
    stepId: string,
    status: ProcessStepStatus,
    now: Date,
  ) {
    return this.mutate(userId, organizationId, now, async (database, workspace) => {
      const step = workspace.steps.find((candidate) => candidate.stepId === stepId);
      if (!step) throw new ProcessLabRepositoryError('not_found');
      const availability = deriveStepAvailability(
        workspace.steps,
        workspace.dependencies,
      );
      if (status === 'in_progress' && availability[stepId] === 'waiting') {
        throw new ProcessLabRepositoryError('predecessor_incomplete');
      }
      await database
        .update(processLabStep)
        .set({ status, updatedAt: now })
        .where(
          and(
            eq(processLabStep.id, stepId),
            eq(processLabStep.boardId, workspace.board.boardId),
            eq(processLabStep.organizationId, organizationId),
          ),
        );
    });
  }

  moveStep(
    userId: string,
    organizationId: string,
    stepId: string,
    position: { x: number; y: number },
    now: Date,
  ) {
    return this.mutate(userId, organizationId, now, async (database, workspace) => {
      if (!workspace.steps.some((step) => step.stepId === stepId)) {
        throw new ProcessLabRepositoryError('not_found');
      }
      await database
        .insert(processLabStepLayout)
        .values({
          boardId: workspace.board.boardId,
          organizationId,
          stepId,
          ...position,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [processLabStepLayout.boardId, processLabStepLayout.stepId],
          set: { ...position, updatedAt: now },
        });
    });
  }

  connectSteps(
    userId: string,
    organizationId: string,
    input: ConnectProcessStepsInput,
    now: Date,
  ) {
    return this.mutate(userId, organizationId, now, async (database, workspace) => {
      const validation = validateDependencyChange({
        steps: workspace.steps,
        dependencies: workspace.dependencies,
        candidate: input,
      });
      if (!validation.ok) throw new ProcessLabRepositoryError(validation.reason);
      await database.insert(processLabDependency).values({
        boardId: workspace.board.boardId,
        organizationId,
        ...input,
        createdAt: now,
      });
    });
  }

  disconnectSteps(
    userId: string,
    organizationId: string,
    input: ConnectProcessStepsInput,
    now: Date,
  ) {
    return this.mutate(userId, organizationId, now, async (database, workspace) => {
      const remaining = workspace.dependencies.filter(
        (dependency) =>
          dependency.predecessorStepId !== input.predecessorStepId ||
          dependency.successorStepId !== input.successorStepId,
      );
      if (remaining.length === workspace.dependencies.length) {
        throw new ProcessLabRepositoryError('dependency_not_found');
      }
      if (!isWeaklyConnected(workspace.steps, remaining)) {
        throw new ProcessLabRepositoryError('graph_disconnected');
      }
      await database
        .delete(processLabDependency)
        .where(
          and(
            eq(processLabDependency.boardId, workspace.board.boardId),
            eq(processLabDependency.organizationId, organizationId),
            eq(
              processLabDependency.predecessorStepId,
              input.predecessorStepId,
            ),
            eq(processLabDependency.successorStepId, input.successorStepId),
          ),
        );
    });
  }
}
