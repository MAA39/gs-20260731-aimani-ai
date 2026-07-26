import { asFunction, asValue, type AwilixContainer } from 'awilix';
import { HealthCheck, type Clock } from '../application/health-check';
import type { RootContainer, RootCradle } from './root-container';
import type { ApiBindings } from '../config/env';
import { resolveDatabaseUrl } from '../config/env';
import { createNodePgDatabase } from '@amidala/db/client';
import { createAuth } from '../auth/create-auth';
import { MembershipRepository } from '../infrastructure/db/membership-repository';
import { ListOrganizationMembershipsForUser } from '../application/list-organizations';

export interface RequestScopeArgs {
  env: ApiBindings;
  request: Request;
}

export interface RequestCradle extends RootCradle {
  env: ApiBindings;
  request: Request;
  healthCheck: HealthCheck;
  databaseResource: Awaited<ReturnType<typeof createNodePgDatabase>>; auth: ReturnType<typeof createAuth>; membershipRepository: MembershipRepository; listOrganizationMembershipsForUser: ListOrganizationMembershipsForUser;
}

export type RequestScope = AwilixContainer<RequestCradle>;

export async function withRequestScope<T>(
  root: RootContainer,
  { env, request }: RequestScopeArgs,
  execute: (scope: RequestScope) => Promise<T>,
): Promise<T> {
  const scope = root.createScope() as RequestScope;
  scope.register({
    env: asValue(env),
    request: asValue(request),
    healthCheck: asFunction(
      ({ clock }: { clock: Clock }) => new HealthCheck(clock),
    ).scoped(),
    databaseResource: asFunction(async ({ env }: { env: ApiBindings }) => {
      const resource = createNodePgDatabase(resolveDatabaseUrl(env));
      await resource.client.connect();
      return resource;
    }).scoped().disposer(async (resource: Promise<Awaited<ReturnType<typeof createNodePgDatabase>>>) => { (await resource).client.end(); }),
    auth: asFunction(({ databaseResource, env }: { databaseResource: Awaited<ReturnType<typeof createNodePgDatabase>>; env: ApiBindings }) => createAuth(databaseResource.database, env)).scoped(),
    membershipRepository: asFunction(({ databaseResource }: { databaseResource: Awaited<ReturnType<typeof createNodePgDatabase>> }) => new MembershipRepository(databaseResource.database)).scoped(),
    listOrganizationMembershipsForUser: asFunction(({ membershipRepository }: { membershipRepository: MembershipRepository }) => new ListOrganizationMembershipsForUser(membershipRepository)).scoped(),
  });

  try {
    return await execute(scope);
  } finally {
    await scope.dispose();
  }
}
