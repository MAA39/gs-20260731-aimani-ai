import type { TodoSummary } from '@amidala/contracts';
import { TodoCard } from '../todos/TodoCard';
import { teamWorkStatus } from './team-work-status';

export function TeamWorkTodoCard({ todo }: { todo: TodoSummary }) {
  const status = teamWorkStatus(todo);
  const action = (
    <div className={`team-work-status ${status.kind}`}>
      <span className="label">現在の状況</span>
      <strong>{status.label}</strong>
      {todo.pendingHandoff ? (
        <div
          className="team-work-handoff-rail"
          aria-label={`現在担当 ${todo.assignee.name}、引き継ぎ先 ${todo.pendingHandoff.recipient.name}`}
        >
          <span><small>現在担当</small>{todo.assignee.name}</span>
          <span className="team-work-handoff-arrow" aria-hidden="true">→</span>
          <span><small>引き継ぎ先</small>{todo.pendingHandoff.recipient.name}</span>
        </div>
      ) : null}
    </div>
  );
  return <TodoCard todo={todo} action={action} />;
}
