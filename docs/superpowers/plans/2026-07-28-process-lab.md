# Process Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 組織内の工程・担当・依存関係を実データで見渡し、工程の選択、状態更新、配置変更、依存線の追加と削除を試せる、後から一括削除可能な「工程ラボ」を追加する。

**Architecture:** `process-lab` を contracts / DB / API / web の各層で明示的な縦切り機能として追加する。Web は TanStack Start の Server Function から Service Binding 経由で Hono API を呼び、PostgreSQL の `ProcessBoard` 集約を読み書きする。工程の意味データと React Flow の配置データは分離し、依存関係の不変条件は API のドメイン関数とDB制約の両方で守る。

**Tech Stack:** React 19.1.1、TanStack Start / Router / Query、`@xyflow/react` 12.11.2、Hono、Zod 4.4.3、Drizzle ORM 0.45.2、PostgreSQL、Vitest / Node test runner

## Global Constraints

- 新規URLは `/$organizationId/process-lab`、表示名は「工程ラボ」とする。
- `@xyflow/react` は 12.11.2 のみ追加し、ELK / Dagre / Cytoscape は導入しない。
- すべての表示・更新は PostgreSQL の実データを使い、クライアントfixtureやモックAPIを置かない。
- Router依存は route、ドメインの実体は `features/process-lab` に閉じ込める。
- `useEffect` でサーバーデータを同期しない。ボードの `revision` を React Flow canvas の `key` に使う。
- 依存関係は自己参照、重複、存在しない工程、別組織・別ボード、循環を拒否する。
- 工程が2件以上なら依存線0件を許さず、孤立工程を許さない。
- 先行工程が未完了の工程は `waiting` を導出し、`in_progress` への変更を拒否する。
- モバイルはトポロジカル順の一覧表示と詳細・状態更新のみ。配置・依存線編集はデスクトップだけにする。
- メインナビゲーションを6項目に増やさず、Team Work 画面から文脈リンクを置く。
- Process Lab の削除手順を `docs/research/2026-07-28-process-lab-removal.md` に残す。
- Cloudflareへのpush / deployは行わない。

---

### Task 1: Process Lab contracts and graph invariants

**Files:**
- Create: `packages/contracts/src/process-lab.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/features/process-lab/process-graph.ts`
- Test: `apps/api/src/features/process-lab/process-graph.test.ts`

**Interfaces:**
- Produces: `ProcessStepStatus = 'not_started' | 'in_progress' | 'completed'`
- Produces: `ProcessBoard`, `ProcessStep`, `StepDependency`, `ProcessStepLayout`, `ProcessLabWorkspace`
- Produces: `validateDependencyChange(input): { ok: true } | { ok: false; reason: ProcessGraphViolation }`
- Produces: `deriveStepAvailability(steps, dependencies): Record<string, 'ready' | 'waiting' | 'completed'>`
- Produces: `topologicallySortSteps(steps, dependencies): ProcessStep[]`

- [x] **Step 1: Write failing tests for graph behavior**

```ts
import { describe, expect, it } from 'vitest';
import { deriveStepAvailability, topologicallySortSteps, validateDependencyChange } from './process-graph';

const steps = [
  { stepId: 'discover', boardId: 'board', organizationId: 'org', title: '要件を確かめる', status: 'completed' as const },
  { stepId: 'design', boardId: 'board', organizationId: 'org', title: '体験を設計する', status: 'not_started' as const },
  { stepId: 'release', boardId: 'board', organizationId: 'org', title: '届ける', status: 'not_started' as const },
];
const dependencies = [
  { predecessorStepId: 'discover', successorStepId: 'design' },
  { predecessorStepId: 'design', successorStepId: 'release' },
];

describe('process graph', () => {
  it('rejects an edge that closes a directed cycle', () => {
    expect(validateDependencyChange({ steps, dependencies, candidate: { predecessorStepId: 'release', successorStepId: 'discover' } }))
      .toEqual({ ok: false, reason: 'cycle' });
  });

  it('derives waiting only while a predecessor is incomplete', () => {
    expect(deriveStepAvailability(steps, dependencies)).toEqual({ discover: 'completed', design: 'ready', release: 'waiting' });
  });

  it('returns a stable predecessor-first mobile order', () => {
    expect(topologicallySortSteps(steps, dependencies).map((step) => step.stepId)).toEqual(['discover', 'design', 'release']);
  });
});
```

- [x] **Step 2: Run the unit test and observe RED**

