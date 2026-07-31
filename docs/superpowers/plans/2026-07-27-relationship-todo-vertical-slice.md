# Relationship Todo Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in User open a Person workspace, create a shared Todo assigned to either participant, and see the persisted Todo and current assignee immediately in the browser.

**Architecture:** Todo remains inside the existing API Worker domain/application/infrastructure boundary until a second runtime consumer justifies package extraction. A Todo stores its immutable creator and context Memberships separately from its mutable assignee. TanStack Start uses thin Server Functions and the private Hono Service Binding; TanStack Query owns the SSR list cache and mutation invalidation.

**Tech Stack:** TypeScript 7.0.2, React 19.1.1, TanStack Start 1.168.32, TanStack Router 1.170.18, TanStack Query 5.101.4, TanStack Router SSR Query 1.167.1, Hono 4.12.32, Zod 4.4.3, Drizzle ORM 0.45.2, PostgreSQL 17, Awilix 13.0.5, Cloudflare Workers.

## Global Constraints

- Modify only `/Users/maa/Projects/gs/000_参照用/aimani-ai-v2`; legacy Aimani AI/BYARD repositories remain read-only.
- Use the exact domain terms `Todo`, `CurrentMembershipContext`, `Context Membership`, `Creator Membership`, and `Assignee Membership`; never use User ID as an Organization-scoped actor.
- Browser inputs never contain `creatorMembershipId`, `userId`, or `organizationId` outside typed route params. The API derives creator from the Better Auth session and active Membership.
- Every Todo query and write includes `organization_id`; all three Membership references use composite FKs to `(membership.id, membership.organization_id)`.
- `contextMembershipId` is immutable creation context. `assigneeMembershipId` is current responsibility and is the only field the later Handoff acceptance transaction changes.
- Do not add Event Sourcing, outbox, Queue, RLS, audit tables, Todo history, due date, labels, priority, attachments, notifications, completion mutation, or Handoff code in this slice.
- Web never imports DB/Hono/Better Auth and never fetches the API Worker publicly. It calls Start Server Functions, which forward cookies through the Cloudflare Service Binding.
- No data fetching or mutation follow-up in `useEffect`. Loader + `ensureQueryData`, `useSuspenseQuery`, `useMutation`, and awaited `invalidateQueries` own the flow.
- Do not use optimistic Todo insertion, mutation retry, offline persistence, TanStack Form, or `useActionState` in the same composer.
- Keep the test budget to one real PostgreSQL API integration test for this slice plus existing tests. Browser verification covers the UI.
- Do not deploy or create external resources.

---

### Task 1: Persist and expose relationship-context Todos

**Files:**
- Create: `packages/db/src/schema/todo.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/schema/organization.ts`
- Create: generated `packages/db/drizzle/0001_*.sql` and matching `packages/db/drizzle/meta/*`
- Create: `packages/contracts/src/todo.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/domain/todo.ts`
- Create: `apps/api/src/application/create-todo.ts`
- Create: `apps/api/src/application/list-shared-todos.ts`
- Create: `apps/api/src/infrastructure/db/todo-repository.ts`
- Create: `apps/api/src/routes/todos.ts`
- Create: `apps/api/src/routes/todos.integration.test.ts`
- Modify: `apps/api/src/errors/api-error.ts`
- Modify: `apps/api/src/composition/root-container.ts`
- Modify: `apps/api/src/composition/request-scope.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces table `todo(id, organization_id, context_membership_id, creator_membership_id, assignee_membership_id, title, description, status, created_at, updated_at)`.
- Produces `CreateSharedTodo.execute(userId, input): Promise<TodoSummary>`.
- Produces `GetSharedTodoWorkspace.execute(userId, input): Promise<SharedTodoWorkspace>`.
- Produces `GET|POST /organizations/:organizationId/people/:contextMembershipId/todos`.
- Produces `createTodoInputSchema`, `sharedTodoWorkspaceSchema`, `TodoSummary`, and `SharedTodoWorkspace` from `@aimani-ai/contracts`.

- [ ] **Step 1: Write the failing integration test**

Add `apps/api/src/routes/todos.integration.test.ts`. Connect a real `pg.Client` using `TEST_DATABASE_URL` and close it in `afterAll`. Do not delete shared seed/application data. Use a unique title derived from `crypto.randomUUID()` and compare the Northstar matching-row count before/after the forbidden request.

The single test is named `keeps a shared Todo inside its Organization relationship context` and performs these observable actions. The test connects to PostgreSQL but its first DB query occurs only after the POST 201 assertion. Therefore the pre-schema RED stops on an observable 404 assertion failure and cannot reach a missing-table query:

1. sign in as `owner@aimani-ai.local`;
2. POST Acme / Sato with `{ title: '次回1on1の論点をまとめる <uuid>', description: '共有メモを一つにする', assigneeMembershipId: 'acme-studio-sato' }`;
3. assert 201 and the returned Todo has creator `acme-studio-owner`, context `acme-studio-sato`, assignee `acme-studio-sato`, status `open`;
4. GET the same pair and assert the Todo is present with owner/Sato display names;
5. sign in as Sato, record the matching Northstar Todo count, and POST Northstar / Suzuki with the same body adjusted to `northstar-lab-suzuki`;
6. assert 403 and then use the test DB connection to assert the matching Northstar Todo count did not increase.

The production change this test catches is removal of session-derived creator/Organization membership validation or omission of the persisted pair fields.

- [ ] **Step 2: Run RED and record the expected failure**

Run:

```bash
TEST_DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani-ai \
  pnpm --filter @aimani-ai/api test:integration -- --run src/routes/todos.integration.test.ts
