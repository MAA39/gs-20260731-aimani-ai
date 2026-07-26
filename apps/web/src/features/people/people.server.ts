import '@tanstack/react-start/server-only';
import { createApiClient } from '@amidala/api-client';
import type { GetPeopleResult, MemberSummary } from '@amidala/contracts';
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
  const response = await createApiClient(fetcher).organizations[':organizationId'].people.$get({ param: { organizationId } }, { headers: { cookie } });
  if (response.status === 401) throw redirect({ to: '/login' as never });
  const body = await response.json() as { people?: MemberSummary[]; error?: { code: 'forbidden' | 'validation_error' | 'service_unavailable'; message: string } };
  if (response.status === 403) return { status: 'forbidden', error: { code: 'forbidden', message: body.error?.message ?? 'Forbidden' } };
  if (response.status === 400 || response.status === 503) return { status: 'error', error: { code: response.status === 400 ? 'validation_error' : 'service_unavailable', message: body.error?.message ?? 'Service unavailable' } };
  return { status: 'ok', people: body.people ?? [] };
}
