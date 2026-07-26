import { RefreshCw } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { TodoHandoffWorkspaceResult } from './handoff-schema';
import { HandoffRequestCard } from './HandoffRequestCard';
export function HandoffPage({ organizationId, result, retry }: { organizationId: string; result: TodoHandoffWorkspaceResult; retry?: () => void }) {
 if (result.status !== 'ok') return <section className="content"><div className="empty-surface"><h2>引き継ぎを読み込めませんでした</h2><p>{result.error.message}</p>{retry ? <button className="secondary-button" onClick={retry}><RefreshCw size={16} aria-hidden="true"/>再試行</button> : null}<Link className="secondary-button" to="/organizations">組織を選び直す</Link></div></section>;
 const { workspace } = result; return <section className="content handoff-page"><header className="people-context"><div><p className="eyebrow">{workspace.organization.name}</p><h2>引き継ぎ</h2><p>担当が変わる仕事を、意図と一緒に確認します。</p></div></header><HandoffSection title="あなたへの依頼" items={workspace.incomingRequests} kind="incoming"/><HandoffSection title="送った依頼" items={workspace.outgoingRequests} kind="outgoing"/><HandoffSection title="最近の引き継ぎ" items={workspace.recentHandoffs} kind="recent"/></section>;
}
function HandoffSection({ title, items, kind }: { title: string; items: import('@amidala/contracts').TodoHandoffSummary[]; kind: 'incoming'|'outgoing'|'recent' }) { return <section className="handoff-section"><div className="section-heading"><h3>{title}</h3></div>{items.length ? <div className="handoff-list">{items.map((item) => <HandoffRequestCard key={item.handoffId} handoff={item} kind={kind}/>)}</div> : <div className="empty-surface"><p>該当する引き継ぎはありません。</p></div>}</section>; }
