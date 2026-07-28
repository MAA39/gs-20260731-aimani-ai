import '@xyflow/react/dist/style.css';
import '../../features/process-lab/process-lab.css';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ProcessLabPage } from '../../features/process-lab/ProcessLabPage';
import { processLabQuery } from '../../features/process-lab/process-lab-queries';

export const Route = createFileRoute('/$organizationId/process-lab')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(processLabQuery(params.organizationId)),
  pendingComponent: () => (
    <section className="content"><div className="skeleton-block" /></section>
  ),
  component: ProcessLabRoute,
});

function ProcessLabRoute() {
  const { organizationId } = Route.useParams();
  const { data: result, refetch } = useSuspenseQuery(
    processLabQuery(organizationId),
  );
  return (
    <ProcessLabPage
      organizationId={organizationId}
      result={result}
      retry={() => { void refetch(); }}
    />
  );
}
