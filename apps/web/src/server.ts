import handler from '@tanstack/react-start/server-entry';

type WorkerEnv = { API?: Fetcher };

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      if (!env.API) return Response.json({ ok: false, reason: 'API binding unavailable' }, { status: 503 });
      return env.API.fetch(new Request(new URL('/health', request.url), request));
    }
    return handler.fetch(request, env, ctx);
  },
};