```

Expected before implementation: the POST route returns 404. A setup error, TypeScript error, or missing database is not an accepted RED.

- [ ] **Step 3: Add the Todo schema and migration**

Define singular table `todo` with text IDs and timezone-aware timestamps. Add these exact constraints:

```text
PK(id)
FK organization_id -> organization.id ON DELETE CASCADE
composite FK (context_membership_id, organization_id) -> membership(id, organization_id)
composite FK (creator_membership_id, organization_id) -> membership(id, organization_id)
composite FK (assignee_membership_id, organization_id) -> membership(id, organization_id)
CHECK context_membership_id <> creator_membership_id
CHECK status IN ('open', 'completed')
CHECK char_length(btrim(title)) BETWEEN 1 AND 160
CHECK description IS NULL OR char_length(description) <= 2000
```

Add indexes:

```text
todo_organization_creator_context_created_idx
  (organization_id, creator_membership_id, context_membership_id, created_at)
todo_organization_context_creator_created_idx
  (organization_id, context_membership_id, creator_membership_id, created_at)
todo_organization_assignee_status_idx
  (organization_id, assignee_membership_id, status)
relationship_organization_source_kind_idx
  (organization_id, source_membership_id, kind)
relationship_organization_target_kind_idx
  (organization_id, target_membership_id, kind)
```

Export the table, run `pnpm --filter @aimani-ai/db exec drizzle-kit generate`, inspect the generated SQL, run `pnpm db:migrate`, and do not hand-write an alternative migration.

- [ ] **Step 4: Define the shared contracts**

Use Zod to define:

```ts
todoStatusSchema = z.enum(['open', 'completed'])
todoMemberSummarySchema = z.object({
  membershipId: z.string().min(1),
  name: z.string(),
  title: z.string().nullable(),
})
createTodoBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  assigneeMembershipId: z.string().min(1),
})
personTodoPathSchema = z.object({
  organizationId: z.string().min(1),
  contextMembershipId: z.string().min(1),
})
```

`TodoSummary` contains `todoId`, `organizationId`, `contextMembershipId`, `title`, `description: string | null`, `status`, `creator`, `assignee`, and ISO-string `createdAt`/`updatedAt`. `SharedTodoWorkspace` contains `organization: { organizationId: string; name: string }`, `currentMember: TodoMemberSummary`, `contextMember: MemberSummary`, and `todos: TodoSummary[]`. The API read model, not pathname parsing, provides the visible Organization name on direct navigation.

- [ ] **Step 5: Implement the pure application boundary**

In `domain/todo.ts`, define `IdGenerator { next(): string }`, `CreateTodoCommand`, and the Todo read/write port types. Keep runtime validation at HTTP/contracts and business authorization in use cases.

`CreateSharedTodo` must:

1. resolve active Current Membership from `userId + organizationId`;
2. resolve active Context Membership from `contextMembershipId + organizationId`;
3. reject self-context as validation error;
4. allow the assignee only when it equals current or context Membership;
5. create an `open` Todo with server-derived creator, `idGenerator.next()`, and `clock.now()`.

`GetSharedTodoWorkspace` performs the same current/context checks and asks the repository for the symmetric creator/context pair. Missing Current Membership is 403; missing Context Membership is a typed `not_found` 404.

Register `idGenerator` in the root as `{ next: () => crypto.randomUUID() }`. Register `todoRepository`, `createSharedTodo`, and `getSharedTodoWorkspace` as scoped async Awilix resolvers, following existing DB disposal behavior.

- [ ] **Step 6: Implement the Drizzle repository and Hono routes**

Repository queries always include Organization ID. Use aliased Membership tables to return creator/assignee names and titles. List with:

```text
(creator = current AND context = selected)
OR
(creator = selected AND context = current)
```

sort newest first by `created_at`, then `id` for deterministic ties. Read the current Relationship in both valid directions using the same `manager_report` direction and symmetric `peer|supporter` rule as PeopleRepository; return an empty `relationshipKinds` array when unset.

The Hono POST parses path and JSON separately, calls `CreateSharedTodo`, and returns `{ todo }` with status 201. GET returns the `SharedTodoWorkspace`. Add `not_found` to `ApiErrorCode` with status 404. Preserve generic DB/configuration 503 mapping.

- [ ] **Step 7: Run GREEN, existing tests, and commit**

Run:

```bash
TEST_DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani-ai \
  pnpm --filter @aimani-ai/api test:integration -- --run src/routes/todos.integration.test.ts
