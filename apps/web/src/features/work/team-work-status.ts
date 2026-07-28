import type { TodoSummary } from '@amidala/contracts';

export type TeamWorkStatus =
  | { kind: 'in_progress'; label: '対応中' }
  | { kind: 'handoff_pending'; label: string }
  | { kind: 'completed'; label: '完了' };

export function teamWorkStatus(todo: TodoSummary): TeamWorkStatus {
  if (todo.status === 'completed') return { kind: 'completed', label: '完了' };
  if (todo.pendingHandoff) {
    return {
      kind: 'handoff_pending',
      label: `${todo.pendingHandoff.recipient.name}さんの確認待ち`,
    };
  }
  return { kind: 'in_progress', label: '対応中' };
}
