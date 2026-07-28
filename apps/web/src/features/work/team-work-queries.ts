import { queryOptions } from '@tanstack/react-query';
import { getTeamWorkOverview } from './team-work.functions';
import { teamWorkOverviewKey } from './team-work-query-key';

export { teamWorkOverviewKey } from './team-work-query-key';

export const teamWorkOverviewQuery = (organizationId: string) =>
  queryOptions({
    queryKey: teamWorkOverviewKey(organizationId),
    queryFn: () => getTeamWorkOverview({ data: { organizationId } }),
  });
