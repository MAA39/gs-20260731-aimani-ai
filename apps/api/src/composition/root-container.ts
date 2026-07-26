import { asValue, createContainer, InjectionMode, type AwilixContainer } from 'awilix';
import type { Clock } from '../application/health-check';

export interface RootCradle {
  clock: Clock;
  idGenerator: { next(): string };
}

export type RootContainer = AwilixContainer<RootCradle>;

export function createRootContainer(): RootContainer {
  const container = createContainer<RootCradle>({ strict: true, injectionMode: InjectionMode.PROXY });
  const clock: Clock = { now: () => new Date() };
  container.register({ clock: asValue(clock) });
  container.register({ idGenerator: asValue({ next: () => crypto.randomUUID() }) });
  return container;
}
