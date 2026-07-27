import { createServerFn } from '@tanstack/react-start';
import { listOrganizationsFromApi } from './organizations.server';
export const getOrganizations = createServerFn({ method: 'GET' }).handler(() => listOrganizationsFromApi());
