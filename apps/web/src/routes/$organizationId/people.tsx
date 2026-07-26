import { createFileRoute } from '@tanstack/react-router';
import { getPeople } from '../../features/people/people.functions';
import { getOrganizations } from '../../features/organizations/organizations.functions';
import { PeoplePage } from '../../features/people/Page';
export const Route = createFileRoute('/$organizationId/people')({ loader: async ({ params }) => { const [organizations, result] = await Promise.all([getOrganizations(), getPeople({ data: { organizationId: params.organizationId } })]); return { organizations, result, organization: organizations.find((item) => item.organizationId === params.organizationId) }; }, component: PeopleRoute });
function PeopleRoute() { const { organizations, result, organization } = Route.useLoaderData(); if (!organization) return <PeoplePage organization={{ organizationId: '', name: '選択した組織', slug: '', membershipId: '', role: 'member', displayName: '' }} organizations={organizations} result={{ status: 'forbidden', error: { code: 'forbidden', message: 'この組織では閲覧できません。' } }} />; return <PeoplePage organization={organization} organizations={organizations} result={result} />; }
