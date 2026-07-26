import type { RelationshipKind, SharedTodoWorkspace, TodoSummary } from '@amidala/contracts';
import type { CurrentMembershipContext } from './identity';

export interface IdGenerator { next(): string }

export interface CreateSharedTodoCommand {
  id: string; organizationId: string; contextMembershipId: string; creatorMembershipId: string;
  assigneeMembershipId: string; title: string; description?: string; status: 'open'; createdAt: Date; updatedAt: Date;
}

export interface TodoMemberSummary { membershipId: string; name: string; title: string | null }
export interface TodoContextMemberSummary extends TodoMemberSummary { relationshipKinds: RelationshipKind[] }
export interface SharedTodoWorkspaceQuery { organizationId: string; currentMembershipId: string; contextMembershipId: string }

export interface TodoRepository {
  findActiveMembershipForUser(userId: string, organizationId: string): Promise<CurrentMembershipContext | null>;
  findActiveMember(contextMembershipId: string, organizationId: string): Promise<TodoContextMemberSummary | null>;
  createSharedTodo(command: CreateSharedTodoCommand): Promise<TodoSummary>;
  getSharedTodoWorkspace(query: SharedTodoWorkspaceQuery): Promise<SharedTodoWorkspace>;
}
