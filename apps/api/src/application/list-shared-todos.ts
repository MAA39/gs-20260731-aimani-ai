import { ApiError } from '../errors/api-error';
import type { TodoRepository } from '../domain/todo';

export interface GetSharedTodoWorkspaceInput { organizationId: string; contextMembershipId: string }

export class GetSharedTodoWorkspace {
  constructor(private readonly todoRepository: TodoRepository) {}
  async execute(userId: string, input: GetSharedTodoWorkspaceInput) {
    const current = await this.todoRepository.findActiveMembershipForUser(userId, input.organizationId);
    if (!current) throw new ApiError('forbidden', 'This organization is not available to this user.');
    const context = await this.todoRepository.findActiveMember(input.contextMembershipId, input.organizationId);
    if (!context) throw new ApiError('not_found', 'Context membership not found.');
    if (context.membershipId === current.membershipId) throw new ApiError('validation_error', 'Context membership must differ from current membership.');
    return this.todoRepository.getSharedTodoWorkspace({ organizationId: input.organizationId, currentMembershipId: current.membershipId, contextMembershipId: context.membershipId });
  }
}
