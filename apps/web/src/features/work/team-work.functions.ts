import { createServerFn } from '@tanstack/react-start';
import { teamWorkOverviewInputSchema } from './team-work-schema';
import { getTeamWorkOverviewFromApi } from './team-work.server';

export const getTeamWorkOverview = createServerFn({ method: 'GET' })
  .validator(teamWorkOverviewInputSchema)
  .handler(({ data }) => getTeamWorkOverviewFromApi(data));
