import { FormEvent, useState } from 'react';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { authClient } from './auth-client';

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(null);
    try { const result = await authClient.signIn.email({ email, password }); if (result.error) { setError('メールアドレスまたはパスワードを確認してください。'); return; } await navigate({ to: '/organizations' }); }
    catch { setError('ネットワークに接続できません。接続を確認して、再度ログインしてください。'); }
    finally { setPending(false); }
  }

  return <form className="login-form" onSubmit={submit}>
    <div className="login-form-heading"><span className="icon-badge"><KeyRound size={18} aria-hidden="true" /></span><div><p className="eyebrow">WELCOME BACK</p><h2>関係の続きから始める</h2></div></div>
    <label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
    <label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
    {error ? <p className="field-error" role="alert" aria-live="polite">{error}</p> : null}
    <button className="primary-button login-submit" type="submit" disabled={pending}>{pending ? '確認しています…' : 'ログインする'} <ArrowRight size={17} aria-hidden="true" /></button>
  </form>;
}
