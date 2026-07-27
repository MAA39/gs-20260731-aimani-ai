import handler from '@tanstack/react-start/server-entry';

type WorkerEnv = { API?: Fetcher };

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' || url.pathname.startsWith('/api/auth/')) {
      if (!env.API) return Response.json({ ok: false, reason: 'API binding unavailable' }, { status: 503 });
      const target = url.pathname === '/api/health' ? '/health' : url.pathname;
      const upstream = await env.API.fetch(new Request(new URL(target + url.search, request.url), request));
      const headers = new Headers(upstream.headers);
      const cookies = upstream.headers.getSetCookie?.() ?? [];
      headers.delete('set-cookie'); cookies.forEach((cookie) => headers.append('set-cookie', cookie));
      return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
    }
    return handler.fetch(request);
  },
};
