import { createRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
  const router = createRouter({ routeTree, context: { queryClient } });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

export const router = getRouter();
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
