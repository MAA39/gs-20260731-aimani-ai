import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { authClient } from './auth-client';
import { DEMO_ACTORS, demoActorSwitchFailureMessage } from './demo-actors.dev';

export function DemoActorSwitcher({ organizationId }: { organizationId: string }) {
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const [pendingActorId, setPendingActorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const password = import.meta.env.VITE_DEMO_ACTOR_PASSWORD ?? '';
  const currentEmail = session.data?.user.email;

  async function switchActor(actor: (typeof DEMO_ACTORS)[number]) {
    setPendingActorId(actor.id);
    setError(null);
    try {
      const signOutResult = await authClient.signOut();
      if (signOutResult.error) throw new Error('sign out failed');
      const signInResult = await authClient.signIn.email({ email: actor.email, password });
      if (signInResult.error) throw new Error('sign in failed');
      queryClient.clear();
      await navigate({ to: '/$organizationId/today', params: { organizationId }, replace: true });
      await router.invalidate();
    } catch {
      setError(demoActorSwitchFailureMessage());
    } finally {
      setPendingActorId(null);
    }
  }

  return <details className="actor-switcher">
    <summary>操作ユーザーを切り替える</summary>
    <div className="actor-switcher-menu">
      {DEMO_ACTORS.map((actor) => {
        const current = currentEmail === actor.email;
        return <button key={actor.id} type="button" aria-current={current ? 'true' : undefined} disabled={pendingActorId !== null || current} onClick={() => void switchActor(actor)}>
          <span>{actor.name}</span><small>{actor.email}</small>
        </button>;
      })}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  </details>;
}

export default DemoActorSwitcher;
