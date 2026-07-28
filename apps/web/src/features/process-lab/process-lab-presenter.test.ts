import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProcessLabWorkspace } from '@amidala/contracts';
import {
  canConnectProcessSteps,
  orderProcessSteps,
  toFlowEdges,
  toFlowNodes,
} from './process-lab-presenter';

const workspace: ProcessLabWorkspace = {
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
      status: 'in_progress',
      assignee: null,
      dueDate: null,
    },
    {
      stepId: 'release',
      boardId: 'board',
      organizationId: 'org',
      title: '顧客へ届ける',
      description: null,
      status: 'not_started',
      assignee: null,
      dueDate: null,
    },
  ],
  dependencies: [
    { predecessorStepId: 'discover', successorStepId: 'design' },
    { predecessorStepId: 'design', successorStepId: 'release' },
  ],
  layouts: [
    { stepId: 'discover', x: 0, y: 0 },
    { stepId: 'design', x: 280, y: 0 },
    { stepId: 'release', x: 560, y: 0 },
  ],
};

test('未完了の先行工程を持つ工程を待機中として表す', () => {
  const release = toFlowNodes(workspace, null).find(
    (node) => node.id === 'release',
  );
  assert.equal(release?.data.availability, 'waiting');
});

test('選択工程から上流と下流の責任経路を区別する', () => {
  assert.deepEqual(
    toFlowNodes(workspace, 'design').map((node) => [node.id, node.data.pathRole]),
    [
      ['discover', 'upstream'],
      ['design', 'selected'],
      ['release', 'downstream'],
    ],
  );
  assert.deepEqual(
    toFlowEdges(workspace, 'design').map((edge) => edge.data?.pathRole),
    ['upstream', 'downstream'],
  );
});

test('モバイル一覧を先行工程から安定して並べる', () => {
  assert.deepEqual(
    orderProcessSteps(workspace).map((step) => step.stepId),
    ['discover', 'design', 'release'],
  );
});

test('既存の経路を逆向きに閉じる循環接続を拒否する', () => {
  assert.equal(canConnectProcessSteps(workspace, 'release', 'discover'), false);
  assert.equal(canConnectProcessSteps(workspace, 'discover', 'release'), true);
});
