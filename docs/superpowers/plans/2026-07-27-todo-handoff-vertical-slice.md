# Todo Handoff Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現在担当者がTodoの引き継ぎを依頼し、相手が引き受ける・見送る、依頼者が取り消す操作をブラウザで完了でき、受諾後のTodoがOrganization scoped「自分のTodo」に現れるようにする。

**Architecture:** `TodoHandoff`はPostgreSQL上のtransaction recordであり、現在担当の正本は`Todo.assigneeMembershipId`のままとする。private Hono API Workerが認証・認可・transactionを所有し、TanStack Start BFFはService Binding越しに型付きcontractを検証する。WebはQuery loaderとmutation invalidationでserver stateを扱い、責任移管をoptimisticに表示しない。

**Tech Stack:** TypeScript 7.0.2, React 19.1.1, TanStack Start 1.168.32, TanStack Router 1.170.18, TanStack Query 5.101.4, Base UI 1.6.0, Hono 4.12.32, Drizzle ORM 0.45.2, PostgreSQL 17/18, Cloudflare Workers Service Binding, Vitest 4.1.10.

**Canonical Spec:** `docs/superpowers/specs/2026-07-27-todo-handoff-slice-design.md`

## Global Constraints

- Modify only `/Users/maa/Projects/gs/000_参照用/aimani-ai-v2` and an isolated worktree created from `feat/touchable-mvp`.
- Read `docs/README.md`, the canonical spec, `docs/standards/research-before-build.md`, and `docs/standards/domain-language-and-naming.md` before implementation.
- Use the exact domain names `TodoHandoff`, `RequestTodoHandoff`, `AcceptTodoHandoff`, `RejectTodoHandoff`, `CancelTodoHandoff`, `GetTodoHandoffWorkspace`, and `GetAssignedTodoWorkspace`.
- Status is exactly `requested | accepted | rejected | canceled`; terminal timestamp is `resolvedAt` / `resolved_at`.
- Browser input never supplies requester/current Membership. Derive it from Better Auth session User and Organization.
- Every DB lookup/update includes `organization_id`; Todo and Membership references use composite foreign keys.
- Accept is the only command that changes `Todo.assigneeMembershipId`; it never changes creator or context Membership.
- Use PostgreSQL `READ COMMITTED`, lock in `Todo → Membership ID ascending → TodoHandoff` order, and use conditional UPDATE + RETURNING.
- Exact request/terminal retry returns 200; a different active request or different terminal outcome returns 409.
- Do not add Event Sourcing, outbox, idempotency table, Queue, Webhook, RLS, policy engine, notification, WebSocket, admin reassignment, Todo detail, completion mutation, filters, or coverage thresholds.
- Do not use `useEffect` for user action or server-state synchronization. Do not optimistically change assignee or Handoff status.
- Prioritize the touchable desktop/mobile journey. Keep automated coverage to the two focused API integration behaviors in Task 1.

---

### Task 1: TodoHandoff domain, PostgreSQL transaction, API, and contracts

**Files:**
- Modify: `packages/db/src/schema/todo.ts`
- Create: `packages/db/src/schema/todo-handoff.ts`
- Modify: `packages/db/src/schema/index.ts`
- Generate: `packages/db/drizzle/0003_todo_handoff.sql`
- Generate: `packages/db/drizzle/meta/0003_snapshot.json`
- Modify: `packages/db/drizzle/meta/_journal.json`
- Create: `packages/contracts/src/todo-handoff.ts`
- Modify: `packages/contracts/src/todo.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/domain/todo-handoff.ts`
- Create: `apps/api/src/application/request-todo-handoff.ts`
- Create: `apps/api/src/application/accept-todo-handoff.ts`
- Create: `apps/api/src/application/reject-todo-handoff.ts`
- Create: `apps/api/src/application/cancel-todo-handoff.ts`
- Create: `apps/api/src/application/get-todo-handoff-workspace.ts`
- Create: `apps/api/src/application/get-assigned-todo-workspace.ts`
- Create: `apps/api/src/infrastructure/db/todo-handoff-repository.ts`
- Modify: `apps/api/src/infrastructure/db/todo-repository.ts`
- Create: `apps/api/src/routes/todo-handoffs.ts`
- Modify: `apps/api/src/routes/todos.ts`
- Modify: `apps/api/src/errors/api-error.ts`
- Modify: `apps/api/src/composition/request-scope.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/todo-handoffs.integration.test.ts`

**Interfaces:**
- Consumes: Better Auth session User, `CurrentMembershipContext`, existing Todo/Membership schema, request-scoped `AimaniAiDatabase`, `Clock`, and `IdGenerator`.
- Produces:

