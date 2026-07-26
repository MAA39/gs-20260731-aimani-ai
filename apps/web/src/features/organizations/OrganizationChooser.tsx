import { Link } from '@tanstack/react-router';
import { ArrowRight, Building2 } from 'lucide-react';
import type { OrganizationMembershipSummary } from './organizations-schema';

export function OrganizationChooser({ organizations }: { organizations: OrganizationMembershipSummary[] }) {
  if (!organizations.length) return <section className="empty-surface chooser-empty"><Building2 size={24} aria-hidden="true" /><h2>所属する組織がありません</h2><p>管理者に組織への追加を依頼してください。追加されると、ここからPeopleを開けます。</p><Link className="secondary-button" to="/login">アカウントに戻る</Link></section>;
  return <section className="chooser-surface"><p className="eyebrow">ORGANIZATION MEMBERSHIP</p><h2>進める組織を選ぶ</h2><p className="chooser-lede">いま関わる人と仕事を選ぶ場所です。</p><div className="organization-list">{organizations.map((organization) => <Link className="organization-option" key={organization.organizationId} to="/$organizationId/people" params={{ organizationId: organization.organizationId }}><span className="organization-mark"><Building2 size={19} aria-hidden="true" /></span><span className="organization-option-copy"><strong>{organization.name}</strong><span>{organization.displayName} · {organization.role === 'owner' ? 'オーナー' : organization.role === 'manager' ? 'マネージャー' : 'メンバー'}</span></span><ArrowRight size={18} aria-hidden="true" /></Link>)}</div></section>;
}
