import { asFunction, asValue, type AwilixContainer } from 'awilix';
import { HealthCheck } from '../application/health-check';
import type { RootContainer } from './root-container';

export interface RequestScopeArgs {
  env: unknown;
  request: Request;
}

export async function withRequestScope<T>(
  root: RootContainer,
  { env, request }: RequestScopeArgs,
  execute: (scope: AwilixContainer) => Promise<T>,
): Promise<T> {
  const scope = root.createScope();
  scope.register({
    env: asValue(env),
    request: asValue(request),
    healthCheck: asFunction(
      ({ clock }: { clock: ConstructorParameters<typeof HealthCheck>[0] }) => new HealthCheck(clock),
    ).scoped(),
  });

  try {
    return await execute(scope);
  } finally {
    await scope.dispose();
  }
}
