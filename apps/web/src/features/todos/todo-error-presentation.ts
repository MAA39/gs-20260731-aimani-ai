export type TodoOperationContext = 'assigned_workspace' | 'shared_workspace' | 'create';

const unavailableMessages: Record<TodoOperationContext, string> = {
  assigned_workspace: '担当中のTodoを読み込めませんでした。時間をおいてもう一度お試しください。',
  shared_workspace: 'PeopleのTodoを読み込めませんでした。時間をおいてもう一度お試しください。',
  create: 'Todoを作成できませんでした。時間をおいてもう一度お試しください。',
};

export function todoFailureMessage(context: TodoOperationContext, status: number): string {
  if (status === 400) return context === 'create' ? '入力内容を確認してください。' : 'Todoの指定を確認してください。';
  if (status === 403) return context === 'create' ? 'この組織ではTodoを作成できません。' : 'この組織ではTodoを閲覧できません。';
  if (status === 404) return context === 'assigned_workspace' ? '対象のTodo情報が見つかりません。画面を更新して確認してください。' : '対象のPeopleが見つかりません。組織のPeopleを確認してください。';
  if (status === 409) return 'Todoの状態が更新されています。画面を更新して確認してください。';
  return unavailableMessages[context];
}
