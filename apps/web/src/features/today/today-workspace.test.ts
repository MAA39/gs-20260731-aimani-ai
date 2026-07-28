import assert from 'node:assert/strict';
import test from 'node:test';
import type { AssignedTodoWorkspace, TodoHandoffWorkspace } from '@amidala/contracts';
import { acceptedHandoffAnnouncement, composeTodayWorkspace, isTodoWaitingOnRecipient } from './today-workspace';

test('引き継ぎ受け入れの案内へ次の一手を含める', () => {
  assert.equal(
    acceptedHandoffAnnouncement('森 ハル', 'インタビュー仮説を3点にまとめる'),
    '森 ハルさんへ責任が移りました。次の一手: インタビュー仮説を3点にまとめる',
  );
  assert.equal(
    acceptedHandoffAnnouncement('森 ハル', null),
    '森 ハルさんへ責任が移りました。',
  );
});

const member = (membershipId: string, name: string) => ({ membershipId, name, title: null });
const todo = (todoId: string, pendingHandoff: AssignedTodoWorkspace['todos'][number]['pendingHandoff']) => ({
  todoId,
  organizationId: 'organization-1',
  contextMembershipId: 'membership-tanaka',
  title: `Todo ${todoId}`,
  description: null,
  status: 'open' as const,
  creator: member('membership-tanaka', '田中'),
  assignee: member('membership-tanaka', '田中'),
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
  pendingHandoff,
});
const handoff = (handoffId: string, status: TodoHandoffWorkspace['recentHandoffs'][number]['status']) => ({
  handoffId,
  organizationId: 'organization-1',
  todo: todo(handoffId === 'handoff-outgoing' ? 'todo-waiting' : handoffId, null),
  requester: member('membership-tanaka', '田中'),
  recipient: member('membership-suzuki', '鈴木'),
  requestMessage: null,
  nextAction: null,
  status,
  requestedAt: '2026-07-28T00:00:00.000Z',
  resolvedAt: status === 'requested' ? null : '2026-07-28T01:00:00.000Z',
});

const assignedWorkspace: AssignedTodoWorkspace = {
  organization: { organizationId: 'organization-1', name: 'Amidala' },
  currentMember: member('membership-tanaka', '田中'),
  todos: [
    todo('todo-owned', null),
    todo('todo-waiting', {
      handoffId: 'handoff-outgoing',
      requester: member('membership-tanaka', '田中'),
      recipient: member('membership-suzuki', '鈴木'),
      requestMessage: null,
      requestedAt: '2026-07-28T00:00:00.000Z',
    }),
  ],
};

const handoffWorkspace: TodoHandoffWorkspace = {
  organization: assignedWorkspace.organization,
  currentMember: assignedWorkspace.currentMember,
  incomingRequests: [handoff('handoff-incoming', 'requested')],
  outgoingRequests: [handoff('handoff-outgoing', 'requested')],
  recentHandoffs: [handoff('handoff-accepted', 'accepted')],
};

test('Todayは受信・自分のボール・相手待ち・直近の責任移動へ重複なく分ける', () => {
  const result = composeTodayWorkspace(assignedWorkspace, handoffWorkspace);

  assert.deepEqual(result.incomingRequests.map((item) => item.handoffId), ['handoff-incoming']);
  assert.deepEqual(result.ownedTodos.map((item) => item.todoId), ['todo-owned']);
  assert.deepEqual(result.outgoingRequests.map((item) => item.handoffId), ['handoff-outgoing']);
  assert.deepEqual(result.recentHandoffs.map((item) => item.handoffId), ['handoff-accepted']);
  assert.equal(result.currentMember.membershipId, 'membership-tanaka');
  assert.equal(isTodoWaitingOnRecipient(assignedWorkspace.todos[1]), true);
  assert.equal(isTodoWaitingOnRecipient(assignedWorkspace.todos[0]), false);
});
