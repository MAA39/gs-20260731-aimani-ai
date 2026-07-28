import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import type { AssignedTodoWorkspaceResult, TodoHandoffWorkspaceResult } from '../handoffs/handoff-schema';
import { HandoffRequestCard } from '../handoffs/HandoffRequestCard';
import { AssignedTodoCard } from '../todos/AssignedTodoCard';
import { composeTodayWorkspace } from './today-workspace';

export function TodayPage({ organizationId, assignedResult, handoffResult, retry }: { organizationId: string; assignedResult: AssignedTodoWorkspaceResult; handoffResult: TodoHandoffWorkspaceResult; retry?: () => void }) {
  const [announcement, setAnnouncement] = useState('');
  if (assignedResult.status !== 'ok') return <TodayLoadFailure message={assignedResult.error.message} retry={retry} />;
  if (handoffResult.status !== 'ok') return <TodayLoadFailure message={handoffResult.error.message} retry={retry} />;
  const workspace = composeTodayWorkspace(assignedResult.workspace, handoffResult.workspace);
  const membershipId = workspace.currentMember.membershipId;
  return <section className="content today-page"><div className="today-live-region" aria-live="polite" aria-atomic="true">{announcement || ' '}</div><header className="people-context today-header"><div><p className="eyebrow">{workspace.organization.name}</p><h2>今日のボール</h2><p>次に誰が動くかを、ここで揃えます。</p></div></header><div className="today-priority"><span className="label">優先して確認</span><strong>{workspace.incomingRequests.length ? `${workspace.incomingRequests.length}件の依頼` : '確認待ちの依頼はありません'}</strong></div><div className="today-grid">
    <TodaySection className="today-section-incoming" title="あなたへの依頼" description="確認して、引き受けるか見送る" items={workspace.incomingRequests} empty="いま確認が必要な依頼はありません。" linkLabel="引き継ぎを見る" organizationId={organizationId} attentionFirst>{(item) => <HandoffRequestCard handoff={item} kind="incoming" currentMembershipId={membershipId} onAnnounce={setAnnouncement} />}</TodaySection>
    <TodaySection title="いま自分が持つボール" description="あなたが次に進めるTodo" items={workspace.ownedTodos} empty="担当中のTodoはありません。" linkLabel="Peopleを見る" organizationId={organizationId}>{(item) => <AssignedTodoCard todo={item} organizationId={organizationId} currentMembershipId={membershipId} />}</TodaySection>
    <TodaySection title="相手の返答を待っている" description="依頼した引き継ぎ" items={workspace.outgoingRequests} empty="返答待ちの引き継ぎはありません。" linkLabel="引き継ぎを見る" organizationId={organizationId}>{(item) => <HandoffRequestCard handoff={item} kind="outgoing" currentMembershipId={membershipId} onAnnounce={setAnnouncement} />}</TodaySection>
    {workspace.recentHandoffs.length ? <TodaySection className="today-section-recent" title="最近動いたボール" items={workspace.recentHandoffs} organizationId={organizationId}>{(item) => <HandoffRequestCard handoff={item} kind="recent" currentMembershipId={membershipId} onAnnounce={setAnnouncement} />}</TodaySection> : null}
  </div></section>;
}

function TodayLoadFailure({ message, retry }: { message: string; retry?: () => void }) {
  return <section className="content"><div className="empty-surface"><h2>今日のボールを読み込めませんでした</h2><p>{message}</p>{retry ? <button className="secondary-button" type="button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />再試行</button> : null}<Link className="secondary-button" to="/organizations">組織を選び直す</Link></div></section>;
}

function TodaySection<T extends { handoffId?: string; todoId?: string }>({ title, description, items, empty, linkLabel, organizationId, className = '', attentionFirst = false, children }: { title: string; description?: string; items: T[]; empty?: string; linkLabel?: string; organizationId: string; className?: string; attentionFirst?: boolean; children: (item: T) => ReactNode }) {
  return <section className={`today-section ${className}`}><div className="section-heading"><div><h3>{title}</h3>{description ? <p>{description}</p> : null}</div></div>{items.length ? <div className="today-list">{items.map((item, index) => <div key={item.handoffId ?? item.todoId ?? index}>{attentionFirst && index === 0 ? <span className="today-attention-label">確認が必要</span> : null}{children(item)}</div>)}</div> : empty ? <div className="empty-surface"><p>{empty}</p>{linkLabel ? <Link className="secondary-button" to={linkLabel === 'Peopleを見る' ? '/$organizationId/people' : '/$organizationId/handoffs'} params={{ organizationId }}>{linkLabel}</Link> : null}</div> : null}</section>;
}
