# Today Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 田中から森へのTodo Handoffを、現在actor・受信・自分の担当・相手待ち・直近の責任移動まで一画面で理解して操作できる「今日のボール」として完成させる。

**Architecture:** `/$organizationId/today` のloaderが既存の `assignedTodoWorkspaceQuery` と `todoHandoffWorkspaceQuery` を並列prefetchし、Pageが同じquery optionsを `useSuspenseQuery` で読む。新しいAPI、DB、Today固有cache、`useEffect`は作らず、pure compositionと既存の `TodoCard` / `RequestTodoHandoffDialog` / `HandoffRequestCard` を組み合わせる。

**Tech Stack:** React 19、TanStack Start / Router / Query、TypeScript、Node test runner、既存CSS、Lucide React

## Global Constraints

- 正本specは `docs/superpowers/specs/2026-07-27-three-minute-handoff-demo-design.md`。
- Router依存は `routes`、画面compositionは `features/today`、Todo/Handoffの能力は各既存featureに置く。
- `assignedTodoWorkspaceQuery(organizationId)` と `todoHandoffWorkspaceQuery(organizationId)` 以外のread modelを追加しない。
- mutation成功時は既存の2 query keyのinvalidationをawaitし、Today固有query keyを作らない。
- 状態同期に `useEffect` を使わない。
- 主区分は「あなたへの依頼」「いま自分が持つボール」「相手の返答を待っている」の順。責任移動の確認用に既存recent dataを小さな「最近動いたボール」として最後に置く。
- desktop 1280×720、mobile 390×844、44px操作領域、色だけに依存しない状態表現を守る。
- Cloudflare deploy、DB schema変更、汎用dashboard、通知、Webhookは対象外。
- テスト数を目的化せず、pure composition 1ファイルと既存suite、build、最終browser journeyで守る。

---

### Task 1: Todayの責任状態をpure compositionで定義する

**Files:**
- Create: `apps/web/src/features/today/today-workspace.ts`
- Test: `apps/web/src/features/today/today-workspace.test.ts`

**Interfaces:**
- Consumes: `AssignedTodoWorkspace`、`TodoHandoffWorkspace` from `@amidala/contracts`
- Produces: `composeTodayWorkspace(assignedWorkspace, handoffWorkspace): TodayWorkspace`
- `TodayWorkspace` fields: `organization`、`currentMember`、`incomingRequests`、`ownedTodos`、`outgoingRequests`、`recentHandoffs`
- `ownedTodos` は `pendingHandoff === null` のTodoだけ。依頼中Todoは「相手の返答を待っている」へ一度だけ表示する。

- [x] **Step 1: failing testを書く**

`apps/web/src/features/today/today-workspace.test.ts` に、同じTodoがassignedとoutgoingの両方へ入るfixtureを置き、次をassertする。

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { AssignedTodoWorkspace, TodoHandoffWorkspace } from '@amidala/contracts';
import { composeTodayWorkspace } from './today-workspace';

test('Todayは受信・自分のボール・相手待ち・直近の責任移動へ重複なく分ける', () => {
  const result = composeTodayWorkspace(assignedWorkspace, handoffWorkspace);

  assert.deepEqual(result.incomingRequests.map((item) => item.handoffId), ['handoff-incoming']);
  assert.deepEqual(result.ownedTodos.map((item) => item.todoId), ['todo-owned']);
  assert.deepEqual(result.outgoingRequests.map((item) => item.handoffId), ['handoff-outgoing']);
  assert.deepEqual(result.recentHandoffs.map((item) => item.handoffId), ['handoff-accepted']);
  assert.equal(result.currentMember.membershipId, 'membership-tanaka');
});
```

Fixtureは契約型を満たし、`todo-waiting.pendingHandoff.handoffId` と `handoff-outgoing.handoffId` を一致させる。`todo-owned.pendingHandoff` は `null` とする。

- [x] **Step 2: REDを確認する**

Run: `pnpm --filter @amidala/web test`

Expected: `ERR_MODULE_NOT_FOUND` または `composeTodayWorkspace is not a function` で新規testだけが失敗する。

- [x] **Step 3: 最小実装を書く**

`apps/web/src/features/today/today-workspace.ts`:

```ts
import type { AssignedTodoWorkspace, TodoHandoffWorkspace } from '@amidala/contracts';