```ts
type TodoHandoffStatus = 'requested' | 'accepted' | 'rejected' | 'canceled'

type TodoHandoff = {
  id: string
  organizationId: string
  todoId: string
  requesterMembershipId: string
  recipientMembershipId: string
  requestMessage: string | null
  status: TodoHandoffStatus
  requestedAt: Date
  resolvedAt: Date | null
}

type RequestTodoHandoffInput = {
  organizationId: string
  todoId: string
  recipientMembershipId: string
  requestMessage?: string
}

type AcceptTodoHandoffInput = {
  organizationId: string
  handoffId: string
}

type RejectTodoHandoffInput = {
  organizationId: string
  handoffId: string
}

type CancelTodoHandoffInput = {
  organizationId: string
  handoffId: string
}

type RequestTodoHandoffCommand = {
  id: string
  organizationId: string
  todoId: string
  requesterMembershipId: string
  recipientMembershipId: string
  requestMessage: string | null
  now: Date
}

type AcceptTodoHandoffCommand = {
  organizationId: string
  handoffId: string
  recipientMembershipId: string
  now: Date
}

type RejectTodoHandoffCommand = {
  organizationId: string
  handoffId: string
  recipientMembershipId: string
  now: Date
}

type CancelTodoHandoffCommand = {
  organizationId: string
  handoffId: string
  requesterMembershipId: string
  now: Date
}

type TodoHandoffConflictReason =
  | 'handoff_already_requested'
  | 'handoff_already_resolved'
  | 'requester_is_not_current_assignee'
  | 'todo_not_open'
  | 'invalid_recipient'
  | 'inactive_recipient'

type RequestTodoHandoffOutcome =
  | { kind: 'created'; handoff: TodoHandoffSummary; todo: TodoSummary }
  | { kind: 'already_requested'; handoff: TodoHandoffSummary; todo: TodoSummary }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; reason: TodoHandoffConflictReason }

type AcceptTodoHandoffOutcome =
  | { kind: 'accepted'; handoff: TodoHandoffSummary; todo: TodoSummary }
  | { kind: 'already_accepted'; handoff: TodoHandoffSummary; todo: TodoSummary }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; reason: TodoHandoffConflictReason }

type RejectTodoHandoffOutcome =
  | { kind: 'rejected'; handoff: TodoHandoffSummary; todo: TodoSummary }
  | { kind: 'already_rejected'; handoff: TodoHandoffSummary; todo: TodoSummary }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; reason: TodoHandoffConflictReason }

type CancelTodoHandoffOutcome =
  | { kind: 'canceled'; handoff: TodoHandoffSummary; todo: TodoSummary }
  | { kind: 'already_canceled'; handoff: TodoHandoffSummary; todo: TodoSummary }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; reason: TodoHandoffConflictReason }

type TodoHandoffWorkspaceQuery = {
  organizationId: string
  currentMembershipId: string
}

type AssignedTodoWorkspaceQuery = {
  organizationId: string
  currentMembershipId: string
}

type TodoHandoffSummary = {
  handoffId: string
  organizationId: string
  todo: TodoSummary
  requester: TodoMemberSummary
  recipient: TodoMemberSummary
  requestMessage: string | null
  status: TodoHandoffStatus
  requestedAt: string
  resolvedAt: string | null
}

type TodoHandoffWorkspace = {
  organization: { organizationId: string; name: string }
  currentMember: TodoMemberSummary
  incomingRequests: TodoHandoffSummary[]
  outgoingRequests: TodoHandoffSummary[]
  recentHandoffs: TodoHandoffSummary[]
}

type AssignedTodoWorkspace = {
  organization: { organizationId: string; name: string }
  currentMember: TodoMemberSummary
  todos: TodoSummary[]
}
```

- Produces HTTP endpoints:

```text
POST /organizations/:organizationId/todos/:todoId/handoffs
POST /organizations/:organizationId/handoffs/:handoffId/accept
POST /organizations/:organizationId/handoffs/:handoffId/reject
POST /organizations/:organizationId/handoffs/:handoffId/cancel
GET  /organizations/:organizationId/handoffs
GET  /organizations/:organizationId/todos/assigned-to-me
```

- Produces contract schemas: `todoHandoffStatusSchema`, `requestTodoHandoffBodySchema`, `requestTodoHandoffPathSchema`, `todoHandoffPathSchema`, `organizationPathSchema`, `todoHandoffSummarySchema`, `todoHandoffWorkspaceSchema`, `assignedTodoWorkspaceSchema`, and resource-shaped `todoHandoffResponseSchema` for exactly `{ handoff: TodoHandoffSummary; todo: TodoSummary }`.
- Contract dependency is one-way: `todo.ts` owns `pendingTodoHandoffSchema` and `todoSummarySchema`; `todo-handoff.ts` imports them for Handoff/workspace/command responses; `todo.ts` never imports `todo-handoff.ts`.
- Extends every `TodoSummary` with `pendingHandoff`, exactly:

