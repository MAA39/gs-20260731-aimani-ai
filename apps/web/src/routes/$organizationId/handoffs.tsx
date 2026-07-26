import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { todoHandoffWorkspaceQuery } from '../../features/handoffs/handoff-queries';
import { HandoffPage } from '../../features/handoffs/HandoffPage';
export const Route = createFileRoute('/$organizationId/handoffs')({ loader: ({ context, params }) => context.queryClient.ensureQueryData(todoHandoffWorkspaceQuery(params.organizationId)), pendingComponent: () => <section className="content"><div className="skeleton-block"/></section>, component: HandoffsRoute });
function HandoffsRoute(){ const router=useRouter(); const { organizationId } = Route.useParams(); const { data: result } = useSuspenseQuery(todoHandoffWorkspaceQuery(organizationId)); return <HandoffPage organizationId={organizationId} result={result} retry={()=>router.invalidate()}/>; }
