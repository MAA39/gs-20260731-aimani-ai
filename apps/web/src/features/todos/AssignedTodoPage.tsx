import { Link } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { AssignedTodoWorkspaceResult } from '../handoffs/handoff-schema';
import { AssignedTodoCard } from './AssignedTodoCard';

export function AssignedTodoPage({ organizationId, result, retry }: { organizationId: string; result: AssignedTodoWorkspaceResult; retry?: () => void }) {
  const [announcement, setAnnouncement] = useState('');
  if (result.status !== 'ok') return <section className="content"><div className="empty-surface"><h2>{result.status === 'forbidden' ? 'この組織では閲覧できません' : result.status === 'not_found' ? '組織が見つかりません' : 'Todoを読み込めませんでした'}</h2><p>{result.error.message}</p>{retry ? <button className="secondary-button" type="button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />再試行</button> : null}<Link className="secondary-button" to="/organizations">組織を選び直す</Link></div></section>;
  const { workspace } = result;
  return <section className="content assigned-todo-page"><div className="today-live-region" aria-live="polite" aria-atomic="true">{announcement || ' '}</div><header className="people-context"><div><p className="eyebrow">{workspace.organization.name}</p><h2>自分のTodo</h2><p>{workspace.currentMember.name}さんが現在担当している仕事</p></div><Link className="secondary-button" to="/$organizationId/people" params={{ organizationId }}>Peopleを見る</Link></header>
    {workspace.todos.length ? <div className="todo-list">{workspace.todos.map((todo) => <AssignedTodoCard key={todo.todoId} todo={todo} organizationId={organizationId} currentMembershipId={workspace.currentMember.membershipId} onAnnounce={setAnnouncement} />)}</div> : <div className="empty-surface todo-empty"><h3>現在担当しているTodoはありません</h3><p>Peopleから関係する相手を選び、次のTodoを確認できます。</p><Link className="secondary-button" to="/$organizationId/people" params={{ organizationId }}>Peopleを見る</Link></div>}
  </section>;
}
