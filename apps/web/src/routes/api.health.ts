import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: ({ request, context }) => {
        const api = (context as { cloudflare?: { env?: { API?: Fetcher } } }).cloudflare?.env?.API;
        if (!api) return Response.json({ ok: false, reason: 'API binding unavailable' }, { status: 503 });
        return api.fetch(new Request(new URL('/health', request.url), request));
      },
    },
  },
});
