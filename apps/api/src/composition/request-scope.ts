import { asFunction, asValue, type AwilixContainer } from 'awilix';
import { HealthCheck, type Clock } from '../application/health-check';
import type { RootContainer, RootCradle } from './root-container';
import type { ApiBindings } from '../config/env';
import { resolveDatabaseUrl } from '../config/env';
import { createNodePgDatabase, type DatabaseResource } from '@amidala/db/client';
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
  databaseResource: Promise<DatabaseResource>; auth: Promise<ReturnType<typeof createAuth>>; membershipRepository: Promise<MembershipRepository>; listOrganizationMembershipsForUser: Promise<ListOrganizationMembershipsForUser>;
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
      try {
        await resource.client.connect();
        return resource;
      } catch (cause) {
        await resource.client.end().catch(() => undefined);
        throw cause;
      }
    }).scoped().disposer(async (resourcePromise: Promise<DatabaseResource>) => { const resource = await resourcePromise; await resource.client.end(); }),
    auth: asFunction(async ({ databaseResource, env }: { databaseResource: Promise<DatabaseResource>; env: ApiBindings }) => { const resource = await databaseResource; return createAuth(resource.database, env); }).scoped(),
    membershipRepository: asFunction(async ({ databaseResource }: { databaseResource: Promise<DatabaseResource> }) => { const resource = await databaseResource; return new MembershipRepository(resource.database); }).scoped(),
    listOrganizationMembershipsForUser: asFunction(async ({ membershipRepository }: { membershipRepository: Promise<MembershipRepository> }) => new ListOrganizationMembershipsForUser(await membershipRepository)).scoped(),
  });

  try {
    return await execute(scope);
  } finally {
    await scope.dispose();
  }
}
