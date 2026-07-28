import { ApiError } from '../errors/api-error';
import type { TodoRepository } from '../domain/todo';

export interface GetTeamWorkOverviewInput { organizationId: string }

export class GetTeamWorkOverview {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(userId: string, input: GetTeamWorkOverviewInput) {
    const current = await this.todoRepository.findActiveMembershipForUser(userId, input.organizationId);
    if (!current) throw new ApiError('forbidden', 'This organization is not available to this user.');
    return this.todoRepository.getTeamWorkOverview({
      organizationId: input.organizationId,
      currentMembershipId: current.membershipId,
    });
  }
}
