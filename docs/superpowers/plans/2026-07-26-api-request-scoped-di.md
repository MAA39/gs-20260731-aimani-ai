# API Request-Scoped DI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Awilix into the private Hono API Worker so every request receives an isolated scope that is disposed after both successful and failed requests.

**Architecture:** Keep a single Worker-isolate root container containing stateless singleton dependencies only. Hono middleware creates one child scope per request, registers `env` and `request`, resolves application services through that scope, and disposes the scope in `finally`. Database and authentication dependencies are intentionally excluded from this slice and can later be registered as `SCOPED` resources without changing route code.

**Tech Stack:** TypeScript 7.0.2, Hono 4.12.32, Awilix 13.0.5, Vitest 4.1.10, Cloudflare Workers.

## Global Constraints

- Change only `<repo-root>`.
- Add DI only; do not add PostgreSQL, Drizzle, Better Auth, Hyperdrive bindings, Queue, or external resources.
- Awilix imports stay under `apps/api/src/composition`.
- Root registrations are stateless singletons; `env`, `request`, and application services are request-scoped or values.
- Domain/application services do not resolve the container themselves.
- Add one focused DI smoke test; do not add coverage gates or broad test infrastructure.

---

### Task 1: Request-scoped API composition root

**Files:**
- Create: `apps/api/src/application/health-check.ts`
- Create: `apps/api/src/composition/root-container.ts`
- Create: `apps/api/src/composition/request-scope.ts`
- Create: `apps/api/src/composition/composition-root.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/worker.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Produces: `Clock = { now(): Date }`
- Produces: `HealthCheck.execute(): { ok: true }`
- Produces: `createRootContainer(): RootContainer`
- Produces: `withRequestScope(root, { env, request }, execute): Promise<T>`
- Produces: `createApp(options?): Hono<ApiEnv>`

- [x] **Step 1: Add pinned dependencies and the failing DI smoke test**

Add `awilix@13.0.5` and `vitest@4.1.10`. The test must assert:

```ts
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
```

Add a second assertion in the same test file that throws inside `withRequestScope` and confirms the registered disposer still runs.

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @aimani-ai/api test -- --run`

Expected: FAIL because `root-container.ts` and `request-scope.ts` do not exist.

- [x] **Step 3: Implement the container-independent application service**

`health-check.ts` defines the `Clock` interface and a `HealthCheck` class. It must not import Awilix or Hono.

```ts
export interface Clock {
  now(): Date;
}

export class HealthCheck {
  constructor(private readonly clock: Clock) {}

  execute() {
    this.clock.now();
    return { ok: true as const };
  }
}
```

- [x] **Step 4: Implement root and request containers**

`createRootContainer` uses `createContainer({ strict: true, injectionMode: InjectionMode.PROXY })` and registers only a system `clock` singleton.

`withRequestScope` must:

1. call `root.createScope()`;
2. register `env` and `request` with `asValue`;
3. register `healthCheck` as a scoped factory;
4. execute the callback;
5. call `await scope.dispose()` in `finally`.

- [x] **Step 5: Wire Hono through middleware**

Change `app.ts` to export `createApp({ rootContainer } = {})`. Middleware wraps every request in `withRequestScope`, places the scope in Hono Variables, and calls `next()`. `/health` resolves `healthCheck` from `c.get('scope')`; the response remains exactly `{ "ok": true }`.

`worker.ts` creates the root once per Worker isolate:

```ts
import { createApp } from './app';
import { createRootContainer } from './composition/root-container';

export default createApp({ rootContainer: createRootContainer() });
```

- [x] **Step 6: Run focused and full verification**

Run:

```bash
pnpm --filter @aimani-ai/api test -- --run
pnpm --filter @aimani-ai/api build
pnpm build
```

Expected: one test file passes, TypeScript succeeds, and the monorepo build succeeds without new warnings.

Start `pnpm dev` and verify:

```bash
curl -fsS http://localhost:5173/api/health
```

Expected body: `{"ok":true}`.

- [x] **Step 7: Commit**

```bash
git add apps/api docs/superpowers/plans/2026-07-26-api-request-scoped-di.md pnpm-lock.yaml
git commit -m "feat: add request-scoped API dependency injection"
```
