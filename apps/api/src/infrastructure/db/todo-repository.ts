import { and, desc, eq, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { membership, organization, relationship, todo, todoHandoff } from '@amidala/db/schema';
import type { AmidalaDatabase } from '@amidala/db/client';
import { relationshipKindSchema, type RelationshipKind } from '@amidala/contracts';
import type { CurrentMembershipContext } from '../../domain/identity';
import type {
  CreateSharedTodoCommand,
  SharedTodoWorkspaceQuery,
  TodoContextMemberSummary,
  TodoMemberSummary,
  TodoRepository as TodoRepositoryPort,
} from '../../domain/todo';

const membershipRoles = new Set<CurrentMembershipContext['role']>(['owner', 'manager', 'member']);
const relationshipOrder: Record<RelationshipKind, number> = { manager_report: 0, supporter: 1, peer: 2 };

type TodoRow = typeof todo.$inferSelect;

export class TodoRepositoryDrizzle implements TodoRepositoryPort {
  constructor(private readonly database: AmidalaDatabase) {}

  async findActiveMembershipForUser(userId: string, organizationId: string): Promise<CurrentMembershipContext | null> {
    const rows = await this.database
      .select({ membershipId: membership.id, organizationId: membership.organizationId, userId: membership.userId, role: membership.role })
      .from(membership)
      .where(and(eq(membership.userId, userId), eq(membership.organizationId, organizationId), eq(membership.status, 'active')))
      .limit(1);
    const row = rows[0];
    if (!row || !membershipRoles.has(row.role as CurrentMembershipContext['role'])) return null;
    return { ...row, role: row.role as CurrentMembershipContext['role'] };
  }

  async findActiveMember(membershipId: string, organizationId: string): Promise<TodoContextMemberSummary | null> {
    const rows = await this.database
      .select({ membershipId: membership.id, name: membership.displayName, title: membership.title })
      .from(membership)
      .where(and(eq(membership.id, membershipId), eq(membership.organizationId, organizationId), eq(membership.status, 'active')))
      .limit(1);
    const member = rows[0];
    if (!member) return null;
    const kinds = await this.relationshipKinds(organizationId, membershipId);
    return { ...member, relationshipKinds: kinds };
  }

  async createSharedTodo(command: CreateSharedTodoCommand) {
    const [row] = await this.database.insert(todo).values(command).returning();
    if (!row) throw new Error('Todo insert returned no row.');
    const creator = alias(membership, 'todo_creator');
    const assignee = alias(membership, 'todo_assignee');
    const handoffRequester = alias(membership, 'todo_handoff_requester');
    const handoffRecipient = alias(membership, 'todo_handoff_recipient');
    const [joined] = await this.database
      .select({ todo: todo, creatorName: creator.displayName, creatorTitle: creator.title, assigneeName: assignee.displayName, assigneeTitle: assignee.title, handoffId: todoHandoff.id, handoffRequesterId: todoHandoff.requesterMembershipId, handoffRequesterName: handoffRequester.displayName, handoffRequesterTitle: handoffRequester.title, handoffRecipientId: todoHandoff.recipientMembershipId, handoffRecipientName: handoffRecipient.displayName, handoffRecipientTitle: handoffRecipient.title, handoffMessage: todoHandoff.requestMessage, handoffRequestedAt: todoHandoff.requestedAt })
      .from(todo)
      .leftJoin(creator, and(eq(creator.id, row.creatorMembershipId), eq(creator.organizationId, row.organizationId)))
      .leftJoin(assignee, and(eq(assignee.id, row.assigneeMembershipId), eq(assignee.organizationId, row.organizationId)))
      .leftJoin(todoHandoff, and(eq(todoHandoff.todoId, row.id), eq(todoHandoff.organizationId, row.organizationId), eq(todoHandoff.status, 'requested')))
      .leftJoin(handoffRequester, and(eq(handoffRequester.id, todoHandoff.requesterMembershipId), eq(handoffRequester.organizationId, row.organizationId)))
      .leftJoin(handoffRecipient, and(eq(handoffRecipient.id, todoHandoff.recipientMembershipId), eq(handoffRecipient.organizationId, row.organizationId)))
      .where(and(eq(todo.id, row.id), eq(todo.organizationId, row.organizationId)));
    return this.toTodoSummary(row, joined);
  }

  async getSharedTodoWorkspace(query: SharedTodoWorkspaceQuery) {
    const current = alias(membership, 'workspace_current');
    const context = alias(membership, 'workspace_context');
    const creator = alias(membership, 'workspace_creator');
    const assignee = alias(membership, 'workspace_assignee');
    const handoffRequester = alias(membership, 'workspace_handoff_requester');
    const handoffRecipient = alias(membership, 'workspace_handoff_recipient');
    const [organizationRow] = await this.database.select({ organizationId: organization.id, name: organization.name }).from(organization).where(eq(organization.id, query.organizationId)).limit(1);
    const [memberRow] = await this.database
      .select({ currentName: current.displayName, currentTitle: current.title, contextName: context.displayName, contextTitle: context.title })
      .from(current)
      .innerJoin(context, and(eq(context.id, query.contextMembershipId), eq(context.organizationId, query.organizationId)))
      .where(and(eq(current.id, query.currentMembershipId), eq(current.organizationId, query.organizationId)))
      .limit(1);
    const rows = await this.database
      .select({ todo, creatorName: creator.displayName, creatorTitle: creator.title, assigneeName: assignee.displayName, assigneeTitle: assignee.title, handoffId: todoHandoff.id, handoffRequesterId: todoHandoff.requesterMembershipId, handoffRequesterName: handoffRequester.displayName, handoffRequesterTitle: handoffRequester.title, handoffRecipientId: todoHandoff.recipientMembershipId, handoffRecipientName: handoffRecipient.displayName, handoffRecipientTitle: handoffRecipient.title, handoffMessage: todoHandoff.requestMessage, handoffRequestedAt: todoHandoff.requestedAt })
      .from(todo)
      .leftJoin(creator, and(eq(creator.id, todo.creatorMembershipId), eq(creator.organizationId, query.organizationId)))
      .leftJoin(assignee, and(eq(assignee.id, todo.assigneeMembershipId), eq(assignee.organizationId, query.organizationId)))
      .leftJoin(todoHandoff, and(eq(todoHandoff.todoId, todo.id), eq(todoHandoff.organizationId, query.organizationId), eq(todoHandoff.status, 'requested')))
      .leftJoin(handoffRequester, and(eq(handoffRequester.id, todoHandoff.requesterMembershipId), eq(handoffRequester.organizationId, query.organizationId)))
      .leftJoin(handoffRecipient, and(eq(handoffRecipient.id, todoHandoff.recipientMembershipId), eq(handoffRecipient.organizationId, query.organizationId)))
      .where(and(eq(todo.organizationId, query.organizationId), or(and(eq(todo.creatorMembershipId, query.currentMembershipId), eq(todo.contextMembershipId, query.contextMembershipId)), and(eq(todo.creatorMembershipId, query.contextMembershipId), eq(todo.contextMembershipId, query.currentMembershipId)))))
      .orderBy(desc(todo.createdAt), desc(todo.id));
    const relationshipKinds = await this.relationshipKinds(query.organizationId, query.currentMembershipId, query.contextMembershipId);
    return {
      organization: { organizationId: organizationRow?.organizationId ?? query.organizationId, name: organizationRow?.name ?? '' },
      currentMember: { membershipId: query.currentMembershipId, name: memberRow?.currentName ?? '', title: memberRow?.currentTitle ?? null },
      contextMember: { membershipId: query.contextMembershipId, name: memberRow?.contextName ?? '', title: memberRow?.contextTitle ?? null, relationshipKinds },
      todos: rows.map((row) => this.toTodoSummary(row.todo, row)),
    };
  }

  private async relationshipKinds(organizationId: string, currentMembershipId: string, contextMembershipId?: string): Promise<RelationshipKind[]> {
    const target = contextMembershipId ?? currentMembershipId;
    const source = contextMembershipId ? currentMembershipId : undefined;
    const rows = await this.database.select({ kind: relationship.kind }).from(relationship).where(and(eq(relationship.organizationId, organizationId), source ? or(and(eq(relationship.sourceMembershipId, source), eq(relationship.targetMembershipId, target)), and(or(eq(relationship.kind, 'peer'), eq(relationship.kind, 'supporter')), eq(relationship.sourceMembershipId, target), eq(relationship.targetMembershipId, source))) : or(eq(relationship.sourceMembershipId, target), eq(relationship.targetMembershipId, target))));
    return [...new Set(rows.map((row) => relationshipKindSchema.safeParse(row.kind).data).filter((kind): kind is RelationshipKind => kind !== undefined))].sort((a, b) => relationshipOrder[a] - relationshipOrder[b]);
  }

  private toTodoSummary(row: TodoRow, names?: { creatorName?: string | null; creatorTitle?: string | null; assigneeName?: string | null; assigneeTitle?: string | null; handoffId?: string | null; handoffRequesterId?: string | null; handoffRequesterName?: string | null; handoffRequesterTitle?: string | null; handoffRecipientId?: string | null; handoffRecipientName?: string | null; handoffRecipientTitle?: string | null; handoffMessage?: string | null; handoffRequestedAt?: Date | null }) {
    const member = (membershipId: string, name: string | null | undefined, title: string | null | undefined): TodoMemberSummary => ({ membershipId, name: name ?? '', title: title ?? null });
    const pendingHandoff = names?.handoffId && names.handoffRequesterId && names.handoffRecipientId && names.handoffRequestedAt ? { handoffId: names.handoffId, requester: member(names.handoffRequesterId, names.handoffRequesterName, names.handoffRequesterTitle), recipient: member(names.handoffRecipientId, names.handoffRecipientName, names.handoffRecipientTitle), requestMessage: names.handoffMessage ?? null, requestedAt: names.handoffRequestedAt.toISOString() } : null;
    return { todoId: row.id, organizationId: row.organizationId, contextMembershipId: row.contextMembershipId, title: row.title, description: row.description, status: row.status as 'open' | 'completed', creator: member(row.creatorMembershipId, names?.creatorName, names?.creatorTitle), assignee: member(row.assigneeMembershipId, names?.assigneeName, names?.assigneeTitle), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), pendingHandoff };
  }
}

export { TodoRepositoryDrizzle as TodoRepository };
