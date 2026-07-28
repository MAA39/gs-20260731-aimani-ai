import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Check, Clock3, Circle, UserRound } from 'lucide-react';
import type { ProcessFlowNode } from './process-lab-presenter';

const statusLabel = {
  not_started: '未着手',
  in_progress: '進行中',
  completed: '完了',
} as const;

export function ProcessStepNode({ data, selected }: NodeProps<ProcessFlowNode>) {
  const { step, availability, pathRole } = data;
  const initial = step.assignee?.name.trim().charAt(0) || '?';
  return (
    <article
      className={`process-step-node is-${availability} is-path-${pathRole}${selected ? ' is-selected' : ''}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="process-handle"
        aria-label={`${step.title}へのつながりを受ける`}
      />
      <div className="process-node-kicker">
        <span className={`process-status-dot is-${step.status}`} aria-hidden="true">
          {step.status === 'completed' ? <Check size={11} /> : <Circle size={8} />}
        </span>
        <span>{availability === 'waiting' ? '待機中' : statusLabel[step.status]}</span>
      </div>
      <h3>{step.title}</h3>
      <div className="process-node-meta">
        <span className="process-assignee">
          <span className="avatar process-avatar">{initial}</span>
          {step.assignee?.name ?? '担当未定'}
        </span>
        <span>
          {step.dueDate ? <Clock3 size={13} aria-hidden="true" /> : <UserRound size={13} aria-hidden="true" />}
          {step.dueDate ?? '期限未定'}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="process-handle"
        aria-label={`${step.title}から次の工程へつなぐ`}
      />
    </article>
  );
}
