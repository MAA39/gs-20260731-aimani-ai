import { createFileRoute, useRouter } from '@tanstack/react-router';
import { todoHandoffWorkspaceQuery } from '../../features/handoffs/handoff-queries';
import { HandoffPage } from '../../features/handoffs/HandoffPage';
export const Route = createFileRoute('/$organizationId/handoffs')({ loader: ({ context, params }) => context.queryClient.ensureQueryData(todoHandoffWorkspaceQuery(params.organizationId)), pendingComponent: () => <section className="content"><div className="skeleton-block"/></section>, component: HandoffsRoute });
function HandoffsRoute(){ const router=useRouter(); const result=Route.useLoaderData(); return <HandoffPage organizationId={Route.useParams().organizationId} result={result} retry={()=>router.invalidate()}/>; }