```ts
pendingHandoff: null | {
  handoffId: string
  requester: TodoMemberSummary
  recipient: TodoMemberSummary
  requestMessage: string | null
  requestedAt: string
}
```

- `ApiErrorCode` adds `conflict`, mapped to HTTP 409.

- [ ] **Step 1: Write the failing API integration tests**

Create `apps/api/src/routes/todo-handoffs.integration.test.ts` with two tests. Reuse the existing real sign-in and PostgreSQL style from `todos.integration.test.ts`; do not mock repositories.

First behavior:

```ts
it('moves responsibility only when the recipient accepts the Todo Handoff', async () => {
  const ownerCookie = await signIn('owner@aimani-ai.local')
  const moriCookie = await signIn('mori@aimani-ai.local')
  const todo = await createTodo(ownerCookie, {
    contextMembershipId: 'acme-studio-sato',
    assigneeMembershipId: 'acme-studio-owner',
  })

  const requested = await requestHandoff(ownerCookie, todo.todoId, {
    recipientMembershipId: 'acme-studio-mori',
    requestMessage: '次回の確認をお願いします',
  })
  expect(requested.status).toBe(201)

  const accepted = await acceptHandoff(moriCookie, requested.handoffId)
  expect(accepted.status).toBe(200)
  expect(accepted.todo.assignee.membershipId).toBe('acme-studio-mori')

  const retry = await acceptHandoff(moriCookie, requested.handoffId)
  expect(retry.status).toBe(200)
  expect(retry.handoff.handoffId).toBe(requested.handoffId)

  const assigned = await getAssignedTodos(moriCookie)
  expect(assigned.todos.some((item) => item.todoId === todo.todoId)).toBe(true)
})
```

Second behavior:

```ts
it('serializes competing decisions, rejects another Organization, and allows cancellation', async () => {
  const ownerCookie = await signIn('owner@aimani-ai.local')
  const satoCookie = await signIn('sato@aimani-ai.local')
  const suzukiCookie = await signIn('suzuki@aimani-ai.local')
  const todo = await createOwnerAssignedTodo(ownerCookie)
  const requested = await requestHandoff(ownerCookie, todo.todoId, {
    recipientMembershipId: 'acme-studio-sato',
    requestMessage: '',
  })

  const sameRequest = await requestHandoff(ownerCookie, todo.todoId, {
    recipientMembershipId: 'acme-studio-sato',
  })
  expect(sameRequest.status).toBe(200)
  expect(sameRequest.handoffId).toBe(requested.handoffId)

  const forbidden = await acceptHandoff(
    suzukiCookie,
    requested.handoffId,
    'org_northstar_lab',
  )
  expect(forbidden.status).toBe(404)

  const [accepted, rejected] = await Promise.all([
    acceptRaw(satoCookie, requested.handoffId),
    rejectRaw(satoCookie, requested.handoffId),
  ])
  expect([accepted.status, rejected.status].sort()).toEqual([200, 409])

  const currentAssigneeCookie = accepted.status === 200 ? satoCookie : ownerCookie
  const currentAssigneeId = accepted.status === 200
    ? 'acme-studio-sato'
    : 'acme-studio-owner'
  const nextRecipientId = currentAssigneeId === 'acme-studio-sato'
    ? 'acme-studio-mori'
    : 'acme-studio-sato'
  const next = await requestHandoff(currentAssigneeCookie, todo.todoId, {
    recipientMembershipId: nextRecipientId,
  })
  const canceled = await cancelHandoff(currentAssigneeCookie, next.handoffId)
  expect(canceled.status).toBe(200)
  expect(canceled.handoff.status).toBe('canceled')
  expect((await cancelHandoff(currentAssigneeCookie, next.handoffId)).status).toBe(200)

  const rerequested = await requestHandoff(currentAssigneeCookie, todo.todoId, {
    recipientMembershipId: currentAssigneeId === 'acme-studio-sato'
      ? 'acme-studio-owner'
      : 'acme-studio-mori',
  })
  expect(rerequested.status).toBe(201)
})
```

Test helpers must construct real Hono `Request` objects and consistently return the flattened shape `{ status, ...parsedBody }` used by the examples; keep credentials and fixture IDs identical to `apps/api/src/dev/seed.ts`.

- [ ] **Step 2: Run the focused integration test and verify RED**

Run against a disposable migrated and seeded PostgreSQL:

```bash
pnpm --filter @aimani-ai/api test:integration -- todo-handoffs.integration.test.ts
```

Expected: FAIL because the endpoints and `todo_handoff` table do not exist. A connection/setup error is not an acceptable RED; fix the test environment until the failure names the missing behavior.