export type TodayWorkspace = {
  organization: AssignedTodoWorkspace['organization'];
  currentMember: AssignedTodoWorkspace['currentMember'];
  incomingRequests: TodoHandoffWorkspace['incomingRequests'];
  ownedTodos: AssignedTodoWorkspace['todos'];
  outgoingRequests: TodoHandoffWorkspace['outgoingRequests'];
  recentHandoffs: TodoHandoffWorkspace['recentHandoffs'];
};

export function composeTodayWorkspace(
  assignedWorkspace: AssignedTodoWorkspace,
  handoffWorkspace: TodoHandoffWorkspace,
): TodayWorkspace {
  return {
    organization: assignedWorkspace.organization,
    currentMember: assignedWorkspace.currentMember,
    incomingRequests: handoffWorkspace.incomingRequests,
    ownedTodos: assignedWorkspace.todos.filter((todo) => todo.pendingHandoff === null),
    outgoingRequests: handoffWorkspace.outgoingRequests,
    recentHandoffs: handoffWorkspace.recentHandoffs,
  };
}
```

- [x] **Step 4: GREENと全Web testsを確認する**

Run: `pnpm --filter @amidala/web test`

Expected: 既存10件と新規1件がpassし、fail 0。

- [x] **Step 5: commitする**

```bash
git add apps/web/src/features/today/today-workspace.ts apps/web/src/features/today/today-workspace.test.ts
git commit -m "feat: compose today's responsibility states"
```

### Task 2: Assigned Todoの操作カードを再利用可能にする

**Files:**
- Create: `apps/web/src/features/todos/AssignedTodoCard.tsx`
- Modify: `apps/web/src/features/todos/AssignedTodoPage.tsx`

**Interfaces:**
- Consumes: `TodoSummary`、`organizationId`、`currentMembershipId`
- Produces: `AssignedTodoCard`。担当中なら既存`RequestTodoHandoffDialog`、依頼中なら既存pending表示を `TodoCard.action` に渡す。
- Today Pageと既存AssignedTodoPageが同じcomponentを使い、Handoff mutationを複製しない。

- [x] **Step 1: 既存挙動を守るtestを先に追加する**

Task 1のtestへ `isTodoWaitingOnRecipient(todo)` のassertを追加し、`todo-waiting` が `true`、`todo-owned` が `false` になる期待を先に書く。

```ts
import { composeTodayWorkspace, isTodoWaitingOnRecipient } from './today-workspace';

