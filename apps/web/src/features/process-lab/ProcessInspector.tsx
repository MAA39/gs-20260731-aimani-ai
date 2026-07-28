import { ArrowDownRight, ArrowUpRight, Link2Off } from 'lucide-react';
import type {
  ProcessLabWorkspace,
  ProcessStepStatus,
} from '@amidala/contracts';
import type { StepAvailability } from './process-lab-presenter';

type SelectedDependency = { source: string; target: string } | null;

export function ProcessInspector({
  workspace,
  selectedStepId,
  selectedDependency,
  availability,
  busy,
  error,
  onStatusChange,
  onDisconnect,
  onRetry,
}: {
  workspace: ProcessLabWorkspace;
  selectedStepId: string | null;
  selectedDependency: SelectedDependency;
  availability: StepAvailability | null;
  busy: boolean;
  error: string;
  onStatusChange: (status: ProcessStepStatus) => void;
  onDisconnect: () => void;
  onRetry: (() => void) | null;
}) {
  const step = workspace.steps.find((candidate) => candidate.stepId === selectedStepId);
  const titleById = new Map(
    workspace.steps.map((candidate) => [candidate.stepId, candidate.title]),
  );

  if (selectedDependency) {
    return (
      <aside className="process-inspector" aria-label="選択した工程のつながり">
        <p className="eyebrow">DEPENDENCY</p>
        <h3>工程のつながり</h3>
        <div className="process-dependency-route">
          <strong>{titleById.get(selectedDependency.source)}</strong>
          <span aria-hidden="true">→</span>
          <strong>{titleById.get(selectedDependency.target)}</strong>
        </div>
        <p>前の工程が完了すると、次の工程を開始できます。</p>
        <button
          className="danger-quiet-button"
          type="button"
          onClick={onDisconnect}
          disabled={busy}
        >
          <Link2Off size={16} aria-hidden="true" />
          このつながりを外す
        </button>
        {error ? <ProcessMutationError message={error} onRetry={onRetry} /> : null}
      </aside>
    );
  }

  if (!step) {
    return (
      <aside className="process-inspector is-empty">
        <p className="eyebrow">INSPECTOR</p>
        <h3>工程を選んでください</h3>
        <p>工程を選ぶと、その前後にある責任の経路と担当を確認できます。</p>
      </aside>
    );
  }

  const predecessors = workspace.dependencies
    .filter((dependency) => dependency.successorStepId === step.stepId)
    .map((dependency) => titleById.get(dependency.predecessorStepId));
  const successors = workspace.dependencies
    .filter((dependency) => dependency.predecessorStepId === step.stepId)
    .map((dependency) => titleById.get(dependency.successorStepId));

  return (
    <aside className="process-inspector" aria-label={`${step.title}の詳細`}>
      <p className="eyebrow">PROCESS STEP</p>
      <h3>{step.title}</h3>
      <p className={`process-inspector-state is-${availability}`}>
        {availability === 'waiting'
          ? '先行工程の完了待ち'
          : step.status === 'completed'
            ? '完了'
            : step.status === 'in_progress'
              ? '進行中'
              : '開始できます'}
      </p>
      {step.description ? <p>{step.description}</p> : null}
      <dl className="process-detail-list">
        <div><dt>担当</dt><dd>{step.assignee?.name ?? '未定'}</dd></div>
        <div><dt>期限</dt><dd>{step.dueDate ?? '未定'}</dd></div>
      </dl>
      <div className="process-status-actions" aria-label="工程の状態を変更">
        <button type="button" className={step.status === 'not_started' ? 'is-active' : ''} onClick={() => onStatusChange('not_started')} disabled={busy}>未着手</button>
        <button type="button" className={step.status === 'in_progress' ? 'is-active' : ''} onClick={() => onStatusChange('in_progress')} disabled={busy || availability === 'waiting'}>進行中</button>
        <button type="button" className={step.status === 'completed' ? 'is-active' : ''} onClick={() => onStatusChange('completed')} disabled={busy}>完了</button>
      </div>
      {availability === 'waiting' ? <p className="process-waiting-note">先行工程が完了すると「進行中」にできます。</p> : null}
      <div className="process-responsibility-path">
        <div>
          <ArrowUpRight size={16} aria-hidden="true" />
          <span>この工程へ渡す</span>
          <strong>{predecessors.length ? predecessors.join('、') : '起点の工程'}</strong>
        </div>
        <div>
          <ArrowDownRight size={16} aria-hidden="true" />
          <span>この工程から渡す</span>
          <strong>{successors.length ? successors.join('、') : '終点の工程'}</strong>
        </div>
      </div>
      {busy ? <p className="process-saving" aria-live="polite">保存中…</p> : null}
      {error ? <ProcessMutationError message={error} onRetry={onRetry} /> : null}
    </aside>
  );
}

function ProcessMutationError({ message, onRetry }: { message: string; onRetry: (() => void) | null }) {
  return (
    <div className="process-mutation-error" role="alert">
      <p>{message}</p>
      {onRetry ? <button type="button" onClick={onRetry}>もう一度試す</button> : null}
    </div>
  );
}