pnpm --filter @aimani-ai/api test
pnpm --filter @aimani-ai/api build
pnpm --filter @aimani-ai/db build
```

Expected: the new test is 1/1 passing; existing API unit tests remain 2/2 passing. Commit `feat: add relationship Todo API`.

---

### Task 2: Add the TanStack Query BFF boundary

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/features/todos/todo-schema.ts`
- Create: `apps/web/src/features/todos/todos.server.ts`
- Create: `apps/web/src/features/todos/todos.functions.ts`
- Create: `apps/web/src/features/todos/todo-queries.ts`

**Interfaces:**
- Consumes typed Hono endpoints from Task 1 through `@aimani-ai/api-client`.
- Produces `sharedTodoWorkspaceQuery({ organizationId, contextMembershipId })`.
- Produces `getSharedTodoWorkspace` GET Server Function and `createSharedTodo` POST Server Function.
- Adds `queryClient` to typed TanStack Router context.

- [ ] **Step 1: Pin and configure Query for SSR**

Install exact production dependencies:

```text
@tanstack/react-query 5.101.4
@tanstack/react-router-ssr-query 1.167.1
```

Change `getRouter()` to create a fresh `QueryClient` on every call and pass it in Router context. Change the root declaration to `createRootRouteWithContext<{ queryClient: QueryClient }>()(...)` so every file-route loader has a typed `context.queryClient`. Call `setupRouterSsrQueryIntegration({ router, queryClient })` with default provider wrapping. Set only these defaults:

```ts
new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
    mutations: { retry: false },
  },
})
```

Do not create a module-global QueryClient.

- [ ] **Step 2: Add thin schema/function/server files**

`todo-schema.ts` reuses contract schemas and exposes serializable Server Function inputs. `todos.functions.ts` contains only `createServerFn`, `.validator(...)`, and calls into `todos.server.ts`.

`todos.server.ts`:

- imports `@tanstack/react-start/server-only`;
- reads the request cookie;
- creates the typed API client with `env.API.fetch`;
- redirects 401 to `/login`;
- preserves 403 as `forbidden`, 404 as `not_found`, validation as `validation_error`, and failures as `service_unavailable`;
- validates every 200/201 body with the contract schemas before returning it.

Use domain-specific names `getSharedTodoWorkspaceFromApi` and `createSharedTodoFromApi`, not generic `fetchData`/`postData`.

- [ ] **Step 3: Add stable query options**

Define:

```ts
export const sharedTodoWorkspaceQuery = (input: PersonTodoPath) =>
  queryOptions({
    queryKey: ['sharedTodoWorkspace', input.organizationId, input.contextMembershipId],
    queryFn: () => getSharedTodoWorkspace({ data: input }),
  })
```

