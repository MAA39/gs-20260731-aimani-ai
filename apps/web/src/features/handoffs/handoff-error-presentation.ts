import { knownTodoHandoffConflictReasonSchema } from './handoff-schema';
import type { TodoHandoffConflictReason, TodoHandoffFailure } from './handoff-schema';

const conflictMessages: Record<TodoHandoffConflictReason, string> = {
  handoff_already_requested: 'このTodoにはすでに引き継ぎ依頼があります。画面を更新して確認してください。',
  handoff_already_resolved: 'この引き継ぎ依頼はすでに対応済みです。画面を更新して確認してください。',
  requester_is_not_current_assignee: 'このTodoの担当者が変更されています。画面を更新して確認してください。',
  todo_not_open: '完了したTodoは引き継げません。画面を更新して確認してください。',
  invalid_recipient: '選択した引き継ぎ先を指定できません。別のPeopleを選択してください。',
  inactive_recipient: '選択した引き継ぎ先は現在利用できません。別のPeopleを選択してください。',
  unknown: '引き継ぎの状態が更新されています。画面を更新して確認してください。',
};

function upstreamReasonOf(body: unknown): TodoHandoffConflictReason {
  if (typeof body !== 'object' || body === null || !('error' in body)) return 'unknown';
  const error = (body as { error?: { reason?: unknown; message?: unknown } }).error;
  const candidates = [error?.reason, error?.message];
  for (const candidate of candidates) {
    const parsed = knownTodoHandoffConflictReasonSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return 'unknown';
}

export function classifyTodoHandoffFailure(status: number, body: unknown): TodoHandoffFailure | null {
  if (status === 403) {
    return { status: 'forbidden', error: { code: 'forbidden', message: 'この組織では操作できません。' } };
  }
  if (status === 404) {
    return { status: 'not_found', error: { code: 'not_found', message: '対象が見つかりません。画面を更新して確認してください。' } };
  }
  if (status === 409) {
    const reason = upstreamReasonOf(body);
    return { status: 'conflict', error: { code: 'conflict', reason, message: conflictMessages[reason] } };
  }
  if (status === 400) {
    return { status: 'error', error: { code: 'validation_error', message: '入力内容を確認してください。' } };
  }
  return null;
}
