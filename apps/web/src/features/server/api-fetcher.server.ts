import '@tanstack/react-start/server-only';
import { env } from 'cloudflare:workers';

export function createApiFetcher(cookie: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookie) headers.set('cookie', cookie);
    return env.API.fetch(new Request(input, { ...init, headers }));
  };
}

export async function readApiBody(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return undefined; }
}
