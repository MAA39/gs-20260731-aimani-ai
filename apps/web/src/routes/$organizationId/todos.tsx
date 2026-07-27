import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { assignedTodoWorkspaceQuery } from '../../features/todos/assigned-todo-queries';
import { AssignedTodoPage } from '../../features/todos/AssignedTodoPage';
export const Route = createFileRoute('/$organizationId/todos')({ loader: ({ context, params }) => context.queryClient.ensureQueryData(assignedTodoWorkspaceQuery(params.organizationId)), pendingComponent: () => <section className="content"><div className="skeleton-block"/></section>, component: TodosRoute });
function TodosRoute(){ const router=useRouter(); const { organizationId }=Route.useParams(); const { data: result }=useSuspenseQuery(assignedTodoWorkspaceQuery(organizationId)); return <AssignedTodoPage organizationId={organizationId} result={result} retry={()=>router.invalidate()}/>; }