assert.equal(isTodoWaitingOnRecipient(waitingTodo), true);
assert.equal(isTodoWaitingOnRecipient(ownedTodo), false);
```

- [x] **Step 2: REDを確認する**

Run: `pnpm --filter @amidala/web test`

Expected: `isTodoWaitingOnRecipient is not a function` で失敗する。

- [x] **Step 3: helperを実装し、compositionから使う**

```ts
export function isTodoWaitingOnRecipient(todo: AssignedTodoWorkspace['todos'][number]) {
  return todo.pendingHandoff !== null;
}
```

`ownedTodos` のfilterを `!isTodoWaitingOnRecipient(todo)` に変更する。

- [x] **Step 4: private `AssignedCard` を専用ファイルへ移す**

`AssignedTodoPage.tsx` のprivate componentを削除し、`AssignedTodoCard` importへ置き換える。JSX、focus return、`RequestTodoHandoffDialog`、`pendingHandoff` 表示は挙動を変えず移動する。

- [x] **Step 5: testsとtype/buildを確認する**

Run: `pnpm --filter @amidala/web test && pnpm build`

Expected: Web tests pass、Turbo 3 tasks成功、TypeScript error 0。

- [x] **Step 6: commitする**

```bash
git add apps/web/src/features/today/today-workspace.ts apps/web/src/features/today/today-workspace.test.ts apps/web/src/features/todos/AssignedTodoCard.tsx apps/web/src/features/todos/AssignedTodoPage.tsx
git commit -m "refactor: share assigned Todo handoff card"
```

### Task 3: Today Pageとtyped routeを作る

**Files:**
- Create: `apps/web/src/features/today/TodayPage.tsx`
- Create: `apps/web/src/routes/$organizationId/today.tsx`
- Generated: `apps/web/src/routeTree.gen.ts`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Route loader: `Promise.all` で既存2 queryを `ensureQueryData`
- Route component: 同じ2 queryを `useSuspenseQuery` し `TodayPage`へ渡す
- TodayPage props: `organizationId`、`assignedResult`、`handoffResult`、`retry`
- Successful view: `composeTodayWorkspace`、`AssignedTodoCard`、`HandoffRequestCard`

- [x] **Step 1: route不在をREDとして確認する**

Run: `test ! -f 'apps/web/src/routes/$organizationId/today.tsx'`

Expected: exit 0。Today routeがまだ存在しないことを確認する。

- [x] **Step 2: route loaderとPage adapterを書く**

`apps/web/src/routes/$organizationId/today.tsx` は次の形にする。

```tsx
export const Route = createFileRoute('/$organizationId/today')({
  loader: ({ context, params }) => Promise.all([
    context.queryClient.ensureQueryData(assignedTodoWorkspaceQuery(params.organizationId)),
    context.queryClient.ensureQueryData(todoHandoffWorkspaceQuery(params.organizationId)),
  ]),
  pendingComponent: () => <section className="content"><div className="skeleton-block" /></section>,
  component: TodayRoute,
});
```

`TodayRoute` は2つの `useSuspenseQuery` 結果と `router.invalidate()` を `TodayPage`へ渡す。

- [x] **Step 3: TodayPageを3主区分とrecent補助区分で構成する**

- header: `Acme Studio / 今日のボール / 次に誰が動くかを、ここで揃えます。`
- incoming: `あなたへの依頼`、補助 `確認して、引き受けるか見送る`。先頭だけ `確認が必要` text label。
- own: `いま自分が持つボール`、補助 `あなたが次に進めるTodo`。`AssignedTodoCard` を使用。
- waiting: `相手の返答を待っている`、補助 `依頼した引き継ぎ`。`HandoffRequestCard kind="outgoing"` を使用。
- recent: itemsがある場合だけ `最近動いたボール`。`HandoffRequestCard kind="recent"` を使用。
- `aria-live="polite"` の共通announcementをPageに一つ置き、既存cardsの `onAnnounce` を接続する。
- 片方のresultが`ok`でない場合は内部messageを加工せず、固定見出し `今日のボールを読み込めませんでした`、既存error.message、再試行、組織再選択を表示する。
- 各empty stateは説明と導線を一つだけ持つ。

- [x] **Step 4: responsive CSSを書く**

`today-page`、`today-priority`、`today-grid`、`today-section`、`today-attention-label` を追加する。desktopはincoming full width、own/waiting 2列、recent full width。800px以下は1列。既存tokens、surface、line、radiusを使い、新gradient/animationは追加しない。

- [x] **Step 5: route tree生成とbuildを確認する**

Run: `pnpm --filter @amidala/web build`

Expected: `routeTree.gen.ts` に `/$organizationId/today` が生成され、build成功。

- [x] **Step 6: testsとdiff hygieneを確認する**

Run: `pnpm --filter @amidala/web test && git diff --check`

Expected: tests pass、whitespace error 0。

- [x] **Step 7: commitする**

```bash
git add apps/web/src/features/today/TodayPage.tsx 'apps/web/src/routes/$organizationId/today.tsx' apps/web/src/routeTree.gen.ts apps/web/src/styles.css
git commit -m "feat: add Today responsibility workspace"
```

### Task 4: Shell・Actor Switch・Handoff copyをTodayへ揃える

**Files:**
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/features/auth/DemoActorSwitcher.dev.tsx`
- Modify: `apps/web/src/features/handoffs/RequestTodoHandoffDialog.tsx`
- Modify: `apps/web/src/features/handoffs/HandoffRequestCard.tsx`

**Interfaces:**
- Navigation first item: `今日のボール` → `/$organizationId/today`
- Actor switch success target: `/$organizationId/today`
- Request field copy: `背景と期待（任意）`
- Accept announcement: `${handoff.recipient.name}さんが次の担当になりました。`

- [x] **Step 1: pure copy expectationを先にtestへ加える**

`today-workspace.ts` に `acceptedHandoffAnnouncement(recipientName: string)` を追加する前に、testへ次を加える。

```ts
assert.equal(acceptedHandoffAnnouncement('森 ハル'), '森 ハルさんが次の担当になりました。');
```

- [x] **Step 2: REDを確認する**

