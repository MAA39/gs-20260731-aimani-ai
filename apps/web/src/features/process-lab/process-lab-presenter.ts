import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type {
  ProcessLabWorkspace,
  ProcessStep,
  StepDependency,
} from '@amidala/contracts';

export type StepAvailability = 'ready' | 'waiting' | 'completed';
export type ResponsibilityPathRole =
  | 'selected'
  | 'upstream'
  | 'downstream'
  | 'none';

export type ProcessStepNodeData = Record<string, unknown> & {
  step: ProcessStep;
  availability: StepAvailability;
  pathRole: ResponsibilityPathRole;
};

export type ProcessFlowNode = Node<ProcessStepNodeData, 'processStep'>;
export type ProcessFlowEdge = Edge<{
  pathRole: Exclude<ResponsibilityPathRole, 'selected'>;
}>;

function availabilityByStep(workspace: ProcessLabWorkspace) {
  const statusByStep = new Map(
    workspace.steps.map((step) => [step.stepId, step.status]),
  );
  return new Map(
    workspace.steps.map((step) => {
      if (step.status === 'completed') return [step.stepId, 'completed'] as const;
      const waiting = workspace.dependencies.some(
        (dependency) =>
          dependency.successorStepId === step.stepId &&
          statusByStep.get(dependency.predecessorStepId) !== 'completed',
      );
      return [step.stepId, waiting ? 'waiting' : 'ready'] as const;
    }),
  );
}

function reachable(
  start: string,
  dependencies: readonly StepDependency[],
  direction: 'upstream' | 'downstream',
) {
  const found = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const dependency of dependencies) {
      const next =
        direction === 'downstream' && dependency.predecessorStepId === current
          ? dependency.successorStepId
          : direction === 'upstream' && dependency.successorStepId === current
            ? dependency.predecessorStepId
            : null;
      if (next && !found.has(next)) {
        found.add(next);
        pending.push(next);
      }
    }
  }
  return found;
}

function responsibilityPath(
  workspace: ProcessLabWorkspace,
  selectedStepId: string | null,
) {
  return {
    upstream: selectedStepId
      ? reachable(selectedStepId, workspace.dependencies, 'upstream')
      : new Set<string>(),
    downstream: selectedStepId
      ? reachable(selectedStepId, workspace.dependencies, 'downstream')
      : new Set<string>(),
  };
}

export function toFlowNodes(
  workspace: ProcessLabWorkspace,
  selectedStepId: string | null,
): ProcessFlowNode[] {
  const availability = availabilityByStep(workspace);
  const layoutByStep = new Map(
    workspace.layouts.map((layout) => [layout.stepId, layout]),
  );
  const path = responsibilityPath(workspace, selectedStepId);
  return workspace.steps.map((step, index) => {
    const layout = layoutByStep.get(step.stepId);
    const pathRole: ResponsibilityPathRole =
      step.stepId === selectedStepId
        ? 'selected'
        : path.upstream.has(step.stepId)
          ? 'upstream'
          : path.downstream.has(step.stepId)
            ? 'downstream'
            : 'none';
    return {
      id: step.stepId,
      type: 'processStep',
      position: layout ?? { x: index * 296, y: 160 },
      data: {
        step,
        availability: availability.get(step.stepId) ?? 'ready',
        pathRole,
      },
      selected: step.stepId === selectedStepId,
      ariaLabel: `${step.title}、${availability.get(step.stepId) === 'waiting' ? '待機中' : step.status === 'completed' ? '完了' : step.status === 'in_progress' ? '進行中' : '未着手'}`,
    };
  });
}

export function toFlowEdges(
  workspace: ProcessLabWorkspace,
  selectedStepId: string | null,
): ProcessFlowEdge[] {
  const path = responsibilityPath(workspace, selectedStepId);
  return workspace.dependencies.map((dependency) => {
    const isUpstream =
      (path.upstream.has(dependency.predecessorStepId) &&
        (path.upstream.has(dependency.successorStepId) ||
          dependency.successorStepId === selectedStepId));
    const isDownstream =
      (dependency.predecessorStepId === selectedStepId ||
        path.downstream.has(dependency.predecessorStepId)) &&
      path.downstream.has(dependency.successorStepId);
    const pathRole = isUpstream
      ? 'upstream'
      : isDownstream
        ? 'downstream'
        : 'none';
    return {
      id: `${dependency.predecessorStepId}__${dependency.successorStepId}`,
      source: dependency.predecessorStepId,
      target: dependency.successorStepId,
      data: { pathRole },
      className: `process-edge is-${pathRole}`,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      ariaLabel: `${dependency.predecessorStepId} から ${dependency.successorStepId} への依存`,
    };
  });
}

export function orderProcessSteps(workspace: ProcessLabWorkspace) {
  const byId = new Map(workspace.steps.map((step) => [step.stepId, step]));
  const originalOrder = new Map(
    workspace.steps.map((step, index) => [step.stepId, index]),
  );
  const indegree = new Map(
    workspace.steps.map((step) => [step.stepId, 0]),
  );
  for (const dependency of workspace.dependencies) {
    indegree.set(
      dependency.successorStepId,
      (indegree.get(dependency.successorStepId) ?? 0) + 1,
    );
  }
  const ready = workspace.steps
    .filter((step) => indegree.get(step.stepId) === 0)
    .map((step) => step.stepId);
  const sorted: ProcessStep[] = [];
  while (ready.length > 0) {
    ready.sort(
      (left, right) =>
        (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0),
    );
    const current = ready.shift()!;
    const step = byId.get(current);
    if (step) sorted.push(step);
    for (const dependency of workspace.dependencies) {
      if (dependency.predecessorStepId !== current) continue;
      const nextDegree = (indegree.get(dependency.successorStepId) ?? 0) - 1;
      indegree.set(dependency.successorStepId, nextDegree);
      if (nextDegree === 0) ready.push(dependency.successorStepId);
    }
  }
  return sorted.length === workspace.steps.length ? sorted : workspace.steps;
}

export function canConnectProcessSteps(
  workspace: ProcessLabWorkspace,
  source: string | null,
  target: string | null,
) {
  if (!source || !target || source === target) return false;
  const stepIds = new Set(workspace.steps.map((step) => step.stepId));
  if (!stepIds.has(source) || !stepIds.has(target)) return false;
  if (
    workspace.dependencies.some(
      (dependency) =>
        dependency.predecessorStepId === source &&
        dependency.successorStepId === target,
    )
  ) {
    return false;
  }
  return !reachable(target, workspace.dependencies, 'downstream').has(source);
}
