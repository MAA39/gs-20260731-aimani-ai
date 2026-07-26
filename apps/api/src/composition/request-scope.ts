import { asFunction, asValue, type AwilixContainer } from 'awilix';
import { HealthCheck, type Clock } from '../application/health-check';
import type { RootContainer, RootCradle } from './root-container';
import type { ApiBindings } from '../config/env';
import { resolveDatabaseUrl } from '../config/env';
import { createNodePgDatabase } from '@amidala/db/client';
import { createAuth } from '../auth/create-auth';
import { MembershipRepository } from '../infrastructure/db/membership-repository';
import { ListOrganizations } from '../application/list-organizations';

export interface RequestScopeArgs {
  env: ApiBindings;
  request: Request;
}

export interface RequestCradle extends RootCradle {
  env: ApiBindings;
  request: Request;
  healthCheck: HealthCheck;
  db: any; auth: ReturnType<typeof createAuth>; membershipRepository: MembershipRepository; listOrganizations: ListOrganizations;
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
    db: asFunction(({ env }: { env: ApiBindings }) => {
      const resource = createNodePgDatabase(resolveDatabaseUrl(env));
      return resource;
    }).scoped().disposer(async (resource) => { await resource.client.end(); }),
    auth: asFunction(({ db, env }: { db: any; env: ApiBindings }) => createAuth(db, env)).scoped(),
    membershipRepository: asFunction(({ db }: { db: any }) => new MembershipRepository(db)).scoped(),
    listOrganizations: asFunction(({ membershipRepository }: { membershipRepository: MembershipRepository }) => new ListOrganizations(membershipRepository)).scoped(),
  });

  try {
    return await execute(scope);
  } finally {
    await scope.dispose();
  }
}
