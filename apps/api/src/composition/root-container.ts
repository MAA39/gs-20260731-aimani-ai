import { asValue, createContainer, InjectionMode, type AwilixContainer } from 'awilix';
import { HealthCheck, type Clock } from '../application/health-check';

export type RootContainer = AwilixContainer;

export function createRootContainer(): RootContainer {
  const container = createContainer({ strict: true, injectionMode: InjectionMode.PROXY });
  const clock: Clock = { now: () => new Date() };
  container.register({ clock: asValue(clock) });
  return container;
}
