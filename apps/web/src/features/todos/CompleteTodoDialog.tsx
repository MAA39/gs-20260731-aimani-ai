import { Dialog } from '@base-ui/react/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { TodoSummary } from '@amidala/contracts';
import { completeTodo } from './todos.functions';
import { todoFailureMessage } from './todo-error-presentation';
import { completeTodoSuccessMessage } from './complete-todo-presentation';
import { assignedTodoWorkspaceKey } from './assigned-todo-queries';
import { todoHandoffWorkspaceKey } from '../handoffs/handoff-queries';
import { sharedTodoWorkspaceOrganizationPrefix } from './todo-queries';

type Props = { organizationId: string; todo: TodoSummary; onCompleted: (message: string) => void };

export function CompleteTodoDialog({ organizationId, todo, onCompleted }: Props) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: completeTodo });
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: assignedTodoWorkspaceKey(organizationId), exact: true }),
    queryClient.invalidateQueries({ queryKey: todoHandoffWorkspaceKey(organizationId), exact: true }),
    queryClient.invalidateQueries({ queryKey: sharedTodoWorkspaceOrganizationPrefix(organizationId), exact: false }),
  ]);

  async function submit() {
    setSubmitError('');
    let result: Awaited<ReturnType<typeof completeTodo>>;
    try {
      result = await mutation.mutateAsync({ data: { organizationId, todoId: todo.todoId } });
    } catch {
      setSubmitError(todoFailureMessage('complete', 503));
      return;
    }
    if (result.status !== 'ok') {
      setSubmitError(result.error.message);
      return;
    }
    await invalidate();
    setOpen(false);
    onCompleted(completeTodoSuccessMessage());
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) { mutation.reset(); setSubmitError(''); }
  }

  return <Dialog.Root open={open} onOpenChange={handleOpenChange}>
    <Dialog.Trigger className="quiet-button">完了にする</Dialog.Trigger>
    <Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Viewport className="dialog-viewport"><Dialog.Popup className="dialog-popup">
      <Dialog.Title>このTodoを完了しますか？</Dialog.Title>
      <Dialog.Description>{todo.title}</Dialog.Description>
      {submitError ? <p className="field-error" role="alert">{submitError}</p> : null}
      <div className="dialog-actions"><Dialog.Close className="secondary-button">戻る</Dialog.Close><button className="primary-button" type="button" onClick={submit} disabled={mutation.isPending}>{mutation.isPending ? '完了処理中…' : '完了にする'}</button></div>
    </Dialog.Popup></Dialog.Viewport></Dialog.Portal>
  </Dialog.Root>;
}
