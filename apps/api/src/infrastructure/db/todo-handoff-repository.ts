import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { membership, organization, todo, todoHandoff } from '@amidala/db/schema';
import type { AmidalaDatabase } from '@amidala/db/client';
import type { TodoSummary } from '@amidala/contracts';
import type { TodoHandoffRepository as Port, RequestTodoHandoffCommand, AcceptTodoHandoffCommand, RejectTodoHandoffCommand, CancelTodoHandoffCommand, TodoHandoffConflictReason, RequestTodoHandoffOutcome, AcceptTodoHandoffOutcome, RejectTodoHandoffOutcome, CancelTodoHandoffOutcome } from '../../domain/todo-handoff';
import type { CurrentMembershipContext } from '../../domain/identity';
import { ApiError } from '../../errors/api-error';

type Db = AmidalaDatabase;
type TodoRow = typeof todo.$inferSelect;
type HandoffRow = typeof todoHandoff.$inferSelect;
const roles = new Set(['owner', 'manager', 'member'] as const);
const member = (id: string, name: string | null | undefined, title: string | null | undefined): TodoSummary['creator'] => ({ membershipId: id, name: name ?? '', title: title ?? null });
class TodoHandoffTransactionConflict extends Error {}

export class TodoHandoffRepositoryDrizzle implements Port {
  constructor(private readonly db: Db) {}

  async findActiveMembershipForUser(userId: string, organizationId: string): Promise<CurrentMembershipContext | null> {
    const [row] = await this.db.select({ membershipId: membership.id, organizationId: membership.organizationId, userId: membership.userId, role: membership.role }).from(membership).where(and(eq(membership.userId, userId), eq(membership.organizationId, organizationId), eq(membership.status, 'active'))).limit(1);
    if (!row || !roles.has(row.role as never)) return null;
    return { ...row, role: row.role as CurrentMembershipContext['role'] };
  }

  private async summary(db: Db, h: HandoffRow, t?: TodoRow): Promise<{ handoff: import('@amidala/contracts').TodoHandoffSummary; todo: TodoSummary }> {
    const todoRow = t ?? (await db.select().from(todo).where(and(eq(todo.id, h.todoId), eq(todo.organizationId, h.organizationId))).limit(1))[0];
    if (!todoRow) throw new Error('Todo disappeared while projecting handoff.');
    const creator = alias(membership, 'handoff_creator'); const assignee = alias(membership, 'handoff_assignee'); const requester = alias(membership, 'handoff_requester'); const recipient = alias(membership, 'handoff_recipient');
    const [row] = await db.select({ todo: todo, creatorName: creator.displayName, creatorTitle: creator.title, assigneeName: assignee.displayName, assigneeTitle: assignee.title, requesterName: requester.displayName, requesterTitle: requester.title, recipientName: recipient.displayName, recipientTitle: recipient.title }).from(todo).leftJoin(creator, and(eq(creator.id, todo.creatorMembershipId), eq(creator.organizationId, h.organizationId))).leftJoin(assignee, and(eq(assignee.id, todo.assigneeMembershipId), eq(assignee.organizationId, h.organizationId))).leftJoin(requester, and(eq(requester.id, h.requesterMembershipId), eq(requester.organizationId, h.organizationId))).leftJoin(recipient, and(eq(recipient.id, h.recipientMembershipId), eq(recipient.organizationId, h.organizationId))).where(and(eq(todo.id, todoRow.id), eq(todo.organizationId, h.organizationId)));
    const tr = row?.todo ?? todoRow; const creatorSummary = member(tr.creatorMembershipId, row?.creatorName, row?.creatorTitle); const assigneeSummary = member(tr.assigneeMembershipId, row?.assigneeName, row?.assigneeTitle); const req = member(h.requesterMembershipId, row?.requesterName, row?.requesterTitle); const rec = member(h.recipientMembershipId, row?.recipientName, row?.recipientTitle);
    const summary: TodoSummary = { todoId: tr.id, organizationId: tr.organizationId, contextMembershipId: tr.contextMembershipId, title: tr.title, description: tr.description, status: tr.status as 'open' | 'completed', creator: creatorSummary, assignee: assigneeSummary, createdAt: tr.createdAt.toISOString(), updatedAt: tr.updatedAt.toISOString(), pendingHandoff: h.status === 'requested' ? { handoffId: h.id, requester: req, recipient: rec, requestMessage: h.requestMessage, requestedAt: h.requestedAt.toISOString() } : null };
    return { handoff: { handoffId: h.id, organizationId: h.organizationId, todo: summary, requester: req, recipient: rec, requestMessage: h.requestMessage, status: h.status as 'requested' | 'accepted' | 'rejected' | 'canceled', requestedAt: h.requestedAt.toISOString(), resolvedAt: h.resolvedAt?.toISOString() ?? null }, todo: summary };
  }