Run: `pnpm --filter @amidala/api exec vitest run src/features/process-lab/process-graph.test.ts`

Expected: FAIL because `process-graph.ts` does not exist.

- [x] **Step 3: Add schemas and minimal pure graph functions**

Define Zod schemas for the workspace and mutations:

```ts
export const processStepStatusSchema = z.enum(['not_started', 'in_progress', 'completed']);
export const processLabWorkspaceSchema = z.object({
  board: z.object({ boardId: z.string(), organizationId: z.string(), name: z.string(), revision: z.number().int().nonnegative() }),
  steps: z.array(processStepSchema),
  dependencies: z.array(stepDependencySchema),
  layouts: z.array(processStepLayoutSchema),
});
export const updateProcessStepBodySchema = z.object({ status: processStepStatusSchema });
export const moveProcessStepBodySchema = z.object({ x: z.number().finite(), y: z.number().finite() });
export const connectProcessStepsBodySchema = z.object({ predecessorStepId: z.string().min(1), successorStepId: z.string().min(1) });
```

Implement graph traversal with `Map<string, string[]>` and Kahn's algorithm. `validateDependencyChange` must return literal reasons: `self_dependency | duplicate | missing_step | cross_board | cycle`.

- [x] **Step 4: Run unit tests and package builds**

Run: `pnpm --filter @amidala/api exec vitest run src/features/process-lab/process-graph.test.ts && pnpm --filter @amidala/contracts exec tsc -p tsconfig.json`

Expected: PASS.

- [x] **Step 5: Commit the contract and invariant slice**

```bash
git add packages/contracts apps/api/src/features/process-lab
git commit -m "feat: define Process Lab graph contract"
```

---

### Task 2: PostgreSQL schema, migration, and deterministic demo board

**Files:**
- Create: `packages/db/src/schema/process-lab.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0005_process_lab.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`
- Modify: `apps/api/src/dev/seed-development-data.ts`
- Test: `apps/api/src/dev/demo-seed.integration.test.ts`

**Interfaces:**
- Consumes: Process Lab IDs and statuses from Task 1.
- Produces: `processLabBoard`, `processLabStep`, `processLabDependency`, `processLabStepLayout` Drizzle tables.
- Produces deterministic board `process-lab-acme-product-launch` with six connected steps for `org_acme_studio`.

- [x] **Step 1: Extend the demo seed integration test first**

Add assertions that after seeding Acme has one board, six steps, at least five dependencies, no isolated step, and one layout row per step. Query the real database via Drizzle; do not assert on seed source text.

- [x] **Step 2: Run the demo test and observe RED**

Run: `TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo pnpm --filter @amidala/api test:demo -- --run src/dev/demo-seed.integration.test.ts`

Expected: FAIL because Process Lab tables do not exist.

- [x] **Step 3: Add the four tables and migration**

Use these database identities and constraints:

```ts
processLabBoard: id, organizationId, name, revision, createdAt, updatedAt
processLabStep: id, boardId, organizationId, assigneeMembershipId nullable, title, description nullable, dueDate date nullable, status, createdAt, updatedAt
processLabDependency: boardId, organizationId, predecessorStepId, successorStepId, createdAt
processLabStepLayout: boardId, organizationId, stepId, x doublePrecision, y doublePrecision, updatedAt
```

Add composite foreign keys so every step, edge endpoint, assignee, and layout belongs to the same organization/board. Add SQL checks for status values, trimmed title/name lengths, non-self edges, finite coordinates, and unique `(board_id, predecessor_step_id, successor_step_id)`. The directed-cycle rule remains transactional application logic because PostgreSQL CHECK constraints cannot inspect other rows.

- [x] **Step 4: Seed the connected Acme launch flow**

Seed six domain-named steps with stable IDs and positions:

1. `problem_discovery` — 課題を確かめる — completed — 田中
2. `experience_design` — 体験を設計する — completed — 佐藤
3. `prototype_validation` — プロトタイプを触って確かめる — in_progress — 森
4. `launch_preparation` — 提供準備を整える — not_started — 田中
5. `customer_guidance` — 利用案内を用意する — not_started — 佐藤
6. `product_launch` — 顧客へ届ける — not_started — 森

Connect 1→2→3, 3→4, 3→5, 4→6, 5→6. Give every step a layout row.

- [x] **Step 5: Reset the local demo DB and observe GREEN**

Run: `pnpm db:demo:reset && TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo pnpm --filter @amidala/api test:demo -- --run src/dev/demo-seed.integration.test.ts`

