import { ApiError } from '../errors/api-error';
import type { CreateSharedTodoCommand, IdGenerator, TodoRepository } from '../domain/todo';

export interface CreateSharedTodoInput {
  organizationId: string; contextMembershipId: string; title: string; description?: string; assigneeMembershipId: string;
}
export interface Clock { now(): Date }

export class CreateSharedTodo {
  constructor(private readonly todoRepository: TodoRepository, private readonly idGenerator: IdGenerator, private readonly clock: Clock) {}
  async execute(userId: string, input: CreateSharedTodoInput) {
    const current = await this.todoRepository.findActiveMembershipForUser(userId, input.organizationId);
    if (!current) throw new ApiError('forbidden', 'This organization is not available to this user.');
    const context = await this.todoRepository.findActiveMember(input.contextMembershipId, input.organizationId);
    if (!context) throw new ApiError('not_found', 'Context membership not found.');
    if (context.membershipId === current.membershipId) throw new ApiError('validation_error', 'Context membership must differ from current membership.');
    if (![current.membershipId, context.membershipId].includes(input.assigneeMembershipId)) throw new ApiError('validation_error', 'Assignee must be current or context membership.');
    const now = this.clock.now();
    const command: CreateSharedTodoCommand = { ...input, id: this.idGenerator.next(), creatorMembershipId: current.membershipId, status: 'open', createdAt: now, updatedAt: now };
    return this.todoRepository.createSharedTodo(command);
  }
}