Set `TEST_DATABASE_URL` to the disposable PostgreSQL, run every migration, then run the existing dev seed before RED/GREEN. Do not point this test at a shared or production database.

- [ ] **Step 3: Define contracts and the Drizzle schema**

Add `UNIQUE (id, organization_id)` to Todo. Define singular `todo_handoff` with the exact fields and checks from the canonical spec. Use these index/constraint names:

```text
todo_id_organization_unique
todo_handoff_todo_organization_fk
todo_handoff_requester_membership_fk
todo_handoff_recipient_membership_fk
todo_handoff_status_check
todo_handoff_distinct_memberships_check
todo_handoff_request_message_check
todo_handoff_resolution_consistency_check
todo_handoff_one_requested_per_todo_unique
todo_handoff_recipient_requested_idx
todo_handoff_requester_requested_idx
todo_handoff_todo_timeline_idx
```

Generate migration with:

```bash
pnpm --filter @aimani-ai/db exec drizzle-kit generate --name=todo_handoff
```

Inspect generated SQL and confirm it creates the Todo composite unique before the Handoff composite foreign key.

Use `ON DELETE CASCADE` for the Todo, Organization, requester Membership, and recipient Membership composite foreign keys, consistent with the existing Todo/Membership ownership model. The message check is `request_message IS NULL OR char_length(request_message) <= 500`.

- [ ] **Step 4: Implement the domain ports and explicit application use cases**

`apps/api/src/domain/todo-handoff.ts` owns the domain types and a `TodoHandoffRepository` port. The port exposes behavior, not raw table updates:

```ts
interface TodoHandoffRepository {
  findActiveMembershipForUser(
    userId: string,
    organizationId: string,
  ): Promise<CurrentMembershipContext | null>
  requestTodoHandoff(command: RequestTodoHandoffCommand): Promise<RequestTodoHandoffOutcome>
  acceptTodoHandoff(command: AcceptTodoHandoffCommand): Promise<AcceptTodoHandoffOutcome>
  rejectTodoHandoff(command: RejectTodoHandoffCommand): Promise<RejectTodoHandoffOutcome>
  cancelTodoHandoff(command: CancelTodoHandoffCommand): Promise<CancelTodoHandoffOutcome>
  getTodoHandoffWorkspace(query: TodoHandoffWorkspaceQuery): Promise<TodoHandoffWorkspace>
  getAssignedTodoWorkspace(query: AssignedTodoWorkspaceQuery): Promise<AssignedTodoWorkspace>
}
```

Application classes derive the active Membership from session User, then pass it to the domain command as `recipientMembershipId` for Accept/Reject or `requesterMembershipId` for Request/Cancel. They map missing Membership to `ApiError('forbidden')`, and map repository outcomes to `not_found`, `conflict`, or success. Keep all four public command classes separate.

- [ ] **Step 5: Implement atomic repository behavior**

In `TodoHandoffRepositoryDrizzle`, normalize `requestMessage` with:

```ts
const normalizedMessage = command.requestMessage?.trim() || null
```

For request, lock Todo first; lock requester/recipient Membership rows in ascending Membership ID order without evaluating active state; then lock/read the active requested TodoHandoff. If requester, recipient, and normalized message all match, return `already_requested`; a different active request returns conflict. Only when no active request exists, validate open Todo/current assignee and both Memberships active, then insert. A requester that became inactive after session resolution returns typed `forbidden`/403; an inactive recipient returns `inactive_recipient`/409.

For terminal commands, first do a non-locking Organization-scoped TodoHandoff lookup to learn `todoId`, requester, and recipient, and authorize the actor for that verb. Then start one transaction and follow this order exactly:

1. Lock Todo, but do not evaluate open/assignee invariants yet.
2. Lock requester/recipient Membership rows in ascending Membership ID order, but do not evaluate active state yet.
3. Lock TodoHandoff.
4. If its terminal status equals the requested verb, return that verb's explicit retry outcome (`already_accepted`, `already_rejected`, or `already_canceled`) before checking mutable Todo/Membership invariants.
5. If it has any other terminal status, return conflict.
6. Only while status is `requested`, validate open Todo/current assignee and the actor invariant for the verb: Accept/Reject require the recipient actor active but do not require the requester active; Cancel requires the requester actor active but does not require the recipient active. Request alone requires both parties active.
7. Perform conditional Handoff `UPDATE ... RETURNING`; for Accept, then conditionally update Todo.
8. If an expected updated row is missing, throw a typed transaction-abort error so the whole transaction rolls back; never return from a partially applied transaction.

Accept performs:

