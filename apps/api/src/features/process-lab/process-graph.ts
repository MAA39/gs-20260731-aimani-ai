import type {
  ProcessStepStatus,
  StepDependency,
} from '@aimani-ai/contracts';

export type ProcessGraphViolation =
  | 'self_dependency'
  | 'duplicate'
  | 'missing_step'
  | 'cross_board'
  | 'cycle';

export type ProcessGraphStep = {
  stepId: string;
  boardId: string;
  organizationId: string;
  title: string;
  status: ProcessStepStatus;
};

type DependencyIdentity = Pick<
  StepDependency,
  'predecessorStepId' | 'successorStepId'
>;

function adjacencyFor(
  steps: readonly ProcessGraphStep[],
  dependencies: readonly DependencyIdentity[],
) {
  const adjacency = new Map(steps.map((step) => [step.stepId, [] as string[]]));
  for (const dependency of dependencies) {
    adjacency
      .get(dependency.predecessorStepId)
      ?.push(dependency.successorStepId);
  }
  return adjacency;
}

function canReach(
  adjacency: Map<string, string[]>,
  start: string,
  target: string,
) {
  const pending = [start];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

export function validateDependencyChange(input: {
  steps: readonly ProcessGraphStep[];
  dependencies: readonly DependencyIdentity[];
  candidate: DependencyIdentity;
}): { ok: true } | { ok: false; reason: ProcessGraphViolation } {
  const { steps, dependencies, candidate } = input;
  if (candidate.predecessorStepId === candidate.successorStepId) {
    return { ok: false, reason: 'self_dependency' };
  }
  if (
    dependencies.some(
      (dependency) =>
        dependency.predecessorStepId === candidate.predecessorStepId &&
        dependency.successorStepId === candidate.successorStepId,
    )
  ) {
    return { ok: false, reason: 'duplicate' };
  }

  const stepById = new Map(steps.map((step) => [step.stepId, step]));
  const predecessor = stepById.get(candidate.predecessorStepId);
  const successor = stepById.get(candidate.successorStepId);
  if (!predecessor || !successor) return { ok: false, reason: 'missing_step' };
  if (
    predecessor.boardId !== successor.boardId ||
    predecessor.organizationId !== successor.organizationId
  ) {
    return { ok: false, reason: 'cross_board' };
  }

  const adjacency = adjacencyFor(steps, dependencies);
  if (canReach(adjacency, successor.stepId, predecessor.stepId)) {
    return { ok: false, reason: 'cycle' };
  }
  return { ok: true };
}

export function deriveStepAvailability(
  steps: readonly ProcessGraphStep[],
  dependencies: readonly DependencyIdentity[],
): Record<string, 'ready' | 'waiting' | 'completed'> {
  const statusById = new Map(steps.map((step) => [step.stepId, step.status]));
  return Object.fromEntries(
    steps.map((step) => {
      if (step.status === 'completed') return [step.stepId, 'completed'];
      const predecessors = dependencies.filter(
        (dependency) => dependency.successorStepId === step.stepId,
      );
      const waiting = predecessors.some(
        (dependency) =>
          statusById.get(dependency.predecessorStepId) !== 'completed',
      );
      return [step.stepId, waiting ? 'waiting' : 'ready'];
    }),
  );
}

export function isWeaklyConnected(
  steps: readonly ProcessGraphStep[],
  dependencies: readonly DependencyIdentity[],
): boolean {
  if (steps.length <= 1) return true;
  if (dependencies.length === 0) return false;
  const knownSteps = new Set(steps.map((step) => step.stepId));
  const neighbors = new Map(steps.map((step) => [step.stepId, [] as string[]]));
  for (const dependency of dependencies) {
    if (
      !knownSteps.has(dependency.predecessorStepId) ||
      !knownSteps.has(dependency.successorStepId)
    ) {
      return false;
    }
    neighbors
      .get(dependency.predecessorStepId)!
      .push(dependency.successorStepId);
    neighbors
      .get(dependency.successorStepId)!
      .push(dependency.predecessorStepId);
  }
  const visited = new Set<string>();
  const pending = [steps[0]!.stepId];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(neighbors.get(current) ?? []));
  }
  return visited.size === steps.length;
}

export function topologicallySortSteps<T extends ProcessGraphStep>(
  steps: readonly T[],
  dependencies: readonly DependencyIdentity[],
): T[] {
  const order = new Map(steps.map((step, index) => [step.stepId, index]));
  const byId = new Map(steps.map((step) => [step.stepId, step]));
  const adjacency = adjacencyFor(steps, dependencies);
  const indegree = new Map(steps.map((step) => [step.stepId, 0]));
  for (const dependency of dependencies) {
    indegree.set(
      dependency.successorStepId,
      (indegree.get(dependency.successorStepId) ?? 0) + 1,
    );
  }
  const ready = steps
    .filter((step) => indegree.get(step.stepId) === 0)
    .map((step) => step.stepId);
  const sorted: T[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
    const current = ready.shift()!;
    const step = byId.get(current);
    if (step) sorted.push(step as T);
    for (const successor of adjacency.get(current) ?? []) {
      const nextDegree = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, nextDegree);
      if (nextDegree === 0) ready.push(successor);
    }
  }
  return sorted.length === steps.length ? sorted : [...steps];
}