The query function returns the full typed result union; it does not throw for expected 403/404/503 states. The Page decides which recovery UI to render.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm --filter @aimani-ai/web exec tsc --noEmit
pnpm --filter @aimani-ai/web build
```

Inspect the client build and ensure `cloudflare:workers`, DB, Hono server implementation, and Better Auth server code are not exposed through Todo client chunks. Commit `feat: add Todo Query BFF boundary`.

---

### Task 3: Build the touchable Person Todo workspace

**Files:**
- Create: `apps/web/src/features/todos/TodoComposer.tsx`
- Create: `apps/web/src/features/todos/TodoCard.tsx`
- Create: `apps/web/src/features/todos/Page.tsx`
- Create: `apps/web/src/routes/$organizationId/people/$contextMembershipId/todos.tsx`
- Modify: `apps/web/src/features/people/PersonCard.tsx`
- Modify: `apps/web/src/features/people/Page.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/styles.css`
- Generated: `apps/web/src/routeTree.gen.ts`

**Interfaces:**
- Consumes `SharedTodoWorkspace` and Query/Server Functions from Task 2.
- Produces browser flow `/$organizationId/people` → `/$organizationId/people/$contextMembershipId/todos` → persisted Todo in the list.

- [ ] **Step 1: Make People cards real navigation**

Pass `organizationId` into `PersonCard` and render the card as a semantic `Link` to:

```text
/$organizationId/people/$contextMembershipId/todos
```

Keep the Relationship label and honest Todo copy, but change the action to「共有Todoを見る」. Provide a visible focus state and do not nest a button inside the Link.

- [ ] **Step 2: Add the typed route and SSR preload**

The route loader calls:

```ts
context.queryClient.ensureQueryData(
  sharedTodoWorkspaceQuery({
    organizationId: params.organizationId,
    contextMembershipId: params.contextMembershipId,
  }),
)
```

Use the existing route pending/error patterns. The component reads with `useSuspenseQuery` and renders `Page`. Direct unauthorized/forbidden/not-found links show a recovery action back to that Organization's People route.

- [ ] **Step 3: Implement the composer without Effect state**

Use an uncontrolled native form and `FormData`. Fields:

- `title` required, maxLength 160;
- `description` optional, maxLength 2000;
- radio `assigneeMembershipId`: current member「自分が担当」default, or context member「<name>にお願い」.

Use `useMutation({ mutationFn, onSuccess })`. The mutation function calls `createSharedTodo`. `onSuccess` awaits exact query invalidation and then resets the form. Disable submit while pending and display「Todoを作成中…」. Show Zod/API error near the form with `role="alert"`; show success in `aria-live="polite"` and through the refreshed list. Do not use `useEffect`, optimistic insertion, or a second action-state reducer.

- [ ] **Step 4: Implement Person context and Todo cards**

The Page header shows:

- backlink「Peopleへ戻る」;
- context Member avatar, name, title, all Relationship labels or「関係を未設定」;
- current Organization name from `SharedTodoWorkspace.organization`;
- section label「共有Todo」. 存在しない「概要」routeやdisabled tabは表示しない。

Each Todo card shows title, optional description, `未完了`/`完了`, creator name, current assignee name, and creation date. Use the Relationship rail visual language to connect「作成」→「現在の担当」. Empty copy is「この人との共有Todoはまだありません」with one action that focuses the title field.

- [ ] **Step 5: Preserve Organization-aware navigation and responsive layout**

Update authenticated-shell Organization extraction with the exact match `^/([^/]+)/people/([^/]+)/todos$`. On that route, derive `peopleTo = /$organizationId/people` and `todosTo = pathname`; render the desktop/mobile People Link with `peopleTo` and the Todos Link with `todosTo`, so Todos is active without navigating to the unscoped placeholder `/todos`. Organization-global Todos remains outside this slice. Use `SharedTodoWorkspace.organization.name` for the visible direct-navigation context. At 390px, composer and cards stack, touch targets are at least 44px, bottom navigation does not cover submit, and `scrollWidth === clientWidth`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm --filter @aimani-ai/web exec tsc --noEmit
pnpm --filter @aimani-ai/web build
pnpm build
git diff --check
```

Commit `feat: add touchable Person Todo workspace`.

---

### Task 4: Verify the Todo journey and record reusable findings

**Files:**
- Modify: `docs/design/foundation.md`
- Modify: `docs/standards/react-tanstack-practices.md`
- Modify: `docs/superpowers/plans/2026-07-26-platform-todo-handoff.md`
- Modify: this plan's SDD progress ledger (git-ignored)

**Interfaces:**
- Produces verified local journey and the stable boundary consumed by the next Handoff plan.

- [ ] **Step 1: Start a fresh local database and app**

Start PostgreSQL 17 on the documented port, migrate, seed, and run the single `pnpm dev` entrypoint. Do not use a separately public API port.

- [ ] **Step 2: Verify the owner journey in the in-app browser**

At 1280×900:

1. login as owner;
2. open Acme → Sato;
3. create one Todo assigned to Sato;
4. verify the Todo, creator, assignee, Relationship, and Organization context;
5. reload the direct URL and verify persistence;
6. switch to Northstar and verify the Acme Todo is absent.

- [ ] **Step 3: Verify the member and mobile journeys**

Sign in as Sato and verify the same Acme pair sees the shared Todo, then verify Sato cannot open/create Northstar data. At 390×844, create another Todo assigned to self, verify no horizontal overflow, keyboard/focus path, bottom navigation, pending text, and no browser console error/warning.

- [ ] **Step 4: Run the complete slice verification**

Run fresh, non-cached evidence:

```bash
pnpm --filter @aimani-ai/api test
TEST_DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani-ai \
  pnpm --filter @aimani-ai/api test:integration -- --run
pnpm --filter @aimani-ai/web exec tsc --noEmit
pnpm build --force
pnpm --filter @aimani-ai/api exec wrangler deploy --dry-run
pnpm --filter @aimani-ai/web exec wrangler deploy --config dist/server/wrangler.json --dry-run
git diff --check
```

- [ ] **Step 5: Update Docs and commit**

Record actual browser findings, adopted Query invalidation practice, and any design corrections. Mark only the completed Todo checklist items in the parent plan. Commit `docs: record relationship Todo verification`.
