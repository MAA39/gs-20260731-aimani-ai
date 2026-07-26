import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: ({ request, context }) => {
        const api = (env as unknown as { API?: Fetcher }).API;
        if (!api) return Response.json({ ok: false, reason: 'API binding unavailable' }, { status: 503 });
        return api.fetch(new Request(new URL('/health', request.url), request));
      },
    },
  },
});
