import { describe, expect, it } from 'vitest';
import {
  deriveStepAvailability,
  isWeaklyConnected,
  topologicallySortSteps,
  validateDependencyChange,
} from './process-graph';

const steps = [
  {
    stepId: 'discover',
    boardId: 'board',
    organizationId: 'org',
    title: '要件を確かめる',
    status: 'completed' as const,
  },
  {
    stepId: 'design',
    boardId: 'board',
    organizationId: 'org',
    title: '体験を設計する',
    status: 'not_started' as const,
  },
  {
    stepId: 'release',
    boardId: 'board',
    organizationId: 'org',
    title: '届ける',
    status: 'not_started' as const,
  },
];

const dependencies = [
  { predecessorStepId: 'discover', successorStepId: 'design' },
  { predecessorStepId: 'design', successorStepId: 'release' },
];

describe('process graph', () => {
  it('rejects an edge that closes a directed cycle', () => {
    expect(
      validateDependencyChange({
        steps,
        dependencies,
        candidate: {
          predecessorStepId: 'release',
          successorStepId: 'discover',
        },
      }),
    ).toEqual({ ok: false, reason: 'cycle' });
  });

  it('derives waiting only while a predecessor is incomplete', () => {
    expect(deriveStepAvailability(steps, dependencies)).toEqual({
      discover: 'completed',
      design: 'ready',
      release: 'waiting',
    });
  });

  it('returns a stable predecessor-first mobile order', () => {
    expect(
      topologicallySortSteps(steps, dependencies).map((step) => step.stepId),
    ).toEqual(['discover', 'design', 'release']);
  });

  it('detects an isolated step after removing its only dependency', () => {
    expect(
      isWeaklyConnected(steps, [
        { predecessorStepId: 'discover', successorStepId: 'design' },
      ]),
    ).toBe(false);
  });
});
