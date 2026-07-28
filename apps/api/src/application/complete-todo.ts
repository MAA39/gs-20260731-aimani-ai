import { ApiError } from '../errors/api-error';
import type { Clock } from './health-check';
import type { TodoRepository } from '../domain/todo';

export class CompleteTodo {
  constructor(private readonly repository: TodoRepository, private readonly clock: Clock) {}

  async execute(userId: string, input: { organizationId: string; todoId: string }) {
    const membership = await this.repository.findActiveMembershipForUser(userId, input.organizationId);
    if (!membership) throw new ApiError('forbidden', 'This organization is not available to this user.');
    const outcome = await this.repository.completeTodo({ ...input, assigneeMembershipId: membership.membershipId, now: this.clock.now() });
    if (outcome.kind === 'not_found') throw new ApiError('not_found', 'Todo not found.');
    if (outcome.kind === 'forbidden') throw new ApiError('forbidden', 'Only the current assignee can complete this Todo.');
    if (outcome.kind === 'conflict') throw new ApiError('conflict', outcome.reason);
    return outcome;
  }
}
