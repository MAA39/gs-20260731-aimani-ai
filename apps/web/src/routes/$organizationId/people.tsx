import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/$organizationId/people')({ component: PeopleLayout });

function PeopleLayout() {
  return <Outlet />;
}