Expected: PASS and the development database contains the Process Lab board.

- [x] **Step 6: Commit the persistence slice**

```bash
git add packages/db apps/api/src/dev
git commit -m "feat: persist and seed Process Lab board"
```

---

### Task 3: Authenticated Hono API for reading and mutating a board

**Files:**
- Create: `apps/api/src/features/process-lab/process-lab-repository.ts`
- Create: `apps/api/src/features/process-lab/process-lab-service.ts`
- Create: `apps/api/src/features/process-lab/process-lab-routes.ts`
- Create: `apps/api/src/features/process-lab/process-lab.integration.test.ts`
- Modify: `apps/api/src/composition/request-scope.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `GET /organizations/:organizationId/process-lab`
- Produces: `PATCH /organizations/:organizationId/process-lab/steps/:stepId/status`
- Produces: `PATCH /organizations/:organizationId/process-lab/steps/:stepId/layout`
- Produces: `POST /organizations/:organizationId/process-lab/dependencies`
- Produces: `DELETE /organizations/:organizationId/process-lab/dependencies/:predecessorStepId/:successorStepId`
- Every mutation returns the complete updated `ProcessLabWorkspace` and increments `board.revision` exactly once.

- [x] **Step 1: Write API integration tests against real PostgreSQL**

Cover only these user-visible boundaries:

```ts
it('returns the connected board to an authenticated organization member');
it('returns 403 when a member requests another organization board');
it('rejects starting a step whose predecessor is incomplete');
it('rejects a dependency that creates a directed cycle');
it('persists a moved step and returns the incremented revision');
it('connects and disconnects a valid dependency without leaving an isolated step');
```

Use the existing Better Auth test helper and real test database pattern from `todo-handoffs.integration.test.ts`.

- [x] **Step 2: Run the integration test and observe RED**

Run: `TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo pnpm --filter @amidala/api test:integration -- --run src/features/process-lab/process-lab.integration.test.ts`

Expected: FAIL with 404 because routes are not mounted.

- [x] **Step 3: Implement repository transactions**

`ProcessLabRepository` must expose:

```ts
getWorkspaceForMember(userId: string, organizationId: string): Promise<ProcessLabWorkspace | null>
updateStepStatus(userId: string, organizationId: string, stepId: string, status: ProcessStepStatus): Promise<ProcessLabWorkspace>
moveStep(userId: string, organizationId: string, stepId: string, position: { x: number; y: number }): Promise<ProcessLabWorkspace>
connectSteps(userId: string, organizationId: string, input: ConnectProcessStepsInput): Promise<ProcessLabWorkspace>
disconnectSteps(userId: string, organizationId: string, input: ConnectProcessStepsInput): Promise<ProcessLabWorkspace>
```

Lock the board row with `FOR UPDATE` for mutations, load the graph in the same transaction, validate it through Task 1 functions, apply one mutation, increment revision once, and return a fresh workspace. Use organization membership in every read/write predicate.

- [x] **Step 4: Implement a thin service and thin Hono adapters**

The service converts domain violations to `ApiError('conflict', message)` and authorization misses to `ApiError('forbidden', ...)`. The Hono file performs only session lookup, Zod parsing, service resolution, and HTTP response selection.

- [x] **Step 5: Mount the slice in DI and app, then observe GREEN**

Register `processLabRepository` and `processLabService` as request-scoped dependencies and mount `createProcessLabRoutes()` once in `app.ts`.

Run: `TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo pnpm --filter @amidala/api test:integration -- --run src/features/process-lab/process-lab.integration.test.ts`

Expected: PASS.

- [x] **Step 6: Commit the API slice**

```bash
git add apps/api/src/features/process-lab apps/api/src/composition/request-scope.ts apps/api/src/app.ts
git commit -m "feat: expose Process Lab API"
```

---

### Task 4: TanStack Start BFF and side-effect-free query boundary

**Files:**
- Create: `apps/web/src/features/process-lab/process-lab-schema.ts`
- Create: `apps/web/src/features/process-lab/process-lab-query-key.ts`
- Create: `apps/web/src/features/process-lab/process-lab.server.ts`
- Create: `apps/web/src/features/process-lab/process-lab.functions.ts`
- Create: `apps/web/src/features/process-lab/process-lab-queries.ts`
- Test: `apps/web/src/features/process-lab/process-lab-schema.test.ts`

**Interfaces:**
- Produces: `processLabKey(organizationId) => ['process-lab', organizationId]`
- Produces: `processLabQuery(organizationId)`
- Produces Server Functions `getProcessLab`, `updateProcessStepStatus`, `moveProcessStep`, `connectProcessSteps`, `disconnectProcessSteps`.

- [x] **Step 1: Write a failing schema boundary test**

Assert that a complete API workspace parses, while a dependency pointing at an absent step is rejected by the web presenter schema refinement. Keep expected error behavior literal.

- [x] **Step 2: Run the web test and observe RED**

Run: `pnpm --filter @amidala/web test -- src/features/process-lab/process-lab-schema.test.ts`

Expected: FAIL because the schema module is missing.

- [x] **Step 3: Implement the BFF modules**

Follow the existing `features/work` split. `process-lab-query-key.ts` must import no Server Function or server-only module. The server adapter forwards cookies through `createApiFetcher`, redirects 401 to `/login`, maps 403/404/409 to Japanese user-facing results, validates all 200 responses with `processLabWorkspaceSchema`, and treats malformed responses as `service_unavailable`.

- [x] **Step 4: Run the focused web test and typecheck**

Run: `pnpm --filter @amidala/web test -- src/features/process-lab/process-lab-schema.test.ts && pnpm --filter @amidala/web exec tsc --noEmit -p tsconfig.json`

Expected: PASS.

- [x] **Step 5: Commit the BFF slice**

```bash
git add apps/web/src/features/process-lab
git commit -m "feat: add Process Lab BFF boundary"
```

---

### Task 5: Interactive desktop canvas and mobile process list

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/features/process-lab/ProcessLabPage.tsx`
- Create: `apps/web/src/features/process-lab/ProcessCanvas.tsx`
- Create: `apps/web/src/features/process-lab/ProcessStepNode.tsx`
- Create: `apps/web/src/features/process-lab/ProcessInspector.tsx`
- Create: `apps/web/src/features/process-lab/MobileProcessList.tsx`
- Create: `apps/web/src/features/process-lab/process-lab-presenter.ts`
- Test: `apps/web/src/features/process-lab/process-lab-presenter.test.ts`
- Create: `apps/web/src/features/process-lab/process-lab.css`

