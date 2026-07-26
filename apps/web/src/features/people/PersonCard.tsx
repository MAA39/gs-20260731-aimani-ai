import { CheckCircle2 } from 'lucide-react';
import type { MemberSummary } from '@amidala/contracts';

const labels: Record<string, string> = { manager_report: '直属の部下', supporter: 'サポートする人', peer: '同僚' };
export function PersonCard({ person }: { person: MemberSummary }) {
  const initial = person.name.trim().charAt(0) || '?';
  const relationship = person.relationshipKinds.map((kind) => labels[kind] ?? '関係を未設定');
  return <article className="person-card"><div className="person-top"><div className="avatar large">{initial}</div><span className="relationship">{relationship.length ? relationship.join(' · ') : '関係を未設定'}</span></div><h3>{person.name}</h3><p>{person.title ?? '役割を未設定'}</p><div className="relationship-rail" aria-hidden="true"><span /><span /><span /></div><div className="card-action"><span><CheckCircle2 size={16} aria-hidden="true" />共有Todoはまだありません</span></div></article>;
}
