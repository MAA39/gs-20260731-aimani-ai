/// <reference types="vite/client" />
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext, useLocation } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { lazy, Suspense, type ReactNode } from 'react';
import { BriefcaseBusiness, CheckSquare, CircleDot, Inbox, Users } from 'lucide-react';
import appCss from '../styles.css?url';
import { authClient } from '../features/auth/auth-client';

const links = [
  { to: 'today', label: '今日のボール', icon: CircleDot },
  { to: 'work', label: 'チームのボール', icon: BriefcaseBusiness },
  { to: 'people', label: 'People', icon: Users },
  { to: 'todos', label: '自分のTodo', icon: CheckSquare },
  { to: 'handoffs', label: '引き継ぎ', icon: Inbox },
] as const;
const DemoActorSwitcher = import.meta.env.DEV
  ? lazy(() => import('../features/auth/DemoActorSwitcher.dev'))
  : null;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Amidala' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootRoute,
});
export function RootRoute() {
  return <RootDocument><ApplicationShell /></RootDocument>;
}

function ApplicationShell() {
  const session = authClient.useSession();
  const pathname = useLocation({ select: (location) => location.pathname });
  if (pathname === '/login' || pathname === '/organizations') return <Outlet />;
  const pageTitle = /\/today$/.test(pathname) ? '今日のボール' : /\/process-lab$/.test(pathname) ? '工程ラボ' : /\/work$/.test(pathname) ? 'チームのボール' : /^\/[^/]+\/people\/[^/]+\/todos$/.test(pathname) ? '共有Todo' : /\/todos$/.test(pathname) ? '自分のTodo' : /\/handoffs$/.test(pathname) ? '引き継ぎ' : 'People';
  const personTodoMatch = pathname.match(/^\/([^/]+)\/people\/([^/]+)\/todos$/);
  const organizationId = personTodoMatch?.[1] ?? pathname.match(/^\/([^/]+)\/(?:people|todos|handoffs|today|work|process-lab)/)?.[1];
  const identityPending = session.isPending;
  const name = session.data?.user.name?.trim() || session.data?.user.email?.trim() || '';
  const initial = identityPending ? '…' : name.slice(0, 1) || '?';
  const accountName = identityPending ? '…' : session.data?.user.name || 'ログイン中';
  const accountEmail = identityPending ? '…' : session.data?.user.email || 'アカウント';
  return <div className="app-shell">
    <aside className="side-nav" aria-label="メインナビゲーション"><div className="brand"><span className="brand-mark">A</span><span>Amidala</span></div><p className="org-label">組織</p><Link className="org-switcher" to="/organizations">{organizationId ? '組織を切り替える' : '組織を選ぶ'} <span>⌄</span></Link><nav>{links.map((item) => <NavItem key={item.label} item={item} organizationId={organizationId} pathname={pathname} />)}</nav><div className="side-account"><div className="avatar small">{initial}</div><div><strong>{accountName}</strong><span>{accountEmail}</span></div></div></aside>
    <main className="main-area"><header className="top-bar"><div><span className="eyebrow">{organizationId ? '現在の組織' : 'Amidala'}</span><h1>{pageTitle}</h1></div><div className="actor-controls"><div className="account-name"><strong>{accountName}</strong><span>{accountEmail}</span></div>{import.meta.env.DEV && import.meta.env.VITE_DEMO_ACTOR_PASSWORD && organizationId && DemoActorSwitcher ? <Suspense fallback={null}><DemoActorSwitcher organizationId={organizationId} /></Suspense> : null}</div></header><Outlet /></main>
    <nav className="bottom-nav" aria-label="モバイルナビゲーション">{links.map((item) => <NavItem key={item.label} item={item} organizationId={organizationId} pathname={pathname} />)}</nav>
  </div>;
}

function NavItem({ item, organizationId, pathname }: { item: (typeof links)[number]; organizationId?: string; pathname: string }) {
  const Icon = item.icon;
  if (!organizationId) return <Link to="/organizations" className="nav-link" activeOptions={{ exact: true }}><Icon size={19} aria-hidden="true"/><span>{item.label}</span></Link>;
  if (item.to === 'today') return <Link to="/$organizationId/today" params={{ organizationId }} activeOptions={{ exact: true }} className="nav-link" activeProps={{ className: 'nav-link active' }}><Icon size={19} aria-hidden="true"/><span>{item.label}</span></Link>;
  if (item.to === 'work') return <Link to="/$organizationId/work" params={{ organizationId }} activeOptions={{ exact: true }} className="nav-link" activeProps={{ className: 'nav-link active' }}><Icon size={19} aria-hidden="true"/><span>{item.label}</span></Link>;
  if (item.to === 'people') return <Link to="/$organizationId/people" params={{ organizationId }} activeOptions={{ exact: true }} className="nav-link" activeProps={{ className: 'nav-link active' }}><Icon size={19} aria-hidden="true"/><span>{item.label}</span></Link>;
  if (item.to === 'todos') return <Link to="/$organizationId/todos" params={{ organizationId }} activeOptions={{ exact: true }} className={`nav-link${personTodoMatchForNav(pathname) ? ' active' : ''}`} aria-current={personTodoMatchForNav(pathname) ? 'page' : undefined} activeProps={{ className: 'nav-link active', 'aria-current': 'page' }}><Icon size={19} aria-hidden="true"/><span>{item.label}</span></Link>;
  return <Link to="/$organizationId/handoffs" params={{ organizationId }} activeOptions={{ exact: true }} className="nav-link" activeProps={{ className: 'nav-link active' }}><Icon size={19} aria-hidden="true"/><span>{item.label}</span></Link>;
}

function personTodoMatchForNav(pathname: string) { return /^\/[^/]+\/people\/[^/]+\/todos$/.test(pathname); }

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ja"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}
