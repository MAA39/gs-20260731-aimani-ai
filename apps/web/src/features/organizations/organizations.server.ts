import '@tanstack/react-start/server-only';
import { env } from 'cloudflare:workers';
import { getRequestHeader } from '@tanstack/react-start/server';
import { organizationsResponseSchema, type OrganizationMembershipSummary } from './organizations-schema';
import { redirect } from '@tanstack/react-router';

export async function listOrganizationsFromApi(): Promise<OrganizationMembershipSummary[]> {
  const cookie = getRequestHeader('cookie') ?? '';
  const fetcher: typeof fetch = async (input, init) => { const headers = new Headers(init?.headers); if (cookie) headers.set('cookie', cookie); return env.API.fetch(new Request(input, { ...init, headers })); };
  const response = await fetcher('http://api.internal/organizations', { headers: { cookie } });
  if (response.status === 401) throw redirect({ to: '/login' });
  if (!response.ok) return [];
  const parsed = organizationsResponseSchema.safeParse(await response.json());
  return parsed.success ? parsed.data.organizationMemberships : [];
}
