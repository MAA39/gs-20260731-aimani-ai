import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useRef } from 'react';
import type { SharedTodoWorkspaceResult } from './todo-schema';
import { TodoCard } from './TodoCard';
import { TodoComposer } from './TodoComposer';
import { RequestTodoHandoffDialog } from '../handoffs/RequestTodoHandoffDialog';

const relationshipLabels = { manager_report: '直属の部下', supporter: 'サポートする人', peer: '同僚' } as const;

export function TodoPage({ organizationId, result, retry }: { organizationId: string; result: SharedTodoWorkspaceResult; retry?: () => void }) {
  const titleRef = useRef<HTMLInputElement>(null);
  if (result.status !== 'ok') return <section className="content"><div className="empty-surface"><h2>{result.status === 'forbidden' ? 'この組織では閲覧できません' : result.status === 'not_found' ? '相手が見つかりません' : '共有Todoを読み込めませんでした'}</h2><p>{result.error.message}</p>{retry ? <button className="secondary-button" type="button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />再試行</button> : null}<Link className="secondary-button" to="/$organizationId/people" params={{ organizationId }}>Peopleへ戻る</Link></div></section>;
  const { workspace } = result;
  const relationships = workspace.contextMember.relationshipKinds.map((kind) => relationshipLabels[kind]);
  return <section className="content todo-workspace">
    <Link className="back-link" to="/$organizationId/people" params={{ organizationId }}><ArrowLeft size={17} aria-hidden="true" />Peopleへ戻る</Link>
    <header className="todo-context"><div className="todo-context-heading"><div className="avatar large">{workspace.contextMember.name.trim().charAt(0) || '?'}</div><div><p className="eyebrow">{workspace.organization.name} · 共有Todo</p><h2>{workspace.contextMember.name}さんとの仕事</h2><p>{workspace.contextMember.title ?? '役割を未設定'} · {relationships.length ? relationships.join(' · ') : '関係を未設定'}</p></div></div><div className="todo-relationship-rail"><span>{workspace.currentMember.name || 'あなた'}</span><span className="todo-rail-line">Shared Todo</span><span>{workspace.contextMember.name}</span></div></header>
    <TodoComposer workspace={workspace} titleInputRef={titleRef} />
    <div className="section-heading todo-list-heading"><div><p className="eyebrow">SHARED WORK</p><h3>共有Todo</h3></div></div>
    {workspace.todos.length ? <div className="todo-list">{workspace.todos.map((todo) => <PersonTodoCard key={todo.todoId} todo={todo} organizationId={organizationId} currentMembershipId={workspace.currentMember.membershipId} />)}</div> : <div className="empty-surface todo-empty"><h3>この人との共有Todoはまだありません</h3><p>次の一手を1つ作ると、ここで担当と進み具合を確認できます。</p><button className="secondary-button" type="button" onClick={() => titleRef.current?.focus()}>最初のTodoを作る</button></div>}
  </section>;
}
function PersonTodoCard({ todo, organizationId, currentMembershipId }: { todo: import('@amidala/contracts').TodoSummary; organizationId: string; currentMembershipId: string }) { const ref = useRef<HTMLDivElement>(null); const action = todo.pendingHandoff ? <div className="todo-handoff-action" ref={ref} tabIndex={-1} aria-live="polite"><span className="handoff-pending">引き継ぎを依頼中</span><span>{todo.assignee.name} → {todo.pendingHandoff.recipient.name}</span>{todo.pendingHandoff.requestMessage ? <small>依頼メッセージ: {todo.pendingHandoff.requestMessage}</small> : null}</div> : <div className="todo-handoff-action" ref={ref} tabIndex={-1}><RequestTodoHandoffDialog organizationId={organizationId} todo={todo} currentMembershipId={currentMembershipId} onRequested={() => ref.current?.focus()} /></div>; return <TodoCard todo={todo} action={todo.assignee.membershipId === currentMembershipId ? action : undefined} />; }