```ts
const [handoff] = await tx
  .update(todoHandoff)
  .set({ status: 'accepted', resolvedAt: now })
  .where(and(
    eq(todoHandoff.id, handoffId),
    eq(todoHandoff.organizationId, organizationId),
    eq(todoHandoff.recipientMembershipId, recipientMembershipId),
    eq(todoHandoff.status, 'requested'),
  ))
  .returning()

const [updatedTodo] = await tx
  .update(todo)
  .set({ assigneeMembershipId: recipientMembershipId, updatedAt: now })
  .where(and(
    eq(todo.id, todoId),
    eq(todo.organizationId, organizationId),
    eq(todo.assigneeMembershipId, requesterMembershipId),
    eq(todo.status, 'open'),
  ))
  .returning()

if (!handoff || !updatedTodo) throw new TodoHandoffTransactionConflict()
```

Reject/Cancel update only TodoHandoff. Map SQLSTATE `40P01` (deadlock) and `40001` (serialization failure) to retryable HTTP 503. Only when SQLSTATE is `23505` **and** the PostgreSQL constraint name is `todo_handoff_one_requested_per_todo_unique`, catch it outside the failed transaction; after rollback completes, run a new Organization-scoped query for the active request. Exact requester/recipient/normalized-message identity returns `already_requested`/200, otherwise `handoff_already_requested`/409. Do not translate unrelated primary-key or unique violations into a Handoff conflict. Catch `TodoHandoffTransactionConflict` outside the rolled-back transaction and translate it to the repository's typed conflict outcome, never a generic 500/503.

Query projections join Membership aliases and include pending Handoff on every Todo summary. Modify the existing `TodoRepositoryDrizzle` create/list projections and `toTodoSummary` mapping so every returned `TodoSummary` has either the requested Handoff summary or `null`; use a left join constrained to `status = 'requested'`. Recent Handoffs are limited to 20 and ordered by `resolvedAt DESC, id DESC`.

- [ ] **Step 6: Mount Hono routes and request-scoped DI**

Routes validate shared Zod contracts, resolve Better Auth session, and resolve exact use cases from the Awilix request scope. Request returns 201 only when created and 200 for exact retry. Terminal commands return 200. `conflict` is serialized as `{ error: { code: 'conflict', message } }` with HTTP 409.

Register repository and all six use cases in `RequestCradle` and `withRequestScope`; keep Hono/Drizzle/Awilix imports out of domain types and application classes.

- [ ] **Step 7: Verify GREEN and API package quality**

Run:

```bash
pnpm --filter @aimani-ai/api test:integration -- todo-handoffs.integration.test.ts
pnpm --filter @aimani-ai/api test -- --run
pnpm --filter @aimani-ai/api build
pnpm --filter @aimani-ai/db build
```

Expected: 2 focused integration behaviors pass, existing API unit tests pass, and both packages compile without warnings from the changed code.

- [ ] **Step 8: Commit Task 1**

```bash
git add packages/db packages/contracts apps/api
git commit -m "feat: add atomic Todo Handoff API"
```

---

### Task 2: TanStack Start BFF, contracts validation, and Query ownership

**Files:**
- Create: `apps/web/src/features/handoffs/handoff-schema.ts`
- Create: `apps/web/src/features/handoffs/handoff-queries.ts`
- Create: `apps/web/src/features/handoffs/handoffs.server.ts`
- Create: `apps/web/src/features/handoffs/handoffs.functions.ts`
- Create: `apps/web/src/features/todos/assigned-todo-queries.ts`
- Modify: `apps/web/src/features/todos/todo-schema.ts`
- Modify: `apps/web/src/features/todos/todos.server.ts`
- Modify: `apps/web/src/features/todos/todos.functions.ts`
- Create: `apps/web/src/features/people/people-queries.ts`

**Interfaces:**
- Consumes: Task 1 Hono endpoints and shared Zod schemas.
- Produces shared `as const` query-key factories used by loaders, components, and invalidation:

```ts
const todoHandoffWorkspaceKey = (organizationId: string) =>
  ['todoHandoffWorkspace', organizationId] as const
const assignedTodoWorkspaceKey = (organizationId: string) =>
  ['assignedTodos', organizationId] as const
const sharedTodoWorkspaceKey = (
  organizationId: string,
  contextMembershipId: string,
) => ['sharedTodoWorkspace', organizationId, contextMembershipId] as const
const sharedTodoWorkspaceOrganizationPrefix = (organizationId: string) =>
  ['sharedTodoWorkspace', organizationId] as const
const peopleKey = (organizationId: string) => ['people', organizationId] as const
```

- Produces Server Functions: `getTodoHandoffWorkspace`, `getAssignedTodoWorkspace`, `requestTodoHandoff`, `acceptTodoHandoff`, `rejectTodoHandoff`, `cancelTodoHandoff`.
- All adapters return discriminated unions with `ok | forbidden | not_found | conflict | error`; 401 redirects to `/login`.

