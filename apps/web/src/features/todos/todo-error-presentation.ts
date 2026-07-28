export type TodoOperationContext = 'assigned_workspace' | 'shared_workspace' | 'create' | 'complete';

const unavailableMessages: Record<TodoOperationContext, string> = {
  assigned_workspace: '担当中のTodoを読み込めませんでした。時間をおいてもう一度お試しください。',
  shared_workspace: 'PeopleのTodoを読み込めませんでした。時間をおいてもう一度お試しください。',
  create: 'Todoを作成できませんでした。時間をおいてもう一度お試しください。',
  complete: 'Todoを完了できませんでした。時間をおいて、もう一度お試しください。',
};

export function todoFailureMessage(context: TodoOperationContext, status: number, reason?: string): string {
  if (context === 'complete' && status === 403) return '現在の担当者だけがこのTodoを完了できます。';
  if (context === 'complete' && status === 409 && reason === 'handoff_pending') return '引き継ぎの確認待ちです。依頼を取り消すか、相手の返答後に完了してください。';
  if (context === 'complete' && status === 404) return 'このTodoは見つかりませんでした。';
  if (context === 'complete' && status === 400) return 'Todoを完了する入力を確認してください。';
  if (context === 'complete') return unavailableMessages.complete;
  if (status === 400) return context === 'create' ? '入力内容を確認してください。' : 'Todoの指定を確認してください。';
  if (status === 403) return context === 'create' ? 'この組織ではTodoを作成できません。' : 'この組織ではTodoを閲覧できません。';
  if (status === 404) return context === 'assigned_workspace' ? '対象のTodo情報が見つかりません。画面を更新して確認してください。' : '対象のPeopleが見つかりません。組織のPeopleを確認してください。';
  if (status === 409) return 'Todoの状態が更新されています。画面を更新して確認してください。';
  return unavailableMessages[context];
}
