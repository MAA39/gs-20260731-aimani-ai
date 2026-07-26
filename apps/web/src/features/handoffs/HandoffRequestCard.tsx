import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TodoHandoffSummary } from '@amidala/contracts';
import { acceptTodoHandoff, rejectTodoHandoff, cancelTodoHandoff } from './handoffs.functions';
import { todoHandoffWorkspaceKey } from './handoff-queries';
import { assignedTodoWorkspaceKey } from '../todos/assigned-todo-queries';
import { sharedTodoWorkspaceOrganizationPrefix } from '../todos/todo-queries';
import { useState } from 'react';

export function HandoffRequestCard({ handoff, kind, currentMembershipId, onAnnounce }: { handoff: TodoHandoffSummary; kind: 'incoming' | 'outgoing' | 'recent'; currentMembershipId: string; onAnnounce: (message: string) => void }) {
  const mutation = useMutation({ mutationFn: async (action: 'accept' | 'reject' | 'cancel') => action === 'accept' ? acceptTodoHandoff({ data: { organizationId: handoff.organizationId, handoffId: handoff.handoffId } }) : action === 'reject' ? rejectTodoHandoff({ data: { organizationId: handoff.organizationId, handoffId: handoff.handoffId } }) : cancelTodoHandoff({ data: { organizationId: handoff.organizationId, handoffId: handoff.handoffId } }) });
  const client = useQueryClient();
  const [resultMessage, setResultMessage] = useState('');
  async function decide(action: 'accept' | 'reject' | 'cancel') {
    setResultMessage(''); onAnnounce('引き継ぎを処理中です。');
    try {
      const result = await mutation.mutateAsync(action);
      await Promise.all([client.invalidateQueries({ queryKey: todoHandoffWorkspaceKey(handoff.organizationId), exact: true }), client.invalidateQueries({ queryKey: assignedTodoWorkspaceKey(handoff.organizationId), exact: true }), client.invalidateQueries({ queryKey: sharedTodoWorkspaceOrganizationPrefix(handoff.organizationId), exact: false })]);
      if (result.status === 'conflict') { setResultMessage('この依頼はすでに処理されています。'); onAnnounce('この依頼はすでに処理されています。'); mutation.reset(); return; }
      if (result.status !== 'ok') { setResultMessage(result.error.message); onAnnounce(result.error.message); return; }
      const message = action === 'accept' ? '引き継ぎを受け入れました。' : action === 'reject' ? '引き継ぎを見送りました。' : '引き継ぎ依頼を取り消しました。'; setResultMessage(message); onAnnounce(message);
    } catch { const message = '引き継ぎの処理に失敗しました。再試行してください。'; setResultMessage(message); onAnnounce(message); }
  }
  const displayedAt = kind === 'recent' ? handoff.resolvedAt : handoff.requestedAt;
  const date = displayedAt ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(displayedAt)) : null;
  const terminal = handoff.status !== 'requested';
  const canReviewAcceptedTodo = handoff.status === 'accepted' && handoff.recipient.membershipId === currentMembershipId && handoff.todo.assignee.membershipId === currentMembershipId;
  const railCopy = handoff.status === 'accepted' ? '責任が移りました' : handoff.status === 'requested' ? '引き継ぎの提案' : handoff.status === 'rejected' ? '提案を見送り' : '依頼を取消済み';
  return <article className={`handoff-card ${handoff.status}`} aria-busy={mutation.isPending}><div className="handoff-card-copy"><div className="todo-card-heading"><h3>{handoff.todo.title}</h3><span className="handoff-status">{handoff.status === 'requested' ? '引き継ぎを依頼中' : handoff.status === 'accepted' ? '引き継ぎ済み' : handoff.status === 'rejected' ? '引き継ぎを見送り' : '引き継ぎ依頼を取消済み'}</span></div><div className={`handoff-rail rail-${handoff.status}`} aria-label={`${handoff.requester.name}から${handoff.recipient.name}への${railCopy}`}><span>{handoff.requester.name}</span><span className="todo-rail-line">{handoff.status === 'accepted' ? 'Todo →' : handoff.status === 'requested' ? 'Todo · 提案 →' : 'Todo · 変更なし'}</span><span>{handoff.recipient.name}</span></div>{handoff.requestMessage ? <p className="handoff-message">{handoff.requestMessage}</p> : null}{displayedAt && date ? <time dateTime={displayedAt}>{date}</time> : null}</div><div className="handoff-actions" aria-live="polite">{mutation.isPending ? <span>処理中…</span> : null}{resultMessage ? <span role="status">{resultMessage}</span> : null}{kind === 'incoming' && !terminal ? <><button className="primary-button" disabled={mutation.isPending} onClick={() => decide('accept')}>引き受ける</button><button className="secondary-button" disabled={mutation.isPending} onClick={() => decide('reject')}>見送る</button></> : null}{kind === 'outgoing' && !terminal ? <button className="quiet-button" disabled={mutation.isPending} onClick={() => decide('cancel')}>依頼を取り消す</button> : null}{canReviewAcceptedTodo ? <Link className="quiet-button" to="/$organizationId/todos" params={{ organizationId: handoff.organizationId }}>自分のTodoで確認</Link> : null}</div></article>;
}
