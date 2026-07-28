import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProcessLabWorkspace } from './process-lab-schema';

const workspace = {
  board: {
    boardId: 'board',
    organizationId: 'org',
    name: '顧客へ届ける',
    revision: 1,
  },
  steps: [
    {
      stepId: 'discover',
      boardId: 'board',
      organizationId: 'org',
      title: '課題を確かめる',
      description: null,
      status: 'completed',
      assignee: null,
      dueDate: null,
    },
    {
      stepId: 'design',
      boardId: 'board',
      organizationId: 'org',
      title: '体験を設計する',
      description: null,
      status: 'not_started',
      assignee: null,
      dueDate: null,
    },
  ],
  dependencies: [
    { predecessorStepId: 'discover', successorStepId: 'design' },
  ],
  layouts: [
    { stepId: 'discover', x: 0, y: 0 },
    { stepId: 'design', x: 280, y: 0 },
  ],
};

test('完全なProcess Lab workspaceをAPI境界で受け入れる', () => {
  assert.deepEqual(parseProcessLabWorkspace(workspace), workspace);
});

test('存在しない工程を指す依存関係をAPI境界で拒否する', () => {
  assert.equal(
    parseProcessLabWorkspace({
      ...workspace,
      dependencies: [
        { predecessorStepId: 'discover', successorStepId: 'unknown' },
      ],
    }),
    null,
  );
});
