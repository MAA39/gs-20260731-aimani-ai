import '@tanstack/react-start/server-only';
import { createApiClient } from '@aimani-ai/api-client';
import { listPeopleResponseSchema, type GetPeopleResult } from '@aimani-ai/contracts';
import type { PeopleInput } from './people-schema';
import { getRequestHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { peopleFailureMessage } from './people-error-presentation';
import { createApiFetcher } from '../server/api-fetcher.server';

export async function getPeopleFromApi({ organizationId }: PeopleInput): Promise<GetPeopleResult> {
  const cookie = getRequestHeader('cookie') ?? '';
  const fetcher = createApiFetcher(cookie);
  // Hono's inferred client shape collapses the `/people` collection when a
  // parameterized `/people/:contextMembershipId/todos` sibling is present.
  // Keep the endpoint typed locally until the client generator can represent
  // both collection and parameterized members on the same branch.
  type PeopleEndpoint = { organizations: { ':organizationId': { people: { $get: (args: { param: { organizationId: string } }, options: { headers: HeadersInit }) => Promise<Response> } } } };
  const peopleGet = (createApiClient(fetcher) as unknown as PeopleEndpoint).organizations[':organizationId'].people;
  const unavailable = (): GetPeopleResult => ({ status: 'error', error: { code: 'service_unavailable', message: peopleFailureMessage(503) } });
  let response: Response;
  try { response = await peopleGet.$get({ param: { organizationId } }, { headers: { cookie } }); } catch { return unavailable(); }
  if (response.status === 401) throw redirect({ to: '/login' as never });
  if (response.status === 403) {
    return { status: 'forbidden', error: { code: 'forbidden', message: peopleFailureMessage(response.status) } };
  }
  if (response.status === 400) {
    return { status: 'error', error: { code: 'validation_error', message: peopleFailureMessage(response.status) } };
  }
  if (response.status !== 200) return unavailable();
  let body: unknown;
  try { body = await response.json(); } catch { return unavailable(); }
  const parsed = listPeopleResponseSchema.safeParse(body);
  return parsed.success ? { status: 'ok', people: parsed.data.people } : unavailable();
}
