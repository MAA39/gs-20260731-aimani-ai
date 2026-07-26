import { Link } from '@tanstack/react-router';
import { ArrowRight, Building2 } from 'lucide-react';
import type { OrganizationMembershipResult } from './organizations-schema';

export function OrganizationChooser({ result, retry }: { result: OrganizationMembershipResult; retry?: () => void }) {
  if (result.status === 'error') return <section className="empty-surface chooser-empty"><Building2 size={24} aria-hidden="true" /><h2>組織を読み込めませんでした</h2><p>{result.error.message}</p>{retry ? <button className="secondary-button" type="button" onClick={retry}>再試行</button> : null}</section>;
  const organizations = result.organizations;
  if (!organizations.length) return <section className="empty-surface chooser-empty"><Building2 size={24} aria-hidden="true" /><h2>所属する組織がありません</h2><p>管理者に組織への追加を依頼してください。追加されると、ここからPeopleを開けます。</p><Link className="secondary-button" to="/login">アカウントに戻る</Link></section>;
  return <section className="chooser-surface"><p className="eyebrow">ORGANIZATION MEMBERSHIP</p><h2>進める組織を選ぶ</h2><p className="chooser-lede">いま関わる人と仕事を選ぶ場所です。</p><div className="organization-list">{organizations.map((organization) => <Link className="organization-option" key={organization.organizationId} to="/$organizationId/people" params={{ organizationId: organization.organizationId }}><span className="organization-mark"><Building2 size={19} aria-hidden="true" /></span><span className="organization-option-copy"><strong>{organization.name}</strong><span>{organization.displayName} · {organization.role === 'owner' ? 'オーナー' : organization.role === 'manager' ? 'マネージャー' : 'メンバー'}</span></span><ArrowRight size={18} aria-hidden="true" /></Link>)}</div></section>;
}
