import { Hono } from 'hono';
import { createRootContainer, type RootContainer } from './composition/root-container';
import { withRequestScope, type RequestScope } from './composition/request-scope';
import { HealthCheck } from './application/health-check';
import type { ApiBindings } from './config/env';
import { ConfigurationError } from './config/env';
import { ApiError } from './errors/api-error';
import { mountAuth } from './routes/auth';
import { mountOrganizations } from './routes/organizations';
import { createPeopleRoutes } from './routes/people';
import { createTodoRoutes } from './routes/todos';

export type ApiEnv = {
  Bindings: ApiBindings;
  Variables: { scope: RequestScope };
};

export function createApp({ rootContainer = createRootContainer() }: { rootContainer?: RootContainer } = {}) {
  const app = new Hono<ApiEnv>()
    .use('*', async (c, next) => {
      await withRequestScope(rootContainer, { env: c.env, request: c.req.raw }, async (scope) => {
        c.set('scope', scope);
        await next();
      });
    })
    .onError((err, c) => {
      if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message } }, err.status as any);
      if (err instanceof ConfigurationError || err instanceof Error && /database|connect|postgres/i.test(err.message)) return c.json({ error: { code: 'service_unavailable', message: 'Service unavailable' } }, 503);
      console.error(err); return c.json({ error: { code: 'service_unavailable', message: 'Internal server error' } }, 500);
    })
    .get('/health', (c) => c.json(c.get('scope').resolve<HealthCheck>('healthCheck').execute()));
  mountAuth(app); mountOrganizations(app); app.route('/', createPeopleRoutes()); return app.route('/', createTodoRoutes());
}
