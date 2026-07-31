import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type RefObject } from 'react';
import { createSharedTodo } from './todos.functions';
import { createSharedTodoInputSchema } from './todo-schema';
import type { SharedTodoWorkspace } from '@aimani-ai/contracts';

export function TodoComposer({ workspace, titleInputRef }: { workspace: SharedTodoWorkspace; titleInputRef: RefObject<HTMLInputElement | null> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const queryKey = ['sharedTodoWorkspace', workspace.organization.organizationId, workspace.contextMember.membershipId];
  const mutation = useMutation({
    mutationFn: async (input: { title: string; description?: string; assigneeMembershipId: string }) => {
      const result = await createSharedTodo({ data: { organizationId: workspace.organization.organizationId, contextMembershipId: workspace.contextMember.membershipId, ...input } });
      if (result.status !== 'ok') throw new Error(result.error.message);
      return result.todo;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      formRef.current?.reset();
      setSuccessMessage('Todoを作成しました。共有Todoに反映されています。');
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);
    const formData = new FormData(event.currentTarget);
    const description = String(formData.get('description') ?? '').trim();
    const parsed = createSharedTodoInputSchema.safeParse({
      organizationId: workspace.organization.organizationId,
      contextMembershipId: workspace.contextMember.membershipId,
      title: String(formData.get('title') ?? ''),
      description: description || undefined,
      assigneeMembershipId: String(formData.get('assigneeMembershipId') ?? ''),
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? '入力内容を確認してください。');
      return;
    }
    mutation.mutate({ title: parsed.data.title, description: parsed.data.description, assigneeMembershipId: parsed.data.assigneeMembershipId });
  }

  return <form ref={formRef} className="todo-composer" onSubmit={handleSubmit} aria-busy={mutation.isPending}>
    <div className="section-heading"><div><p className="eyebrow">次の一手</p><h3>Todoを作る</h3></div></div>
    <label className="form-field"><span>タイトル</span><input ref={titleInputRef} name="title" required maxLength={160} placeholder="例：来週の1on1で確認する" /></label>
    <label className="form-field"><span>説明（任意）</span><textarea name="description" maxLength={2000} rows={3} placeholder="背景や完了の条件をメモできます" /></label>
    <fieldset className="assignee-field"><legend>担当</legend><div className="assignee-options">
      <label className="assignee-option"><input type="radio" name="assigneeMembershipId" value={workspace.currentMember.membershipId} defaultChecked />あなた</label>
      <label className="assignee-option"><input type="radio" name="assigneeMembershipId" value={workspace.contextMember.membershipId} />{workspace.contextMember.name || '相手'}にお願い</label>
    </div></fieldset>
    {validationError ? <p className="field-error" role="alert">{validationError}</p> : null}
    {mutation.isError ? <p className="field-error" role="alert">Todoを作成できませんでした。{mutation.error.message}</p> : null}
    {successMessage ? <p className="success-message" aria-live="polite">{successMessage}</p> : null}
    <button className="primary-button todo-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Todoを作成中…' : 'Todoを作る'}</button>
  </form>;
}
