import { hc } from 'hono/client';
import type { AppType } from '@aimani-ai/api/app-type';

export function createApiClient(fetcher: typeof fetch): ReturnType<typeof hc<AppType>> {
  return hc<AppType>('http://api.internal', { fetch: fetcher });
}