  async requestTodoHandoff(c: RequestTodoHandoffCommand): Promise<RequestTodoHandoffOutcome> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(sql`set transaction isolation level read committed`);
        const [t] = await tx.select().from(todo).where(and(eq(todo.id, c.todoId), eq(todo.organizationId, c.organizationId))).for('update').limit(1);
        if (!t) return { kind: 'not_found' } as const;
        const ids = [c.requesterMembershipId, c.recipientMembershipId].sort(); const lockedMembers = await tx.select().from(membership).where(and(eq(membership.organizationId, c.organizationId), inArray(membership.id, ids))).orderBy(membership.id).for('update'); const requester = lockedMembers.find((m) => m.id === c.requesterMembershipId); const recipient = lockedMembers.find((m) => m.id === c.recipientMembershipId); if (!requester || requester.status !== 'active') return { kind: 'forbidden' } as const;
        const [active] = await tx.select().from(todoHandoff).where(and(eq(todoHandoff.todoId, c.todoId), eq(todoHandoff.organizationId, c.organizationId), eq(todoHandoff.status, 'requested'))).for('update').limit(1);
        if (active) { const s = await this.summary(tx as Db, active, t); return active.requesterMembershipId === c.requesterMembershipId && active.recipientMembershipId === c.recipientMembershipId && active.requestMessage === c.requestMessage ? { kind: 'already_requested' as const, ...s } : { kind: 'conflict' as const, reason: 'handoff_already_requested' as TodoHandoffConflictReason }; }
        if (t.status !== 'open') return { kind: 'conflict' as const, reason: 'todo_not_open' as const };
        if (t.assigneeMembershipId !== c.requesterMembershipId) return { kind: 'conflict' as const, reason: 'requester_is_not_current_assignee' as const };
        if (!recipient || recipient.organizationId !== c.organizationId) return { kind: 'conflict' as const, reason: 'invalid_recipient' as const }; if (recipient.status !== 'active') return { kind: 'conflict' as const, reason: 'inactive_recipient' as const }; if (recipient.id === c.requesterMembershipId) return { kind: 'conflict' as const, reason: 'invalid_recipient' as const };
        const [h] = await tx.insert(todoHandoff).values({ id: c.id, organizationId: c.organizationId, todoId: c.todoId, requesterMembershipId: c.requesterMembershipId, recipientMembershipId: c.recipientMembershipId, requestMessage: c.requestMessage, status: 'requested', requestedAt: c.now, resolvedAt: null }).returning();
        if (!h) throw new Error('Handoff insert returned no row.'); const s = await this.summary(tx as Db, h, t); return { kind: 'created' as const, ...s };
      });
    } catch (error) { if (this.isRetryable(error)) throw new ApiError('service_unavailable', 'Database transaction could not be completed.'); if (this.isUniqueConflict(error)) { const [h] = await this.db.select().from(todoHandoff).where(and(eq(todoHandoff.todoId, c.todoId), eq(todoHandoff.organizationId, c.organizationId), eq(todoHandoff.status, 'requested'))).limit(1); if (h && h.requesterMembershipId === c.requesterMembershipId && h.recipientMembershipId === c.recipientMembershipId && h.requestMessage === c.requestMessage) { const s = await this.summary(this.db, h); return { kind: 'already_requested' as const, ...s }; } if (h) return { kind: 'conflict' as const, reason: 'handoff_already_requested' as const }; } throw error; }
  }

  private async decide(c: AcceptTodoHandoffCommand | RejectTodoHandoffCommand | CancelTodoHandoffCommand, verb: 'accepted' | 'rejected' | 'canceled') {
    const [hint] = await this.db.select().from(todoHandoff).where(and(eq(todoHandoff.id, c.handoffId), eq(todoHandoff.organizationId, c.organizationId))).limit(1);
    if (!hint) return { kind: 'not_found' as const };
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level read committed`);
      const [t] = await tx.select().from(todo).where(and(eq(todo.id, hint.todoId), eq(todo.organizationId, c.organizationId))).for('update').limit(1); if (!t) return { kind: 'not_found' as const };
      const ids = [hint.requesterMembershipId, hint.recipientMembershipId].sort(); const lockedMembers = await tx.select().from(membership).where(and(eq(membership.organizationId, c.organizationId), inArray(membership.id, ids))).orderBy(membership.id).for('update');
      const [h] = await tx.select().from(todoHandoff).where(and(eq(todoHandoff.id, c.handoffId), eq(todoHandoff.organizationId, c.organizationId))).for('update').limit(1); if (!h) return { kind: 'not_found' as const };
      const actor = 'recipientMembershipId' in c ? c.recipientMembershipId : c.requesterMembershipId; if ((verb === 'canceled' ? h.requesterMembershipId : h.recipientMembershipId) !== actor) return { kind: 'forbidden' as const };
      if (h.status === verb) { const s = await this.summary(tx as Db, h); return { kind: (`already_${verb === 'canceled' ? 'canceled' : verb}`) as 'already_accepted' | 'already_rejected' | 'already_canceled', ...s }; }
      const actorRow = lockedMembers.find((m) => m.id === actor); if (!actorRow || actorRow.status !== 'active') return { kind: 'forbidden' as const };
      if (h.status !== 'requested') return { kind: 'conflict' as const, reason: 'handoff_already_resolved' as const };
      if (t.status !== 'open') return { kind: 'conflict' as const, reason: 'todo_not_open' as const }; if (verb === 'accepted' && t.assigneeMembershipId !== h.requesterMembershipId) return { kind: 'conflict' as const, reason: 'requester_is_not_current_assignee' as const };
      const [updated] = await tx.update(todoHandoff).set({ status: verb, resolvedAt: c.now }).where(and(eq(todoHandoff.id, h.id), eq(todoHandoff.status, 'requested'))).returning(); if (!updated) return { kind: 'conflict' as const, reason: 'handoff_already_resolved' as const };
      let projectedTodo = t; if (verb === 'accepted') { const [changed] = await tx.update(todo).set({ assigneeMembershipId: actor, updatedAt: c.now }).where(and(eq(todo.id, t.id), eq(todo.organizationId, c.organizationId), eq(todo.assigneeMembershipId, h.requesterMembershipId))).returning(); if (!changed) throw new TodoHandoffTransactionConflict(); projectedTodo = changed; }
      const s = await this.summary(tx as Db, updated, projectedTodo); return { kind: verb as 'accepted' | 'rejected' | 'canceled', ...s };
    }).catch((error) => { if (error instanceof TodoHandoffTransactionConflict) return { kind: 'conflict' as const, reason: 'requester_is_not_current_assignee' as const }; if (this.isRetryable(error)) throw new ApiError('service_unavailable', 'Database transaction could not be completed.'); throw error; });
  }
  acceptTodoHandoff(c: AcceptTodoHandoffCommand): Promise<AcceptTodoHandoffOutcome> { return this.decide(c, 'accepted') as Promise<AcceptTodoHandoffOutcome>; }
  rejectTodoHandoff(c: RejectTodoHandoffCommand): Promise<RejectTodoHandoffOutcome> { return this.decide(c, 'rejected') as Promise<RejectTodoHandoffOutcome>; }
  cancelTodoHandoff(c: CancelTodoHandoffCommand): Promise<CancelTodoHandoffOutcome> { return this.decide(c, 'canceled') as Promise<CancelTodoHandoffOutcome>; }

  async getTodoHandoffWorkspace(q: { organizationId: string; currentMembershipId: string }) {
    const [o] = await this.db.select({ organizationId: organization.id, name: organization.name }).from(organization).where(eq(organization.id, q.organizationId)); const [cur] = await this.db.select().from(membership).where(and(eq(membership.id, q.currentMembershipId), eq(membership.organizationId, q.organizationId)));
    const creator = alias(membership, 'workspace_creator'); const assignee = alias(membership, 'workspace_assignee'); const requester = alias(membership, 'workspace_requester'); const recipient = alias(membership, 'workspace_recipient');
    const selectHandoffsForCurrentMember = () => this.db.select({ h: todoHandoff, t: todo, creatorName: creator.displayName, creatorTitle: creator.title, assigneeName: assignee.displayName, assigneeTitle: assignee.title, requesterName: requester.displayName, requesterTitle: requester.title, recipientName: recipient.displayName, recipientTitle: recipient.title }).from(todoHandoff).innerJoin(todo, and(eq(todo.id, todoHandoff.todoId), eq(todo.organizationId, todoHandoff.organizationId))).leftJoin(creator, and(eq(creator.id, todo.creatorMembershipId), eq(creator.organizationId, q.organizationId))).leftJoin(assignee, and(eq(assignee.id, todo.assigneeMembershipId), eq(assignee.organizationId, q.organizationId))).leftJoin(requester, and(eq(requester.id, todoHandoff.requesterMembershipId), eq(requester.organizationId, q.organizationId))).leftJoin(recipient, and(eq(recipient.id, todoHandoff.recipientMembershipId), eq(recipient.organizationId, q.organizationId)));
    const currentMemberParticipates = or(eq(todoHandoff.requesterMembershipId, q.currentMembershipId), eq(todoHandoff.recipientMembershipId, q.currentMembershipId));
    const [requestedRows, recentRows] = await Promise.all([
      selectHandoffsForCurrentMember().where(and(eq(todoHandoff.organizationId, q.organizationId), currentMemberParticipates, eq(todoHandoff.status, 'requested'))).orderBy(desc(todoHandoff.requestedAt), desc(todoHandoff.id)),
      selectHandoffsForCurrentMember().where(and(eq(todoHandoff.organizationId, q.organizationId), currentMemberParticipates, ne(todoHandoff.status, 'requested'))).orderBy(desc(todoHandoff.resolvedAt), desc(todoHandoff.id)).limit(20),
    ]);
    const rows = [...requestedRows, ...recentRows];
    const summaries = rows.map((r) => { const req = member(r.h.requesterMembershipId, r.requesterName, r.requesterTitle); const rec = member(r.h.recipientMembershipId, r.recipientName, r.recipientTitle); const ts: TodoSummary = { todoId: r.t.id, organizationId: r.t.organizationId, contextMembershipId: r.t.contextMembershipId, title: r.t.title, description: r.t.description, status: r.t.status as 'open' | 'completed', creator: member(r.t.creatorMembershipId, r.creatorName, r.creatorTitle), assignee: member(r.t.assigneeMembershipId, r.assigneeName, r.assigneeTitle), createdAt: r.t.createdAt.toISOString(), updatedAt: r.t.updatedAt.toISOString(), pendingHandoff: r.h.status === 'requested' ? { handoffId: r.h.id, requester: req, recipient: rec, requestMessage: r.h.requestMessage, requestedAt: r.h.requestedAt.toISOString() } : null }; return { handoff: { handoffId: r.h.id, organizationId: r.h.organizationId, todo: ts, requester: req, recipient: rec, requestMessage: r.h.requestMessage, status: r.h.status as 'requested' | 'accepted' | 'rejected' | 'canceled', requestedAt: r.h.requestedAt.toISOString(), resolvedAt: r.h.resolvedAt?.toISOString() ?? null }, todo: ts }; }); return { organization: { organizationId: o?.organizationId ?? q.organizationId, name: o?.name ?? '' }, currentMember: member(q.currentMembershipId, cur?.displayName, cur?.title), incomingRequests: summaries.filter((x) => x.handoff.recipient.membershipId === q.currentMembershipId && x.handoff.status === 'requested').map((x) => x.handoff), outgoingRequests: summaries.filter((x) => x.handoff.requester.membershipId === q.currentMembershipId && x.handoff.status === 'requested').map((x) => x.handoff), recentHandoffs: summaries.filter((x) => x.handoff.status !== 'requested').map((x) => x.handoff) };
  }
  async getAssignedTodoWorkspace(q: { organizationId: string; currentMembershipId: string }) {
    const [o] = await this.db.select({ organizationId: organization.id, name: organization.name }).from(organization).where(eq(organization.id, q.organizationId)); const [cur] = await this.db.select().from(membership).where(and(eq(membership.id, q.currentMembershipId), eq(membership.organizationId, q.organizationId)));
    const creator = alias(membership, 'assigned_creator'); const assignee = alias(membership, 'assigned_assignee'); const requester = alias(membership, 'assigned_requester'); const recipient = alias(membership, 'assigned_recipient'); const rows = await this.db.select({ t: todo, creatorName: creator.displayName, creatorTitle: creator.title, assigneeName: assignee.displayName, assigneeTitle: assignee.title, h: todoHandoff, requesterName: requester.displayName, requesterTitle: requester.title, recipientName: recipient.displayName, recipientTitle: recipient.title }).from(todo).leftJoin(creator, and(eq(creator.id, todo.creatorMembershipId), eq(creator.organizationId, q.organizationId))).leftJoin(assignee, and(eq(assignee.id, todo.assigneeMembershipId), eq(assignee.organizationId, q.organizationId))).leftJoin(todoHandoff, and(eq(todoHandoff.todoId, todo.id), eq(todoHandoff.organizationId, todo.organizationId), eq(todoHandoff.status, 'requested'))).leftJoin(requester, and(eq(requester.id, todoHandoff.requesterMembershipId), eq(requester.organizationId, q.organizationId))).leftJoin(recipient, and(eq(recipient.id, todoHandoff.recipientMembershipId), eq(recipient.organizationId, q.organizationId))).where(and(eq(todo.organizationId, q.organizationId), eq(todo.assigneeMembershipId, q.currentMembershipId), eq(todo.status, 'open')));
    return { organization: { organizationId: o?.organizationId ?? q.organizationId, name: o?.name ?? '' }, currentMember: member(q.currentMembershipId, cur?.displayName, cur?.title), todos: rows.map((r) => ({ todoId: r.t.id, organizationId: r.t.organizationId, contextMembershipId: r.t.contextMembershipId, title: r.t.title, description: r.t.description, status: r.t.status as 'open' | 'completed', creator: member(r.t.creatorMembershipId, r.creatorName, r.creatorTitle), assignee: member(r.t.assigneeMembershipId, r.assigneeName, r.assigneeTitle), createdAt: r.t.createdAt.toISOString(), updatedAt: r.t.updatedAt.toISOString(), pendingHandoff: r.h ? { handoffId: r.h.id, requester: member(r.h.requesterMembershipId, r.requesterName, r.requesterTitle), recipient: member(r.h.recipientMembershipId, r.recipientName, r.recipientTitle), requestMessage: r.h.requestMessage, requestedAt: r.h.requestedAt.toISOString() } : null })) };
  }
  private isRetryable(error: unknown): boolean { const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''; return code === '40P01' || code === '40001'; }
  private isUniqueConflict(error: unknown): boolean { const e = error as { code?: unknown; constraint?: unknown }; return e?.code === '23505' && e.constraint === 'todo_handoff_one_requested_per_todo_unique'; }
}
export { TodoHandoffRepositoryDrizzle as TodoHandoffRepository };
