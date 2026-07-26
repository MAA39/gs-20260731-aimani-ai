import { asFunction } from 'awilix';
import { describe, expect, it } from 'vitest';
import { createRootContainer } from './root-container';
import { withRequestScope } from './request-scope';

const requestArgs = () => ({ env: {}, request: new Request('http://localhost') });

describe('request-scoped composition root', () => {
  it('isolates request-scoped services and disposes resources', async () => {
    const root = createRootContainer();
    const instances: unknown[] = [];
    let disposed = 0;

    await withRequestScope(root, requestArgs(), async (scope) => {
      scope.register({
        disposable: asFunction(() => ({ close: () => disposed++ }))
          .scoped()
          .disposer((value) => value.close()),
      });
      instances.push(scope.resolve('healthCheck'));
      expect(scope.resolve('healthCheck')).toBe(instances[0]);
      scope.resolve('disposable');
    });

    await withRequestScope(root, requestArgs(), async (scope) => {
      instances.push(scope.resolve('healthCheck'));
    });

    expect(instances[1]).not.toBe(instances[0]);
    expect(disposed).toBe(1);
  });

  it('disposes resources when request execution throws', async () => {
    const root = createRootContainer();
    let disposed = 0;

    await expect(
      withRequestScope(root, requestArgs(), async (scope) => {
        scope.register({
          disposable: asFunction(() => ({ close: () => disposed++ }))
            .scoped()
            .disposer((value) => value.close()),
        });
        scope.resolve('disposable');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(disposed).toBe(1);
  });
});
