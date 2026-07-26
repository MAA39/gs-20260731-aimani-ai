import { createApiClient } from '@amidala/api-client';
import type { ListPeopleResponse } from '@amidala/contracts';
import type { PeopleInput } from './people-schema';

export async function getPeopleFromApi({ organizationId }: PeopleInput): Promise<ListPeopleResponse> {
  const request = new Request('http://api.internal');
  const cookie = request.headers.get('cookie') ?? '';
  const apiBinding = (globalThis as unknown as { env?: { API?: Fetcher } }).env?.API;
  const fetcher: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookie) headers.set('cookie', cookie);
    if (!apiBinding) return new Response(JSON.stringify({ error: { code: 'service_unavailable', message: 'Service unavailable' } }), { status: 503 });
    return apiBinding.fetch(new Request(input, { ...init, headers }));
  };
  const response = await createApiClient(fetcher).organizations[':organizationId'].people.$get({ param: { organizationId } }, { headers: { cookie } });
  if (response.status === 401) throw new Error('login_required');
  if (!response.ok) throw await response.json();
  return await response.json();
}
