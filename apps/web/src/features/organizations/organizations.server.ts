import '@tanstack/react-start/server-only';
import { getRequestHeader } from '@tanstack/react-start/server';
import { organizationsResponseSchema, type OrganizationMembershipResult } from './organizations-schema';
import { redirect } from '@tanstack/react-router';
import { createApiFetcher } from '../server/api-fetcher.server';

export async function listOrganizationsFromApi(): Promise<OrganizationMembershipResult> {
  const cookie = getRequestHeader('cookie') ?? '';
  const fetcher = createApiFetcher(cookie);
  const response = await fetcher('http://api.internal/organizations', { headers: { cookie } });
  if (response.status === 401) throw redirect({ to: '/login' });
  if (!response.ok) return { status: 'error', error: { code: 'service_unavailable', message: '組織を読み込めませんでした。時間をおいて再試行してください。' } };
  try { const parsed = organizationsResponseSchema.safeParse(await response.json()); return parsed.success ? { status: 'ok', organizations: parsed.data.organizationMemberships } : { status: 'error', error: { code: 'service_unavailable', message: '組織データを確認できませんでした。' } }; }
  catch { return { status: 'error', error: { code: 'service_unavailable', message: '組織データを確認できませんでした。' } }; }
}
