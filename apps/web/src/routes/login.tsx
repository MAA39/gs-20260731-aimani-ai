import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '../features/auth/LoginForm';
export const Route = createFileRoute('/login')({ component: LoginRoute });
function LoginRoute() { return <main className="login-page"><section className="login-thesis"><div className="brand large-brand"><span className="brand-mark">A</span><span>Amidala</span></div><p className="eyebrow">RELATIONSHIP-FIRST WORK</p><h1>誰と、何を進めるかを<br /><em>選べる。</em></h1><p>人と仕事の間にある責任を、一本のレールで見渡します。</p><div className="thesis-rail"><span>あなた</span><i /><span>共有 Todo</span><i /><span>次の担当</span></div></section><LoginForm /></main>; }
