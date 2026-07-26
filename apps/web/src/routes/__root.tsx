import { Link, Outlet, createRootRoute, useLocation } from '@tanstack/react-router';
import { ArrowRight, CheckSquare, Inbox, Users } from 'lucide-react';

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
  return <div className="app-shell">
    <aside className="side-nav" aria-label="メインナビゲーション"><div className="brand"><span className="brand-mark">A</span><span>Amidala</span></div><p className="org-label">組織</p><button className="org-switcher" type="button">Acme Studio <span>⌄</span></button><nav>{links.map(({to,label,icon:Icon}) => <Link key={label} to={to} activeOptions={{ exact: to === '/' }} className="nav-link" activeProps={{className:'nav-link active'}}><Icon size={19} aria-hidden="true"/><span>{label}</span></Link>)}</nav><div className="side-account"><div className="avatar small">田</div><div><strong>田中 彩</strong><span>Manager</span></div></div></aside>
    <main className="main-area"><header className="top-bar"><div><span className="eyebrow">Acme Studio</span><h1>{pageTitle}</h1></div><button className="account-button" type="button"><span className="avatar">田</span><span className="account-name">田中 彩</span></button></header><Outlet /></main>
    <nav className="bottom-nav" aria-label="モバイルナビゲーション">{links.map(({to,label,icon:Icon}) => <Link key={label} to={to} activeOptions={{ exact: to === '/' }} className="nav-link" activeProps={{className:'nav-link active'}}><Icon size={19} aria-hidden="true"/><span>{label}</span></Link>)}</nav>
  </div>;
}
