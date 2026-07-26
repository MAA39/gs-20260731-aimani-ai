import { createFileRoute } from '@tanstack/react-router';
import { getOrganizations } from '../features/organizations/organizations.functions';
import { OrganizationChooser } from '../features/organizations/OrganizationChooser';
export const Route = createFileRoute('/organizations')({ loader: () => getOrganizations(), pendingComponent: () => <main className="chooser-page"><div className="skeleton-block" /></main>, component: OrganizationsRoute });
function OrganizationsRoute() { return <main className="chooser-page"><div className="brand large-brand"><span className="brand-mark">A</span><span>Amidala</span></div><OrganizationChooser result={Route.useLoaderData()} /></main>; }
