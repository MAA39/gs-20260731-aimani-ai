import { Link } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { useRef } from 'react';
import type { AssignedTodoWorkspaceResult } from '../handoffs/handoff-schema';
import { TodoCard } from './TodoCard';
import { RequestTodoHandoffDialog } from '../handoffs/RequestTodoHandoffDialog';

export function AssignedTodoPage({ organizationId, result, retry }: { organizationId: string; result: AssignedTodoWorkspaceResult; retry?: () => void }) {
  if (result.status !== 'ok') return <section className="content"><div className="empty-surface"><h2>{result.status === 'forbidden' ? 'この組織では閲覧できません' : result.status === 'not_found' ? '組織が見つかりません' : 'Todoを読み込めませんでした'}</h2><p>{result.error.message}</p>{retry ? <button className="secondary-button" type="button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />再試行</button> : null}<Link className="secondary-button" to="/organizations">組織を選び直す</Link></div></section>;
  const { workspace } = result;
  return <section className="content assigned-todo-page"><header className="people-context"><div><p className="eyebrow">{workspace.organization.name}</p><h2>自分のTodo</h2><p>{workspace.currentMember.name}さんが現在担当している仕事</p></div><Link className="secondary-button" to="/$organizationId/people" params={{ organizationId }}>Peopleを見る</Link></header>
    {workspace.todos.length ? <div className="todo-list">{workspace.todos.map((todo) => <AssignedCard key={todo.todoId} todo={todo} organizationId={organizationId} currentMembershipId={workspace.currentMember.membershipId} />)}</div> : <div className="empty-surface todo-empty"><h3>現在担当しているTodoはありません</h3><p>Peopleから関係する相手を選び、次のTodoを確認できます。</p><Link className="secondary-button" to="/$organizationId/people" params={{ organizationId }}>Peopleを見る</Link></div>}
  </section>;
}
function AssignedCard({ todo, organizationId, currentMembershipId }: { todo: import('@amidala/contracts').TodoSummary; organizationId: string; currentMembershipId: string }) {
  const actionRef = useRef<HTMLDivElement>(null);
  const action = todo.pendingHandoff ? <div className="todo-handoff-action" ref={actionRef} tabIndex={-1} aria-live="polite"><span className="handoff-pending">引き継ぎを依頼中</span><span>{todo.assignee.name} → {todo.pendingHandoff.recipient.name}</span>{todo.pendingHandoff.requestMessage ? <small>依頼メッセージ: {todo.pendingHandoff.requestMessage}</small> : null}</div> : <div className="todo-handoff-action" ref={actionRef} tabIndex={-1}><RequestTodoHandoffDialog organizationId={organizationId} todo={todo} currentMembershipId={currentMembershipId} onRequested={() => actionRef.current?.focus()} /></div>;
  return <TodoCard todo={todo} action={todo.assignee.membershipId === currentMembershipId ? action : undefined} />;
}
