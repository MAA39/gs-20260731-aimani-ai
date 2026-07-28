import { ChevronRight } from 'lucide-react';
import type {
  ProcessLabWorkspace,
  ProcessStepStatus,
} from '@amidala/contracts';
import { orderProcessSteps, toFlowNodes } from './process-lab-presenter';

export function MobileProcessList({
  workspace,
  busy,
  onStatusChange,
}: {
  workspace: ProcessLabWorkspace;
  busy: boolean;
  onStatusChange: (stepId: string, status: ProcessStepStatus) => void;
}) {
  const availability = new Map(
    toFlowNodes(workspace, null).map((node) => [node.id, node.data.availability]),
  );
  return (
    <ol className="mobile-process-list" aria-label="工程一覧">
      {orderProcessSteps(workspace).map((step, index) => {
        const waiting = availability.get(step.stepId) === 'waiting';
        return (
          <li key={step.stepId} className={waiting ? 'is-waiting' : ''}>
            <div className="mobile-process-index">{String(index + 1).padStart(2, '0')}</div>
            <article>
              <div className="mobile-process-heading">
                <div>
                  <p>{waiting ? '先行工程の完了待ち' : step.status === 'completed' ? '完了' : step.status === 'in_progress' ? '進行中' : '開始できます'}</p>
                  <h3>{step.title}</h3>
                </div>
                {index < workspace.steps.length - 1 ? <ChevronRight size={18} aria-hidden="true" /> : null}
              </div>
              <p>{step.description}</p>
              <div className="mobile-process-meta"><span>{step.assignee?.name ?? '担当未定'}</span><span>{step.dueDate ?? '期限未定'}</span></div>
              <label>
                <span>状態</span>
                <select value={step.status} disabled={busy} onChange={(event) => onStatusChange(step.stepId, event.target.value as ProcessStepStatus)}>
                  <option value="not_started">未着手</option>
                  <option value="in_progress" disabled={waiting}>進行中</option>
                  <option value="completed">完了</option>
                </select>
              </label>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
