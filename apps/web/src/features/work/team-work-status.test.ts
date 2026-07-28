import assert from 'node:assert/strict';
import test from 'node:test';
import type { TodoSummary } from '@amidala/contracts';
import { teamWorkStatus } from './team-work-status';

const openTodo: TodoSummary = {
  todoId: 'todo-customer-interview',
  organizationId: 'org-acme-studio',
  contextMembershipId: 'membership-tanaka',
  title: '顧客インタビューの論点を整理する',
  description: null,
  status: 'open',
  creator: { membershipId: 'membership-tanaka', name: '田中 彩', title: 'プロダクトマネージャー' },
  assignee: { membershipId: 'membership-tanaka', name: '田中 彩', title: 'プロダクトマネージャー' },
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T01:00:00.000Z',
  pendingHandoff: null,
};

test('open Todoは対応中と表示する', () => {
  assert.deepEqual(teamWorkStatus(openTodo), { kind: 'in_progress', label: '対応中' });
});

test('pending HandoffがあるTodoは引き継ぎ先の確認待ちと表示する', () => {
  const pendingTodo: TodoSummary = {
    ...openTodo,
    pendingHandoff: {
      handoffId: 'handoff-to-mori',
      requester: openTodo.assignee,
      recipient: { membershipId: 'membership-mori', name: '森 ハル', title: 'デザイナー' },
      requestMessage: null,
      requestedAt: '2026-07-28T01:00:00.000Z',
    },
  };

  assert.deepEqual(teamWorkStatus(pendingTodo), {
    kind: 'handoff_pending',
    label: '森 ハルさんの確認待ち',
  });
});

test('completed Todoはpending情報より完了を優先して表示する', () => {
  assert.deepEqual(
    teamWorkStatus({
      ...openTodo,
      status: 'completed',
      pendingHandoff: {
        handoffId: 'stale-handoff',
        requester: openTodo.assignee,
        recipient: { membershipId: 'membership-mori', name: '森 ハル', title: null },
        requestMessage: null,
        requestedAt: '2026-07-28T01:00:00.000Z',
      },
    }),
    { kind: 'completed', label: '完了' },
  );
});
