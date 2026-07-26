import { asFunction, asValue, type AwilixContainer } from 'awilix';
import { HealthCheck, type Clock } from '../application/health-check';
import type { RootContainer, RootCradle } from './root-container';

export interface RequestScopeArgs {
  env: unknown;
  request: Request;
}

export interface RequestCradle extends RootCradle {
  env: unknown;
  request: Request;
  healthCheck: HealthCheck;
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
  });

  try {
    return await execute(scope);
  } finally {
    await scope.dispose();
  }
}
