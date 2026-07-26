import { createFileRoute, useRouter } from '@tanstack/react-router';
import { assignedTodoWorkspaceQuery } from '../../features/todos/assigned-todo-queries';
import { AssignedTodoPage } from '../../features/todos/AssignedTodoPage';
export const Route = createFileRoute('/$organizationId/todos')({ loader: ({ context, params }) => context.queryClient.ensureQueryData(assignedTodoWorkspaceQuery(params.organizationId)), pendingComponent: () => <section className="content"><div className="skeleton-block"/></section>, component: TodosRoute });
function TodosRoute(){ const router=useRouter(); const result=Route.useLoaderData(); return <AssignedTodoPage organizationId={Route.useParams().organizationId} result={result} retry={()=>router.invalidate()}/>; }