- [ ] **Step 1: Add Web result contracts before adapters**

Define serializable input schemas and result unions. The mutation input must not contain requester/current Membership:

```ts
type RequestTodoHandoffInput = {
  organizationId: string
  todoId: string
  recipientMembershipId: string
  requestMessage?: string
}

type AcceptTodoHandoffInput = {
  organizationId: string
  handoffId: string
}

type RejectTodoHandoffInput = {
  organizationId: string
  handoffId: string
}

type CancelTodoHandoffInput = {
  organizationId: string
  handoffId: string
}
```

Each operation keeps its explicit verb in its public input/result type and returns the API-provided Handoff and current Todo summary. Conflict preserves `code: 'conflict'` so the UI can refetch instead of reporting a generic outage.

- [ ] **Step 2: Add server-only Hono Service Binding adapters**

Follow `todos.server.ts`: import `@tanstack/react-start/server-only`, forward only the cookie, use `env.API.fetch`, parse response bodies with shared Zod schemas, redirect 401, distinguish 403/404/409, and collapse network/invalid response/5xx to `service_unavailable`.

Keep any Hono RPC transport cast inside `.server.ts`. No feature component or `.functions.ts` file imports `cloudflare:workers`, the API app, or a database package.

- [ ] **Step 3: Add thin Server Functions and Query options**

Each `.functions.ts` export validates input and directly delegates to one `.server.ts` function. Query option factories are pure:

```ts
export const todoHandoffWorkspaceQuery = (organizationId: string) =>
  queryOptions({
    queryKey: todoHandoffWorkspaceKey(organizationId),
    queryFn: () => getTodoHandoffWorkspace({ data: { organizationId } }),
  })

export const assignedTodoWorkspaceQuery = (organizationId: string) =>
  queryOptions({
    queryKey: assignedTodoWorkspaceKey(organizationId),
    queryFn: () => getAssignedTodoWorkspace({ data: { organizationId } }),
  })
```

Create `peopleQuery` around the existing `getPeople` Server Function for Dialog candidate loading. Do not introduce a module-global QueryClient.

- [ ] **Step 4: Typecheck and build the BFF boundary**

Run:

```bash
pnpm --filter @aimani-ai/web exec tsc --noEmit
pnpm --filter @aimani-ai/web build
```