**Interfaces:**
- Consumes: Task 4 queries and mutation Server Functions.
- Produces: `toFlowNodes(workspace, selectedStepId)` and `toFlowEdges(workspace, selectedStepId)`.
- Produces: `ProcessLabPage({ organizationId, result, retry })`.

- [x] **Step 1: Add the exact React Flow dependency**

Run: `pnpm --filter @amidala/web add @xyflow/react@12.11.2`

Expected: only `apps/web/package.json` and `pnpm-lock.yaml` change.

- [x] **Step 2: Write failing presenter tests**

Test hand-derived fixtures for:

```ts
it('marks a blocked node as waiting');
it('highlights the selected node and its upstream and downstream responsibility path');
it('orders the mobile list predecessor-first');
```

- [x] **Step 3: Run presenter tests and observe RED**

Run: `pnpm --filter @amidala/web test -- src/features/process-lab/process-lab-presenter.test.ts`

Expected: FAIL because presenter functions do not exist.

- [x] **Step 4: Implement presenter and accessible visual components**

The desktop node shows title, assignee avatar/name, due date, status, and a compact progress cue. Handles have visible connection affordances. Edges use directional arrows and distinct selected/upstream/downstream styles. Node and edge selection synchronize with the right inspector. Set React Flow `nodesFocusable`, `edgesFocusable`, `ariaLabelConfig`, keyboard delete only for a selected edge, and Japanese `aria-label` values.

Use event-driven updates only:

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodeDragStop={(_, node) => savePosition(node.id, node.position)}
  onConnect={(connection) => connect(connection.source, connection.target)}
  onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
  isValidConnection={(connection) => canConnect(workspace, connection)}
/>
```

Mutation calls are serialized per board. While saving, show `保存中`; on success replace query data with the returned full workspace; on failure show an inline retryable message and keep the local canvas visible.

- [x] **Step 5: Implement responsive, Amidala-native styling**

Use existing color/spacing tokens and Manrope / Noto Sans JP. Desktop layout is canvas plus 320px inspector; mobile under 760px hides canvas and shows the topologically ordered stacked list. Avoid gradients, dashboard-card grids, ornamental metrics, and oversized titles. Include a small `実験機能` badge and one-sentence explanation so the page reads as a disposable lab.

- [x] **Step 6: Run presenter tests and web typecheck**

Run: `pnpm --filter @amidala/web test -- src/features/process-lab/process-lab-presenter.test.ts && pnpm --filter @amidala/web exec tsc --noEmit -p tsconfig.json`

Expected: PASS.

- [x] **Step 7: Commit the interaction slice**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/features/process-lab
git commit -m "feat: build interactive Process Lab canvas"
```

