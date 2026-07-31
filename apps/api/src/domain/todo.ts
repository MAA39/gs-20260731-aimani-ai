import type { RelationshipKind, SharedTodoWorkspace, TeamWorkOverview, TodoSummary } from '@aimani-ai/contracts';
import type { CurrentMembershipContext } from './identity';

export interface IdGenerator { next(): string }

export interface CreateSharedTodoCommand {
  id: string; organizationId: string; contextMembershipId: string; creatorMembershipId: string;
  assigneeMembershipId: string; title: string; description?: string; status: 'open'; createdAt: Date; updatedAt: Date;
}

export interface TodoMemberSummary { membershipId: string; name: string; title: string | null }
export interface TodoContextMemberSummary extends TodoMemberSummary { relationshipKinds: RelationshipKind[] }
export interface SharedTodoWorkspaceQuery { organizationId: string; currentMembershipId: string; contextMembershipId: string }
export interface TeamWorkOverviewQuery { organizationId: string; currentMembershipId: string }
export interface CompleteTodoCommand { organizationId: string; todoId: string; assigneeMembershipId: string; now: Date }
export type CompleteTodoOutcome =
  | { kind: 'completed' | 'already_completed'; todo: TodoSummary }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; reason: 'handoff_pending' };

export interface TodoRepository {
  findActiveMembershipForUser(userId: string, organizationId: string): Promise<CurrentMembershipContext | null>;
  findActiveMember(contextMembershipId: string, organizationId: string): Promise<TodoContextMemberSummary | null>;
  createSharedTodo(command: CreateSharedTodoCommand): Promise<TodoSummary>;
  completeTodo(command: CompleteTodoCommand): Promise<CompleteTodoOutcome>;
  getSharedTodoWorkspace(query: SharedTodoWorkspaceQuery): Promise<SharedTodoWorkspace>;
  getTeamWorkOverview(query: TeamWorkOverviewQuery): Promise<TeamWorkOverview>;
}