Expected: client and SSR bundles build; no server-only import leaks into client output.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/web/src/features/handoffs apps/web/src/features/todos apps/web/src/features/people/people-queries.ts
git commit -m "feat: add Todo Handoff BFF boundary"
```

---

### Task 3: Touchable Assigned Todo and Todo Handoff experience

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/features/handoffs/RequestTodoHandoffDialog.tsx`
- Create: `apps/web/src/features/handoffs/HandoffPage.tsx`
- Create: `apps/web/src/features/handoffs/HandoffRequestCard.tsx`
- Create: `apps/web/src/features/todos/AssignedTodoPage.tsx`
- Modify: `apps/web/src/features/todos/Page.tsx`
- Modify: `apps/web/src/features/todos/TodoCard.tsx`
- Create: `apps/web/src/routes/$organizationId/todos.tsx`
- Create: `apps/web/src/routes/$organizationId/handoffs.tsx`
- Delete: `apps/web/src/routes/todos.tsx`
- Delete: `apps/web/src/routes/handoffs.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Regenerate: `apps/web/src/routeTree.gen.ts`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: Task 2 query/mutation functions and Task 1 read models.
- Produces touchable routes `/$organizationId/todos` and `/$organizationId/handoffs`.
- `RequestTodoHandoffDialog` is Router-independent and accepts:

```ts
type RequestTodoHandoffDialogProps = {
  organizationId: string
  todo: TodoSummary
  currentMembershipId: string
  onRequested: () => void
}
```

- [ ] **Step 1: Install and pin Base UI**

Run:

```bash
pnpm --filter @aimani-ai/web add @base-ui/react@1.6.0
```

Do not add a generic design-system package or AlertDialog wrapper.

- [ ] **Step 2: Implement the request Dialog without Effect**

Use `Dialog.Root`, `Dialog.Trigger`, `Dialog.Portal`, `Dialog.Backdrop`, `Dialog.Viewport`, `Dialog.Popup`, `Dialog.Title`, `Dialog.Description`, and visible `Dialog.Close`.

Use local `open` state only to enable candidate loading:

```ts
const [open, setOpen] = useState(false)
const people = useQuery({
  ...peopleQuery(organizationId),
  enabled: open,
})
```

On submit, read FormData, validate recipient and optional 500-character message, and call `useMutation`. On success, first call `setOpen(false)` so Base UI completes its normal close while the trigger still exists, then await:

```ts
await Promise.all([
  queryClient.invalidateQueries({
    queryKey: assignedTodoWorkspaceKey(organizationId),
    exact: true,
  }),
  queryClient.invalidateQueries({
    queryKey: todoHandoffWorkspaceKey(organizationId),
    exact: true,
  }),
  queryClient.invalidateQueries({
    queryKey: sharedTodoWorkspaceOrganizationPrefix(organizationId),
    exact: false,
  }),
])
```

After invalidation, call `onRequested()`. The parent owns a ref to the Todo card's stable action/status wrapper and focuses it from that callback. The wrapper is rendered for every current-assignee Todo regardless of `pendingHandoff`; only its child switches between Dialog trigger and pending status, so refetch never removes the focus target. Normal Close/Escape behavior returns focus to the trigger through Base UI. Do not use `useEffect` for either path.

On conflict, invalidate the same keys and display「このTodoにはすでに引き継ぎ依頼があります。」Candidates exclude the current assignee and show name/title, not Membership IDs. Render every `peopleQuery` state explicitly: loading, forbidden with Organization-selection action, service unavailable with retry, zero eligible candidates, and success. Disable submit while no recipient is selected or mutation is pending, and show field-level errors for recipient and the 500-character message limit. Never read `.people` before narrowing the result to `ok`.

- [ ] **Step 3: Make Todo responsibility and pending Handoff visible**

Extend `TodoCard` to render pending status without owning Router state:

```text
引き継ぎを依頼中
現在担当 田中 彩 → 引き継ぎ先 森 ハル
依頼メッセージ（ある場合）
```

In Person Todo and Assigned Todo pages, always render a focusable stable action/status wrapper for a Todo when the current Membership is the assignee. Inside it, render `RequestTodoHandoffDialog` only when `pendingHandoff === null`; otherwise render the pending status. The parent-owned wrapper ref supplies the Dialog's `onRequested` focus callback. Do not add a generic render-prop Card API.

- [ ] **Step 4: Build Organization-scoped Assigned Todo page**

The route loader calls `ensureQueryData(assignedTodoWorkspaceQuery(organizationId))`; Page calls `useSuspenseQuery`. Show:

- Organization/current member context.
- open assigned Todo cards.
- request Dialog per eligible Todo.
- empty state「現在担当しているTodoはありません」and a People link.
- pending skeleton matching the final list dimensions.
- forbidden/not-found/service unavailable states with next action.

- [ ] **Step 5: Build the Todo Handoff work surface**

The route loader calls `ensureQueryData(todoHandoffWorkspaceQuery(organizationId))`. Render three sections:

```text
あなたへの依頼     incoming requested
送った依頼         outgoing requested
最近の引き継ぎ     accepted / rejected / canceled
```

Incoming card shows the responsibility rail and inline「引き受ける」primary /「見送る」secondary. Outgoing card shows「依頼を取り消す」quiet. A card has one mutation instance; while pending, disable all actions on that card and announce progress/result through `aria-live`.

After every command, await invalidation through the shared key factories: Handoff full key with `exact: true`, Assigned Todo full key with `exact: true`, and same-Organization SharedTodo prefix with `exact: false`. Same terminal retry remains a success. A 409 triggers refetch and copy「この依頼はすでに処理されています。」Accepted cards link to `/$organizationId/todos` with「自分のTodoで確認」。

Format every SSR-rendered `requestedAt`/`resolvedAt` value with `Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', ... })`; never depend on the server or browser default timezone.

- [ ] **Step 6: Replace global placeholders and preserve Organization navigation**

Delete the two static global route files. Update desktop/mobile navigation and page title so:

```text
People       /$organizationId/people
自分のTodo   /$organizationId/todos
引き継ぎ     /$organizationId/handoffs
```

Before an Organization is selected, all three lead to `/organizations`. Active state is exact for each top-level destination; Person Todo shows「自分のTodo」as visually active with `aria-current`, while its link target still always uses `to="/$organizationId/todos"` and `params={{ organizationId }}`. Never preserve the Person Todo pathname as the Todos link target and never build `/todos` by string concatenation. Do not leave hard-coded member fixtures in production routes.

Run the TanStack Router generator through the normal Vite build/dev command; do not hand-edit generated semantics beyond what the generator produces.

- [ ] **Step 7: Apply the established visual language and responsive behavior**

Use existing tokens and the Relationship rail. Accepted uses connected, requested attention, rejected/canceled neutral. Only accepted moves the responsibility node. At 390px, rail nodes stack vertically, Dialog width is `min(100% - 32px, 560px)`, actions wrap, targets are at least 44px, and bottom navigation remains visible. Respect `prefers-reduced-motion`; no constant pulse or page-load animation.

- [ ] **Step 8: Verify type/build before browser work**

Run:

