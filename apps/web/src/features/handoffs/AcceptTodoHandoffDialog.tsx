import { Dialog } from '@base-ui/react/dialog';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { TodoHandoffSummary } from '@aimani-ai/contracts';
import { acceptTodoHandoff } from './handoffs.functions';
import type { TodoHandoffMutationResult } from './handoff-schema';

type Props = {
  handoff: TodoHandoffSummary;
  disabled: boolean;
  onAccepted: (result: TodoHandoffMutationResult) => Promise<void>;
  onFailure: (message: string) => void;
  onPendingChange: (pending: boolean) => void;
};

export function AcceptTodoHandoffDialog({ handoff, disabled, onAccepted, onFailure, onPendingChange }: Props) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const mutation = useMutation({ mutationFn: acceptTodoHandoff });
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) { mutation.reset(); setSubmitError(''); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitError('');
    onPendingChange(true);
    const form = new FormData(event.currentTarget);
    const nextAction = String(form.get('nextAction') ?? '').trim();
    try {
      const result = await mutation.mutateAsync({ data: { organizationId: handoff.organizationId, handoffId: handoff.handoffId, ...(nextAction ? { nextAction } : {}) } });
      if (result.status !== 'ok') { setSubmitError(result.error.message); onFailure(result.error.message); return; }
      await onAccepted(result);
      setOpen(false);
    } catch {
      const message = '引き継ぎの処理に失敗しました。再試行してください。';
      setSubmitError(message); onFailure(message);
    } finally {
      onPendingChange(false);
    }
  }
  return <Dialog.Root open={open} onOpenChange={handleOpenChange}>
    <Dialog.Trigger className="primary-button" disabled={disabled}>引き受ける</Dialog.Trigger>
    <Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Viewport className="dialog-viewport"><Dialog.Popup className="dialog-popup">
      <Dialog.Title>このTodoを引き受けますか？</Dialog.Title><Dialog.Description>{handoff.todo.title}</Dialog.Description>
      <form onSubmit={submit} className="handoff-form">
        <label className="form-field">次の一手（任意）<textarea name="nextAction" maxLength={240} rows={3} placeholder="次に何をするかを短く書きます" /></label>
        {submitError ? <p className="field-error" role="alert">{submitError}</p> : null}
        <div className="dialog-actions"><Dialog.Close className="secondary-button">戻る</Dialog.Close><button className="primary-button" type="submit" disabled={mutation.isPending}>{mutation.isPending ? '引き受け処理中…' : '引き受ける'}</button></div>
      </form>
    </Dialog.Popup></Dialog.Viewport></Dialog.Portal>
  </Dialog.Root>;
}
