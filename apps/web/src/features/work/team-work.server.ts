import '@tanstack/react-start/server-only';
import { getRequestHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { createApiFetcher, readApiBody } from '../server/api-fetcher.server';
import {
  teamWorkOverviewInputSchema,
  teamWorkOverviewSchema,
  type TeamWorkOverviewInput,
  type TeamWorkOverviewResult,
} from './team-work-schema';

const unavailable = (): TeamWorkOverviewResult => ({
  status: 'error',
  error: {
    code: 'service_unavailable',
    message: 'チームのボールを読み込めませんでした。時間をおいてもう一度お試しください。',
  },
});

export async function getTeamWorkOverviewFromApi(
  input: TeamWorkOverviewInput,
): Promise<TeamWorkOverviewResult> {
  const parsedInput = teamWorkOverviewInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      status: 'error',
      error: { code: 'validation_error', message: '組織の指定を確認してください。' },
    };
  }

  const cookie = getRequestHeader('cookie') ?? '';
  let response: Response;
  try {
    response = await createApiFetcher(cookie)(
      `http://api.internal/organizations/${parsedInput.data.organizationId}/work`,
    );
  } catch {
    return unavailable();
  }

  const body = await readApiBody(response);
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) {
    return {
      status: 'forbidden',
      error: { code: 'forbidden', message: 'この組織のチームのボールは閲覧できません。' },
    };
  }
  if (response.status === 404) {
    return {
      status: 'not_found',
      error: { code: 'not_found', message: '対象の組織が見つかりません。' },
    };
  }
  if (response.status === 400) {
    return {
      status: 'error',
      error: { code: 'validation_error', message: '組織の指定を確認してください。' },
    };
  }
  if (response.status !== 200) return unavailable();

  const parsed = teamWorkOverviewSchema.safeParse(body);
  return parsed.success ? { status: 'ok', overview: parsed.data } : unavailable();
}