```bash
pnpm --filter @aimani-ai/web exec tsc --noEmit
pnpm --filter @aimani-ai/web build
git diff --check
```

Expected: all pass; global placeholder route imports are absent from generated route tree.

- [ ] **Step 9: Commit Task 3**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: add touchable Todo Handoff workspace"
```

---

### Task 4: Real browser journey, reusable findings, and Cloudflare dry-run

**Files:**
- Modify: `docs/design/foundation.md`
- Modify: `docs/standards/react-tanstack-practices.md`
- Modify: `docs/superpowers/plans/2026-07-26-platform-todo-handoff.md`
- Create: `docs/research/2026-07-27-todo-handoff-verification.md`
- Create: `docs/assets/todo-handoff/accepted-recent-desktop.png`
- Create: `docs/assets/todo-handoff/request-or-incoming-mobile.png`

**Interfaces:**
- Consumes: completed Tasks 1-3, fresh migrated/seeded PostgreSQL, local Web/API Workers.
- Produces: evidence for the full owner → request → recipient → accept/reject/cancel → assigned Todo journey and reusable docs.

- [ ] **Step 1: Start from a fresh disposable database**

Apply all Drizzle migrations and seed the four demo users. Do not reuse data from the prior Todo browser session. Start Web/API development Workers with the documented Service Binding.

- [ ] **Step 2: Verify the desktop owner → recipient acceptance journey**

At 1280×900:

1. Sign in as owner and choose Acme Studio.
2. Open Sato's Person SharedTodo workspace.
3. Create an owner-assigned Todo.
4. Request Handoff to Mori with a message.
5. Confirm Todo card shows requested status and Mori, with no second request action.
6. Sign in as Mori and open Acme「引き継ぎ」.
7. Accept inline and confirm the card moves to recent accepted.
8. Open「自分のTodo」and confirm the Todo is assigned to Mori.
9. Directly reload both Organization-scoped URLs and confirm SSR output remains correct.

- [ ] **Step 3: Verify reject, cancel, retry copy, and Organization separation**

Create separate Todos for these flows:

- Recipient chooses「見送る」and assignee remains requester.
- Requester chooses「依頼を取り消す」and can request another active Membership.
- Open the same requested card in two tabs; after completing it in one tab, repeat the same terminal action from the other stale tab and confirm success, then use a separate request to confirm a different stale terminal action returns the handled 409 copy rather than a generic red outage.
- Sato cannot decide a Northstar Handoff; Acme Todos do not appear in Northstar Assigned Todo/Handoff pages.

- [ ] **Step 4: Verify the mobile work surface**

At 390×844:

- Dialog remains inside viewport; normal close returns focus to its trigger, while successful request focuses the stable Todo action/status wrapper after the trigger is replaced.
- Relationship rail stacks without horizontal overflow.
- Accept/Reject/Cancel targets are at least 44px and do not hide behind bottom navigation.
- `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
- reduced-motion disables responsibility-node movement.
- fresh tab console has zero React hydration warnings and zero application errors.

- [ ] **Step 5: Run complete local verification**

Run:

```bash
pnpm --filter @aimani-ai/api test -- --run
pnpm --filter @aimani-ai/api test:integration -- todo-handoffs.integration.test.ts
pnpm --filter @aimani-ai/web exec tsc --noEmit
pnpm build --force
pnpm --filter @aimani-ai/api exec wrangler deploy --dry-run
pnpm --filter @aimani-ai/web exec wrangler deploy --dry-run
git diff --check
```

Expected: all commands exit 0. Report any unrelated Turbo warning separately; do not hide application or Worker warnings.

- [ ] **Step 6: Record only reusable findings**

Update:

- `docs/design/foundation.md` with verified desktop/mobile screenshot findings and responsibility-rail behavior. Save at least one desktop image of accepted → recent Handoff and one 390px mobile image of the request Dialog or incoming request card under `docs/assets/todo-handoff/`, and reference them from the verification document.
- `docs/standards/react-tanstack-practices.md` with reusable Dialog, Query invalidation, SSR, and Organization-scoped navigation lessons.
- Parent MVP plan Task 6 with implemented files, decisions, and verification status.
- `docs/research/2026-07-27-todo-handoff-verification.md` with exact commands, outcomes, browser sizes, accounts/Organizations used, and any intentionally deferred work.

- [ ] **Step 7: Commit Task 4**

```bash
git add docs
git commit -m "docs: record Todo Handoff verification"
```

## Completion Gate

This slice is complete only when the browser proves that an active current assignee can request a Todo Handoff, the recipient can accept or reject it, the requester can cancel it, acceptance atomically changes the assignee, and the recipient sees the Todo in Organization-scoped「自分のTodo」on desktop and mobile. Passing tests without the touchable journey is insufficient.
