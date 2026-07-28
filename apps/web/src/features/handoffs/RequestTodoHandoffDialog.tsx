import { Dialog } from '@base-ui/react/dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { TodoSummary } from '@amidala/contracts';
import { peopleQuery } from '../people/people-queries';
import { requestTodoHandoff } from './handoffs.functions';
import { assignedTodoWorkspaceKey } from '../todos/assigned-todo-queries';
import { todoHandoffWorkspaceKey } from './handoff-queries';
import { teamWorkOverviewKey } from '../work/team-work-queries';
import { sharedTodoWorkspaceOrganizationPrefix } from '../todos/todo-queries';

type Props = { organizationId: string; todo: TodoSummary; currentMembershipId: string; onRequested: () => void };

export function RequestTodoHandoffDialog({ organizationId, todo, currentMembershipId, onRequested }: Props) {
  const [open, setOpen] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const queryClient = useQueryClient();
  const people = useQuery({ ...peopleQuery(organizationId), enabled: open });
  const mutation = useMutation({ mutationFn: requestTodoHandoff });
  const invalidate = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: assignedTodoWorkspaceKey(organizationId), exact: true }),
    queryClient.invalidateQueries({ queryKey: todoHandoffWorkspaceKey(organizationId), exact: true }),
    queryClient.invalidateQueries({ queryKey: teamWorkOverviewKey(organizationId), exact: true }),
    queryClient.invalidateQueries({ queryKey: sharedTodoWorkspaceOrganizationPrefix(organizationId), exact: false }),
  ]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setRecipientError(''); setMessageError(''); setSubmitError('');
    const form = new FormData(event.currentTarget);
    const recipientMembershipId = String(form.get('recipientMembershipId') ?? '');
    const requestMessage = String(form.get('requestMessage') ?? '').trim();
    if (!recipientMembershipId) { setRecipientError('引き継ぎ先を選択してください。'); return; }
    if (requestMessage.length > 500) { setMessageError('メッセージは500文字以内で入力してください。'); return; }
    let result: Awaited<ReturnType<typeof requestTodoHandoff>>;
    try {
      result = await mutation.mutateAsync({ data: { organizationId, todoId: todo.todoId, recipientMembershipId, ...(requestMessage ? { requestMessage } : {}) } });
    } catch {
      setSubmitError('引き継ぎを依頼できませんでした。時間をおいて、もう一度お試しください。');
      return;
    }
    if (result.status === 'conflict') { setSubmitError(result.error.message); await invalidate().catch(() => undefined); return; }
    if (result.status !== 'ok') { setSubmitError(result.error.message); return; }
    setOpen(false); await invalidate(); onRequested();
  }
  const candidates = people.data?.status === 'ok' ? people.data.people.filter((person) => person.membershipId !== currentMembershipId) : [];
  function handleOpenChange(nextOpen: boolean) { setOpen(nextOpen); if (!nextOpen) { mutation.reset(); setSelectedRecipient(''); setRecipientError(''); setMessageError(''); setSubmitError(''); } }
  return <Dialog.Root open={open} onOpenChange={handleOpenChange}>
    <Dialog.Trigger className="secondary-button todo-handoff-trigger">引き継ぎを依頼</Dialog.Trigger>
    <Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Viewport className="dialog-viewport"><Dialog.Popup className="dialog-popup">
      <Dialog.Title>Todoを引き継ぐ</Dialog.Title><Dialog.Description>{todo.title}</Dialog.Description>
      <form onSubmit={submit} className="handoff-form">
        {people.isLoading ? <p className="handoff-state" aria-live="polite">候補を読み込んでいます…</p> : null}
        {people.data?.status === 'forbidden' ? <div className="handoff-state"><p>この組織のPeopleを閲覧できません。</p><a href="/organizations">組織を選び直す</a></div> : null}
        {people.data?.status === 'error' ? <div className="handoff-state"><p>{people.data.error.message}</p><button type="button" className="secondary-button" onClick={() => people.refetch()}>再試行</button></div> : null}
        {people.data?.status === 'ok' && candidates.length === 0 ? <p className="handoff-state">引き継ぎ先に選べるPeopleがいません。</p> : null}
        {people.data?.status === 'ok' && candidates.length > 0 ? <label className="form-field">引き継ぎ先<select name="recipientMembershipId" value={selectedRecipient} onChange={(event) => { setSelectedRecipient(event.currentTarget.value); setRecipientError(''); }}><option value="">選択してください</option>{candidates.map((person) => <option key={person.membershipId} value={person.membershipId}>{person.name} · {person.title ?? '役割を未設定'}</option>)}</select>{recipientError ? <span className="field-error">{recipientError}</span> : null}</label> : null}
        <label className="form-field">背景と期待（任意）<textarea name="requestMessage" maxLength={500} rows={4} placeholder="背景と、次に期待することを伝えます" />{messageError ? <span className="field-error">{messageError}</span> : null}</label>
        {submitError ? <p className="field-error" role="alert">{submitError}</p> : null}
        <div className="dialog-actions"><Dialog.Close className="secondary-button">閉じる</Dialog.Close><button className="primary-button" type="submit" disabled={mutation.isPending || !selectedRecipient}>{mutation.isPending ? '依頼中…' : '引き継ぎを依頼'}</button></div>
      </form>
    </Dialog.Popup></Dialog.Viewport></Dialog.Portal>
  </Dialog.Root>;
}
