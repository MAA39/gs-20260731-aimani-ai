import { Link, Outlet, createRootRoute, useLocation } from '@tanstack/react-router';
import { CheckSquare, Inbox, Users } from 'lucide-react';

const links = [
  { to: '/', label: 'People', icon: Users },
  { to: '/todos', label: 'Todos', icon: CheckSquare },
  { to: '/handoffs', label: '引き継ぎ', icon: Inbox },
] as const;

export const Route = createRootRoute({ component: RootRoute });
export function RootRoute() {
  const pathname = useLocation({ select: (location) => location.pathname });
  if (pathname === '/login' || pathname === '/organizations') return <Outlet />;
  const pageTitle = pathname === '/todos' ? 'Todos' : pathname === '/handoffs' ? '引き継ぎ' : 'People';
  const organizationId = pathname.match(/^\/([^/]+)\/people$/)?.[1];
  const peopleTo = organizationId ? `/${organizationId}/people` : '/organizations';
  return <div className="app-shell">
    <aside className="side-nav" aria-label="メインナビゲーション"><div className="brand"><span className="brand-mark">A</span><span>Amidala</span></div><p className="org-label">組織</p><Link className="org-switcher" to="/organizations">{organizationId ? '組織を切り替える' : '組織を選ぶ'} <span>⌄</span></Link><nav>{links.map(({to,label,icon:Icon}) => <Link key={label} to={to === '/' ? peopleTo : to} activeOptions={{ exact: to === '/' }} className="nav-link" activeProps={{className:'nav-link active'}}><Icon size={19} aria-hidden="true"/><span>{label}</span></Link>)}</nav><div className="side-account"><div className="avatar small">?</div><div><strong>ログイン中</strong><span>アカウント</span></div></div></aside>
    <main className="main-area"><header className="top-bar"><div><span className="eyebrow">{organizationId ? '現在の組織' : 'Amidala'}</span><h1>{pageTitle}</h1></div><span className="account-name">ログイン中</span></header><Outlet /></main>
    <nav className="bottom-nav" aria-label="モバイルナビゲーション">{links.map(({to,label,icon:Icon}) => <Link key={label} to={to === '/' ? peopleTo : to} activeOptions={{ exact: to === '/' }} className="nav-link" activeProps={{className:'nav-link active'}}><Icon size={19} aria-hidden="true"/><span>{label}</span></Link>)}</nav>
  </div>;
}