Run: `pnpm --filter @amidala/web test`

Expected: export不在でfail。

- [x] **Step 3: copy helperとconsumerを実装する**

`acceptedHandoffAnnouncement` を `today-workspace.ts` に実装し、`HandoffRequestCard` のaccept成功messageから使用する。reject/cancel copyは既存のまま。

- [x] **Step 4: typed navigationをTodayへ接続する**

`__root.tsx`:

- `CircleDot` iconでTodayを`links`先頭へ追加
- title判定に `/today$` を追加
- organization抽出regexを `people|todos|handoffs|today` にする
- `NavItem` にTodayのtyped `Link` branchを追加

`DemoActorSwitcher.dev.tsx`:

```ts
await navigate({ to: '/$organizationId/today', params: { organizationId }, replace: true });
```

- [x] **Step 5: Handoff field copyを揃える**

labelを `背景と期待（任意）`、placeholderを `背景と、次に期待することを伝えます` に変更する。DB/API field名 `requestMessage` は変更しない。

- [x] **Step 6: testsとproduction buildを確認する**

Run:

```bash
pnpm --filter @amidala/web test
pnpm build
! rg -n 'owner@amidala\.local|mori@amidala\.local|amidala-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist
git diff --check
```

Expected: tests/build pass、production artifact marker 0件、whitespace error 0。

- [x] **Step 7: commitする**

```bash
git add apps/web/src/features/today/today-workspace.ts apps/web/src/features/today/today-workspace.test.ts apps/web/src/routes/__root.tsx apps/web/src/features/auth/DemoActorSwitcher.dev.tsx apps/web/src/features/handoffs/RequestTodoHandoffDialog.tsx apps/web/src/features/handoffs/HandoffRequestCard.tsx
git commit -m "feat: make Today the demo starting point"
```

### Task 5: PR検証・レビュー・merge準備

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-today-workspace.md`（checkboxのみ）

**Interfaces:**
- Produces: review可能な `impl/today-workspace` branchとPR
- Base: merge時点の最新 `main`

- [x] **Step 1: full local checksを実行する**

```bash
pnpm --filter @amidala/api test
pnpm --filter @amidala/web test
pnpm build
pnpm --filter @amidala/api test:integration
pnpm --filter @amidala/api test:demo
git diff --check
git status --short --branch
```

- [x] **Step 2: independent reviewを依頼する**

Reviewerへ承認spec、plan、base SHA、head SHAを渡し、特に次を確認する。

- 新API/cache/useEffectがない
- actor/sessionを手動IDで混ぜていない
- incoming/own/waiting/recentの責任意味が正しい
- existing mutation invalidationでaccept後に2queryが更新される
- mobile 390pxでnavとcardsが横overflowしない
- production artifactにDemo passwordがない

- [x] **Step 3: Critical/Importantを修正して再検証する**

MinorはUX価値を損なわないものだけ移管Docsへdeferする。

- [x] **Step 4: branchをpushし、小PRを作る**

PR title: `feat: add Today responsibility workspace`

PR bodyに、既存read model composition、3分journey、test/build結果、Cloudflare未deployを記載する。

- [x] **Step 5: GitHub checksとreview後にmergeする**

merge commit方式でmainへ統合し、main上でWeb/API tests、build、artifact scanを再実行する。成功後にToday worktree、local/remote branchを撤去する。

実測: PR #7をmerge commit `18366d9`で`main`へ統合。API 13/13、Web 12/12、build 3/3、production artifact marker 0件をfresh確認し、Today worktreeとlocal/remote branchを撤去した。最終browser自動操作はCodex内browserのURL policyで実施できず、同じWeb/API WorkerとPostgreSQLを通るServer Function runtime journeyを `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/research/2026-07-28-today-runtime-verification.md` に記録した。

## Self-review record

- Spec coverage: 成功条件1〜7はTasks 1〜4、reload/desktop/mobile/consoleは最終browser journey、tests/buildはTask 5で検証する。
- Placeholder scan: 実装未確定のplaceholderなし。テストfixtureのIDと期待値を明示した。
- Type consistency: `TodayWorkspace` はcontractsの既存workspaceから型を導出し、route/Pageは既存result unionをそのまま受ける。
- Scope: Today composition、共有card抽出、shell/copy接続だけ。API/DB/deployは含めない。
