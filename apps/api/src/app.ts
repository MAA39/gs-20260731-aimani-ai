import { Hono } from 'hono';
import { createRootContainer, type RootContainer } from './composition/root-container';
import { withRequestScope } from './composition/request-scope';
import { HealthCheck } from './application/health-check';

export type ApiEnv = {
  Bindings: Record<string, unknown>;
  Variables: { scope: RootContainer };
};

export function createApp({ rootContainer = createRootContainer() }: { rootContainer?: RootContainer } = {}) {
  return new Hono<ApiEnv>()
    .use('*', async (c, next) => {
      await withRequestScope(rootContainer, { env: c.env, request: c.req.raw }, async (scope) => {
        c.set('scope', scope);
        await next();
      });
    })
    .get('/health', (c) => c.json(c.get('scope').resolve<HealthCheck>('healthCheck').execute()));
}
