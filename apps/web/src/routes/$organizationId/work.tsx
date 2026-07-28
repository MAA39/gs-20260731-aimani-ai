import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { TeamWorkPage } from '../../features/work/TeamWorkPage';
import { teamWorkOverviewQuery } from '../../features/work/team-work-queries';

export const Route = createFileRoute('/$organizationId/work')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(teamWorkOverviewQuery(params.organizationId)),
  pendingComponent: () => <section className="content"><div className="skeleton-block" /></section>,
  component: TeamWorkRoute,
});

function TeamWorkRoute() {
  const { organizationId } = Route.useParams();
  const { data: result, refetch } = useSuspenseQuery(teamWorkOverviewQuery(organizationId));
  return (
    <TeamWorkPage
      organizationId={organizationId}
      result={result}
      retry={() => { void refetch(); }}
    />
  );
}
