import { queryOptions } from '@tanstack/react-query';
import { getTeamWorkOverview } from './team-work.functions';

export const teamWorkOverviewKey = (organizationId: string) =>
  ['teamWork', organizationId] as const;

export const teamWorkOverviewQuery = (organizationId: string) =>
  queryOptions({
    queryKey: teamWorkOverviewKey(organizationId),
    queryFn: () => getTeamWorkOverview({ data: { organizationId } }),
  });
