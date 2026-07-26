import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { sharedTodoWorkspaceQuery } from '../../../../features/todos/todo-queries';
import { TodoPage } from '../../../../features/todos/Page';

export const Route = createFileRoute('/$organizationId/people/$contextMembershipId/todos')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(sharedTodoWorkspaceQuery({ organizationId: params.organizationId, contextMembershipId: params.contextMembershipId })),
  pendingComponent: () => <section className="content"><div className="skeleton-block" /></section>,
  errorComponent: ({ reset }) => <section className="content"><div className="empty-surface"><h2>共有Todoを読み込めませんでした</h2><p>接続を確認して再試行してください。</p><button className="secondary-button" type="button" onClick={reset}>再試行</button></div></section>,
  component: TodoRoute,
});

function TodoRoute() {
  const router = useRouter();
  const { organizationId, contextMembershipId } = Route.useParams();
  const { data } = useSuspenseQuery(sharedTodoWorkspaceQuery({ organizationId, contextMembershipId }));
  return <TodoPage organizationId={organizationId} result={data} retry={() => router.invalidate()} />;
}
