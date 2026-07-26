import '@tanstack/react-start/server-only';
import { createApiClient } from '@amidala/api-client';
import { listPeopleResponseSchema, type GetPeopleResult } from '@amidala/contracts';
import type { PeopleInput } from './people-schema';
import { env } from 'cloudflare:workers';
import { getRequestHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';

export async function getPeopleFromApi({ organizationId }: PeopleInput): Promise<GetPeopleResult> {
  const cookie = getRequestHeader('cookie') ?? '';
  const apiBinding = env.API;
  const fetcher: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookie) headers.set('cookie', cookie);
    return apiBinding.fetch(new Request(input, { ...init, headers }));
  };
  // Hono's inferred client shape collapses the `/people` collection when a
  // parameterized `/people/:contextMembershipId/todos` sibling is present.
  // Keep the endpoint typed locally until the client generator can represent
  // both collection and parameterized members on the same branch.
  const peopleGet = createApiClient(fetcher).organizations[':organizationId'].people as unknown as {
    $get: (args: { param: { organizationId: string } }, options: { headers: HeadersInit }) => Promise<Response>;
  };
  const response = await peopleGet.$get({ param: { organizationId } }, { headers: { cookie } });
  if (response.status === 401) throw redirect({ to: '/login' as never });
  const unavailable = (): GetPeopleResult => ({ status: 'error', error: { code: 'service_unavailable', message: 'People data is temporarily unavailable.' } });
  let body: unknown;
  try { body = await response.json(); } catch { return unavailable(); }
  if (response.status === 403) {
    const message = (body as { error?: { message?: string } }).error?.message;
    return { status: 'forbidden', error: { code: 'forbidden', message: message ?? 'This organization is not available to this user.' } };
  }
  if (response.status === 400 || response.status === 503) {
    const message = (body as { error?: { message?: string } }).error?.message;
    return { status: 'error', error: { code: response.status === 400 ? 'validation_error' : 'service_unavailable', message: message ?? (response.status === 400 ? 'Invalid organization ID.' : 'People data is temporarily unavailable.') } };
  }
  if (response.status !== 200) return unavailable();
  const parsed = listPeopleResponseSchema.safeParse(body);
  return parsed.success ? { status: 'ok', people: parsed.data.people } : unavailable();
}
