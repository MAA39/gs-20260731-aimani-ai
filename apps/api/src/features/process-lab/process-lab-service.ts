import type {
  ConnectProcessStepsInput,
  ProcessStepStatus,
} from '@amidala/contracts';
import type { Clock } from '../../application/health-check';
import { ApiError } from '../../errors/api-error';
import {
  ProcessLabRepository,
  ProcessLabRepositoryError,
} from './process-lab-repository';

export class ProcessLabService {
  constructor(
    private readonly repository: ProcessLabRepository,
    private readonly clock: Clock,
  ) {}

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (cause) {
      if (!(cause instanceof ProcessLabRepositoryError)) throw cause;
      if (cause.reason === 'forbidden') {
        throw new ApiError('forbidden', 'organization_forbidden');
      }
      if (
        cause.reason === 'not_found' ||
        cause.reason === 'dependency_not_found'
      ) {
        throw new ApiError('not_found', cause.reason);
      }
      throw new ApiError('conflict', cause.reason);
    }
  }

  getWorkspace(userId: string, organizationId: string) {
    return this.execute(() =>
      this.repository.getWorkspaceForMember(userId, organizationId),
    );
  }

  updateStepStatus(
    userId: string,
    organizationId: string,
    stepId: string,
    status: ProcessStepStatus,
  ) {
    return this.execute(() =>
      this.repository.updateStepStatus(
        userId,
        organizationId,
        stepId,
        status,
        this.clock.now(),
      ),
    );
  }

  moveStep(
    userId: string,
    organizationId: string,
    stepId: string,
    position: { x: number; y: number },
  ) {
    return this.execute(() =>
      this.repository.moveStep(
        userId,
        organizationId,
        stepId,
        position,
        this.clock.now(),
      ),
    );
  }

  connectSteps(
    userId: string,
    organizationId: string,
    input: ConnectProcessStepsInput,
  ) {
    return this.execute(() =>
      this.repository.connectSteps(
        userId,
        organizationId,
        input,
        this.clock.now(),
      ),
    );
  }

  disconnectSteps(
    userId: string,
    organizationId: string,
    input: ConnectProcessStepsInput,
  ) {
    return this.execute(() =>
      this.repository.disconnectSteps(
        userId,
        organizationId,
        input,
        this.clock.now(),
      ),
    );
  }
}
