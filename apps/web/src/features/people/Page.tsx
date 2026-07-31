import { Link } from '@tanstack/react-router';
import { Users, RefreshCw } from 'lucide-react';
import type { GetPeopleResult } from '@aimani-ai/contracts';
import type { OrganizationMembershipSummary } from '../organizations/organizations-schema';
import { OrganizationSwitcher } from '../organizations/OrganizationSwitcher';
import { PersonCard } from './PersonCard';

export function PeoplePage({ organization, organizations, result, retry }: { organization: OrganizationMembershipSummary; organizations: OrganizationMembershipSummary[]; result: GetPeopleResult; retry?: () => void }) {
  if (result.status === 'forbidden') return <section className="content"><div className="empty-surface"><h2>この組織では閲覧できません</h2><p>選択した組織へのアクセス権がありません。所属組織から選び直してください。</p><Link className="secondary-button" to="/organizations">組織を選び直す</Link></div></section>;
  if (result.status === 'error') return <section className="content"><div className="empty-surface"><h2>Peopleを読み込めませんでした</h2><p>{result.error.message}</p>{retry ? <button type="button" className="secondary-button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />再試行</button> : null}</div></section>;
  if (!result.people.length) return <section className="content"><div className="people-context"><div><p className="eyebrow">PEOPLE</p><h2>関わる人</h2></div><OrganizationSwitcher current={organization} organizations={organizations} /></div><div className="empty-surface"><Users size={24} aria-hidden="true" /><h3>まだPeopleがいません</h3><p>管理者が組織のメンバーを追加すると、ここに関係が表示されます。</p></div></section>;
  return <section className="content"><div className="people-context"><div><p className="eyebrow">{organization.name}</p><h2>関わる人</h2><p>誰と何を進めるかを、関係から選びます。</p></div><OrganizationSwitcher current={organization} organizations={organizations} /></div><div className="people-grid">{result.people.map((person) => <PersonCard key={person.membershipId} person={person} organizationId={organization.organizationId} />)}</div></section>;
}