---

### Task 6: Route, application shell, and contextual discovery

**Files:**
- Create: `apps/web/src/routes/$organizationId/process-lab.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/features/work/TeamWorkPage.tsx`

**Interfaces:**
- Produces route `/$organizationId/process-lab` with loader-prefetched data.
- Keeps existing five-item desktop/bottom navigation unchanged.

- [x] **Step 1: Add the route adapter**

Use `ensureQueryData(processLabQuery(organizationId))`, a skeleton `pendingComponent`, and `useSuspenseQuery` in the route. Render `ProcessLabPage` and pass refetch only for the failed initial read. Import `@xyflow/react/dist/style.css` and `process-lab.css` from the Process Lab route/component boundary.

- [x] **Step 2: Extend the shell's organization-route recognition**

Add `process-lab` to the root route regex and page-title mapping so authentication, organization context, and the Amidala shell apply. Do not add it to main navigation arrays.

- [x] **Step 3: Add one contextual link from Team Work**

Add a subdued link labelled `工程のつながりを試す` with supporting copy `誰の仕事が、次の誰を待たせているかを線で確認できます。` targeting `/$organizationId/process-lab`.

- [x] **Step 4: Generate route tree and build**

Run: `pnpm --filter @amidala/web build`

Expected: TanStack route generation includes `process-lab`, build succeeds, and no server-only code leaks into the client bundle.

- [x] **Step 5: Commit route integration**

```bash
git add apps/web/src/routes apps/web/src/features/work/TeamWorkPage.tsx
git commit -m "feat: link Process Lab into Amidala"
```

---

### Task 7: Removal manifest, full verification, and real-browser UX check

**Files:**
- Create: `docs/research/2026-07-28-process-lab-removal.md`
- Modify: `docs/superpowers/plans/2026-07-28-process-lab.md` (check completed boxes only)

**Interfaces:**
- Produces a complete deletion manifest for source, route mount, DI registrations, schema exports, migration implications, seed rows, package dependency, and navigation link.

- [x] **Step 1: Write the removal manifest**

List every Process Lab-owned directory/file and every integration seam outside it. State that removing an already-applied migration requires a new forward migration that drops the four tables; never edit migration history after shared deployment. State that `@xyflow/react` can be removed when no other feature imports it.

- [x] **Step 2: Run the complete local verification suite**

Run:

```bash
pnpm db:demo:reset
pnpm --filter @amidala/api test
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo pnpm --filter @amidala/api test:integration
pnpm db:demo:reset
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo pnpm --filter @amidala/api test:demo
pnpm --filter @amidala/web test
pnpm build
```

Expected: all commands exit 0 with no test warnings or build errors.

- [x] **Step 3: Start the actual app and verify the desktop journey**

Run `pnpm dev`, log in with the existing local demo account, then verify in the in-app browser:

1. Open `/org_acme_studio/work` and discover the contextual Process Lab link.
2. Open `/org_acme_studio/process-lab` and see six real seeded steps with arrows.
3. Select a step and confirm inspector plus upstream/downstream highlighting.
4. Drag a node, reload, and confirm its position persisted.
5. Add a valid dependency and remove it again.
6. Try to start a waiting step and confirm the UI explains why it cannot start.
7. Complete the blocking predecessor and confirm the successor becomes ready.

- [x] **Step 4: Verify the mobile journey**

Resize below 760px. Confirm the graph becomes a predecessor-first list, details and valid status changes remain usable, and drag/connect controls are absent.

- [x] **Step 5: Inspect the repository for accidental coupling and secrets**

Run:

```bash
git status --short
git diff --check main...HEAD
rg -n "lin_api_|ghp_|cfat_|sb_secret_|DATABASE_URL=.*postgres" --glob '!pnpm-lock.yaml' .
rg -n "process-lab|ProcessLab|processLab" apps packages docs/research/2026-07-28-process-lab-removal.md
```

Expected: diff check is clean, secret scan finds no newly committed credential, and every integration seam appears in the removal manifest.

- [x] **Step 6: Commit verification documentation**

```bash
git add docs/research/2026-07-28-process-lab-removal.md docs/superpowers/plans/2026-07-28-process-lab.md
git commit -m "docs: record Process Lab removal and verification"
```
