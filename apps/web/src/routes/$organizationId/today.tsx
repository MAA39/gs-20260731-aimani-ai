import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { assignedTodoWorkspaceQuery } from '../../features/todos/assigned-todo-queries';
import { todoHandoffWorkspaceQuery } from '../../features/handoffs/handoff-queries';
import { TodayPage } from '../../features/today/TodayPage';

export const Route = createFileRoute('/$organizationId/today')({
  loader: ({ context, params }) => Promise.all([
    context.queryClient.ensureQueryData(assignedTodoWorkspaceQuery(params.organizationId)),
    context.queryClient.ensureQueryData(todoHandoffWorkspaceQuery(params.organizationId)),
  ]),
  pendingComponent: () => <section className="content"><div className="skeleton-block" /></section>,
  component: TodayRoute,
});

function TodayRoute() {
  const router = useRouter();
  const { organizationId } = Route.useParams();
  const { data: assignedResult } = useSuspenseQuery(assignedTodoWorkspaceQuery(organizationId));
  const { data: handoffResult } = useSuspenseQuery(todoHandoffWorkspaceQuery(organizationId));
  return <TodayPage organizationId={organizationId} assignedResult={assignedResult} handoffResult={handoffResult} retry={() => router.invalidate()} />;
}
