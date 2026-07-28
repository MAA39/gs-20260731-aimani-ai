# Handoff Next Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Handoff recipientがaccept時に任意の「次の一手」を保存し、責任移管後にrequester / recipient双方がTodayで確認できるようにする。

**Architecture:** `todo_handoff.next_action`をaccept transaction内で保存し、既存Handoff summaryへ投影する。Webは既存accept Server Functionのinputを拡張し、HandoffRequestCardのacceptだけを既存Base UI Dialog patternへ置き換える。

**Tech Stack:** TypeScript 7、PostgreSQL、Drizzle Kit / ORM、Hono、TanStack Start / Query、React 19、Base UI、Vitest / Node test

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-28-work-lifecycle-visibility-design.md` Slice 2。
- DB / contracts / TypeScriptは`nextAction`、UIは`次の一手`。
- `requestMessage`（依頼者の背景と期待）と`nextAction`（受領者の行動）を分離する。
- accept時だけtrim後1〜240文字を任意入力。空は`null`。
- acceptの責任移管と同じtransactionで保存する。
- idempotent accept再送は最初のnextActionを上書きしない。
- reject / cancelはnextActionを保存しない。
- deadline、SLA、comment、独立NextAction aggregateは追加しない。
- 新しい`useEffect`、新dependency、Cloudflare deployを追加しない。
- UIは既存HandoffCard / Dialog / field / button / Today sectionを踏襲する。

---

### Task 1: Next Action API behaviorをREDで固定する

**Files:**
- Modify: `apps/api/src/routes/todo-handoffs.integration.test.ts`

**Interfaces:**
- Produces test-only Handoff schema field: `nextAction: string | null`
- Updates helper: `decide(cookie, handoffId, action, organizationId?, body?)`
- Proves accept保存、transaction projection、idempotency、validation、reject/cancel non-write

- [ ] **Step 1: test schemaとdecision helperを先に拡張する**

test-local `handoffSchema`へ追加する。

```ts
nextAction: z.string().nullable(),
```

`decide`へbodyを追加し、accept時だけJSONを送れるようにする。

```ts
const decide = async (
  cookie: string,
  handoffId: string,
  action: 'accept' | 'reject' | 'cancel',
  organizationId = 'org_acme_studio',
  body?: { nextAction?: string },
) => {
  const response = await app.fetch(new Request(
    `http://localhost:8787/organizations/${organizationId}/handoffs/${handoffId}/${action}`,
    {
      method: 'POST',
      headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    },
  ), env);
  const parsed = response.status >= 400
    ? errorSchema.parse(await response.json())
    : resourceSchema.parse(await response.json());
  return response.status >= 400
    ? { status: response.status, error: parsed.error }
    : { status: response.status, handoff: parsed.handoff, todo: parsed.todo };
};
```

- [ ] **Step 2: accept保存とidempotencyのfailing testを書く**

```ts
it('stores the recipient next action with acceptance without overwriting it on retry', async () => {
  const ownerCookie = await signIn('owner@amidala.local');
  const moriCookie = await signIn('mori@amidala.local');
  const todo = await createTodo(ownerCookie);
  const requested = await requestHandoff(ownerCookie, todo.todoId, { recipientMembershipId: 'acme-studio-mori' });
  const handoffId = requested.handoff?.handoffId ?? '';

  const accepted = await decide(moriCookie, handoffId, 'accept', 'org_acme_studio', {
    nextAction: '  インタビュー仮説を3点にまとめる  ',
  });
  expect(accepted.status).toBe(200);
  expect(accepted.handoff?.nextAction).toBe('インタビュー仮説を3点にまとめる');
  expect(accepted.todo?.assignee.membershipId).toBe('acme-studio-mori');

  const retried = await decide(moriCookie, handoffId, 'accept', 'org_acme_studio', {
    nextAction: '後から上書きしない',
  });
  expect(retried.status).toBe(200);
  expect(retried.handoff?.nextAction).toBe('インタビュー仮説を3点にまとめる');
});
```

- [ ] **Step 3: empty / reject / cancel / validation testsを書く**

- accept bodyなしとblank `nextAction`は200 / null。
- reject/cancelはbodyを読まず、bodyが送られても既存どおりdecisionだけを行い`nextAction`はnullのままにする。
- 241文字のacceptは400で、Handoffはrequested、Todo assigneeはrequesterのまま。
- malformed JSON、`null`、array bodyのacceptは400で、HandoffとTodoは変化しない。
- non-recipient acceptは403でnextAction null。

reject/cancel routeはbodyを受け取らない既存契約を維持する。testは`content-type`付きbodyを送り、status 200とterminal responseの`nextAction === null`をassertして「無視する」契約を固定する。

- [ ] **Step 4: REDを確認する**

```bash
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff \
  pnpm --filter @amidala/api test:integration -- todo-handoffs.integration.test.ts --run
```

Expected: response schemaにnextActionがなく、accept保存testがfailする。既存Handoff behaviorの失敗ではないことを確認する。

- [ ] **Step 5: test-only commitを作る**

```bash
git add apps/api/src/routes/todo-handoffs.integration.test.ts
git commit -m "test: define Handoff next action behavior"
```

---

### Task 2: DB / contracts / accept transactionをGREENにする

**Files:**
- Modify: `packages/db/src/schema/todo-handoff.ts`
- Create: generated `packages/db/drizzle/0004_*.sql`
- Create/Modify: generated `packages/db/drizzle/meta/*`
- Modify: `packages/contracts/src/todo-handoff.ts`
- Modify: `apps/api/src/domain/todo-handoff.ts`
- Modify: `apps/api/src/application/accept-todo-handoff.ts`
- Modify: `apps/api/src/routes/todo-handoffs.ts`
- Modify: `apps/api/src/infrastructure/db/todo-handoff-repository.ts`

**Interfaces:**
- Produces DB column: `todo_handoff.next_action text null`
- Produces schema: `acceptTodoHandoffBodySchema`
- Extends `TodoHandoffSummary.nextAction`
- Extends `AcceptTodoHandoffCommand.nextAction`

- [ ] **Step 1: Drizzle schemaを変更してmigrationを生成する**

`todoHandoff` columnsへ追加する。

```ts
nextAction: text('next_action'),
```

table checksへ追加する。

```ts
check(
  'todo_handoff_next_action_check',
  sql`${t.nextAction} is null or char_length(${t.nextAction}) between 1 and 240`,
),
```

Run:

```bash
pnpm --filter @amidala/db exec drizzle-kit generate --name=handoff_next_action
```

生成SQLが`ADD COLUMN next_action text`とcheckだけを含み、既存table drop/recreateをしないことをinspectする。migration SQL / journal / snapshotを手書きで代替しない。

- [ ] **Step 2: contractsを拡張する**

`packages/contracts/src/todo-handoff.ts`:

```ts
export const acceptTodoHandoffBodySchema = z.object({
  nextAction: z.string().trim().min(1).max(240).optional(),
});
```

`todoHandoffSummarySchema`へ`nextAction: z.string().nullable()`を追加する。

- [ ] **Step 3: domain / application / route inputを拡張する**

`AcceptTodoHandoffCommand`へ`nextAction: string | null`を追加する。`AcceptTodoHandoff.execute` inputは`organizationId / handoffId / nextAction?`を受け、trim済みschema valueを`nextAction ?? null`としてcommandへ渡す。

accept routeだけpathとbodyをparseする。route moduleへ次のhelperを追加する。

```ts
async function optionalJsonObject(c: Context<ApiEnv>): Promise<unknown> {
  const text = await c.req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

const body = acceptTodoHandoffBodySchema.safeParse(await optionalJsonObject(c));
if (!path.success || !body.success) throw new ApiError('validation_error', 'Invalid Handoff acceptance.');
const outcome = await useCase.execute(userId, { ...path.data, ...body.data });
```

bodyなしacceptとの後方互換を維持し、malformed JSONは`undefined`としてschema validation errorにする。request bodyはこのhelperで1回だけ読む。

- [ ] **Step 4: repository projection / transactionを更新する**

`TodoHandoffRepositoryDrizzle.summary()`のreturnへ`nextAction: h.nextAction`を追加する。`getTodoHandoffWorkspace()`内の手組みprojectionにも`nextAction: r.h.nextAction`を追加する。request/accept/reject/cancel responseとworkspaceの全経路をこの2箇所で覆う。

`decide`のaccept updateだけに次を含める。

```ts
const handoffUpdate = verb === 'accepted'
  ? { status: verb, resolvedAt: c.now, nextAction: c.nextAction }
  : { status: verb, resolvedAt: c.now };
```

already accepted branchはDB既存値をprojectionするだけで、`c.nextAction`でupdateしない。

- [ ] **Step 5: migration適用とGREENを確認する**

implementation worktreeのignored `.dev.vars`がlocal demo DBだけを指すと確認してから:

```bash
pnpm db:migrate
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff \
  pnpm exec tsx -e \
  "import { migrateDatabase } from './packages/db/src/migrations.ts'; await migrateDatabase(process.env.TEST_DATABASE_URL!)"
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff \
  pnpm --filter @amidala/api test:integration -- todo-handoffs.integration.test.ts --run
```

2つ目のcommandでintegration DBへ同じgenerated migrationを適用する。Expected: new testsと既存tests pass。

- [ ] **Step 6: DB / API commitを作る**

```bash
git add packages/db/src/schema/todo-handoff.ts packages/db/drizzle packages/contracts/src/todo-handoff.ts apps/api/src/domain/todo-handoff.ts apps/api/src/application/accept-todo-handoff.ts apps/api/src/routes/todo-handoffs.ts apps/api/src/infrastructure/db/todo-handoff-repository.ts
git commit -m "feat: record Handoff next action"
```

---

### Task 3: Web contract / announcement / BFFをTDDで更新する

**Files:**
- Modify: `apps/web/src/features/handoffs/handoff-schema.ts`
- Modify: `apps/web/src/features/handoffs/handoffs.server.ts`
- Modify: `apps/web/src/features/handoffs/handoffs.functions.ts`
- Modify: `apps/web/src/features/today/today-workspace.ts`
- Modify: `apps/web/src/features/today/today-workspace.test.ts`

**Interfaces:**
- Produces: `AcceptTodoHandoffInput.nextAction?`
- Produces: `acceptedHandoffAnnouncement(recipientName, nextAction)`
- Preserves reject/cancel input types

- [ ] **Step 1: announcement RED testを書く**

```ts
test('引き継ぎ受け入れの案内へ次の一手を含める', () => {
  assert.equal(
    acceptedHandoffAnnouncement('森 ハル', 'インタビュー仮説を3点にまとめる'),
    '森 ハルさんへ責任が移りました。次の一手: インタビュー仮説を3点にまとめる',
  );
  assert.equal(
    acceptedHandoffAnnouncement('森 ハル', null),
    '森 ハルさんへ責任が移りました。',
  );
});
```

Run `pnpm --filter @amidala/web test`。Expected: function signature / copy mismatchでfail。

- [ ] **Step 2: pure announcementをGREENにする**

```ts
export function acceptedHandoffAnnouncement(recipientName: string, nextAction: string | null) {
  const moved = `${recipientName}さんへ責任が移りました。`;
  return nextAction ? `${moved}次の一手: ${nextAction}` : moved;
}
```

- [ ] **Step 3: input schema / Server Functionを拡張する**

`acceptTodoHandoffInputSchema = todoHandoffPathSchema.and(acceptTodoHandoffBodySchema)`とし、reject/cancelはpath schemaのまま維持する。

`handoffs.server.ts`はCompletion PRで追加した`createApiFetcher` / `readApiBody`を`features/server/api-fetcher.server.ts`からimportし、local `fetcher` / `bodyOf`を削除する。そのうえで`call`はverbごとにbodyを決める。

- accept: `{ nextAction }`をJSON送信。undefinedなら`{}`。
- reject/cancel: bodyなし。
- request: 既存request body。

API responseは拡張済み`todoHandoffResponseSchema`でparseする。

- [ ] **Step 4: Web tests / typecheckを実行する**

```bash
pnpm --filter @amidala/web test
pnpm --filter @amidala/web exec tsc --noEmit
```

- [ ] **Step 5: BFF commitを作る**

```bash
git add apps/web/src/features/handoffs/handoff-schema.ts apps/web/src/features/handoffs/handoffs.server.ts apps/web/src/features/handoffs/handoffs.functions.ts apps/web/src/features/today/today-workspace.ts apps/web/src/features/today/today-workspace.test.ts
git commit -m "feat: carry next action through Handoff BFF"
```

---

### Task 4: 既存Handoff cardへAccept Dialogを接続する

**Files:**
- Create: `apps/web/src/features/handoffs/AcceptTodoHandoffDialog.tsx`
- Modify: `apps/web/src/features/handoffs/HandoffRequestCard.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `acceptTodoHandoff`
- Produces: `AcceptTodoHandoffDialog`
- Calls parent: `onAccepted(result)`

- [ ] **Step 1: Accept Dialogを実装する**

既存Base UI Dialog classesを使い、propsを次に固定する。

```ts
type Props = {
  handoff: TodoHandoffSummary;
  disabled: boolean;
  onAccepted: (result: TodoHandoffMutationResult) => Promise<void>;
  onFailure: (message: string) => void;
};
```

form field:

```tsx
<label className="form-field">
  次の一手（任意）
  <textarea name="nextAction" maxLength={240} rows={3} placeholder="次に何をするかを短く書きます" />
</label>
```

submit時にtrimし、空ならinputから省く。mutation resultがokの時だけdialogを閉じる。conflict/errorは既存fixed messageをdialog内に表示する。

- [ ] **Step 2: HandoffRequestCardのaccept branchだけ置換する**

`decide`はreject/cancelに残す。incoming requestedのprimary actionを`AcceptTodoHandoffDialog`へ置き換える。accept成功handlerは既存3 query invalidationをawaitし、次をannounceする。

```ts
acceptedHandoffAnnouncement(result.handoff.recipient.name, result.handoff.nextAction)
```

recent Handoff cardの`requestMessage`直後に、`handoff.nextAction`がある時だけ次を表示する。

```tsx
<p className="handoff-next-action"><strong>次の一手</strong>{handoff.nextAction}</p>
```

- [ ] **Step 3: existing styleを再利用する**

Dialogは`.dialog-*` / `.handoff-form` / `.form-field` / `.dialog-actions`を再利用する。`.handoff-next-action`だけをexisting `brand-soft` surface、padding、radius tokenで追加する。新色を作らない。

- [ ] **Step 4: tests / build / marker scanを実行する**

```bash
pnpm --filter @amidala/web test
pnpm build
! rg -n 'owner@amidala\.local|mori@amidala\.local|amidala-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist
git diff --check
```

- [ ] **Step 5: UI commitを作る**

```bash
git add apps/web/src/features/handoffs/AcceptTodoHandoffDialog.tsx apps/web/src/features/handoffs/HandoffRequestCard.tsx apps/web/src/styles.css
git commit -m "feat: declare next action when accepting Handoff"
```

---

### Task 5: runtime、review、small PR、mergeを完了する

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-handoff-next-action.md`
- Modify: `docs/HANDOFF-CLAUDE-2026-07-28.md`

**Interfaces:**
- Produces: reviewed Handoff Next Action PR
- Base: Todo Completion merge後のlatest `main`

- [x] **Step 1: full verificationを実行する**

```bash
pnpm --filter @amidala/api test
pnpm --filter @amidala/web test
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff pnpm --filter @amidala/api test:integration --run
pnpm --filter @amidala/api test:demo --run
pnpm build
! rg -n 'owner@amidala\.local|mori@amidala\.local|amidala-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist
git diff --check
```

実測（2026-07-28、worktree `handoff-next-action`、HEAD `ff48046`）:

- API unit: 13/13 PASS（約1.1s）
- Web test: 14/14 PASS（約0.64s）
- PostgreSQL integration（`127.0.0.1:54329/amidala_handoff`）: 18/18 PASS（約4.55s）
- demo seed（`127.0.0.1:54329/amidala_demo`、reset後）: 1/1 PASS（約0.67s）
- `pnpm build`: 3/3 package tasks PASS（約10.1s）
- production artifact marker scan（`apps/web/dist`）: 0 matches
- `git diff --check`: PASS

demo seedはブラウザjourney後のDB状態で一度不一致となったため、`pnpm db:demo:reset`（`amidala_demo`のみ）後に再実行してPASSを確認した。

- [x] **Step 2: local runtime journeyを実行する**

demo reset後、田中→森へHandoff、森が`インタビュー仮説を3点にまとめる`を入力してacceptする。

- 森Todayの自分のボールへTodoが移る
- 田中Todayのrecentに森と次の一手が表示される
- Handoff recentにも同じnextActionが表示される
- 空nextAction acceptも従来どおり成功する
- direct reload、desktop 1280x720、mobile 390x844、console 0を確認する

browser実測はcontrollerの`task-5-browser-results.md`を正とする。田中→森のaccept（次の一手入力）、森/田中TodayとHandoff recentへの投影、direct reload保持、desktop 1280x720 / mobile 390x844のoverflowなし、console warning/error 0を確認済み。空nextActionはPostgreSQL integration suiteで確認済み。

- [x] **Step 3: independent reviewを依頼する**

transaction atomicity、idempotent retry non-overwrite、nullable migration、240文字validation、requestMessageとの混同、raw error leak、Dialog focus/mobileをreview対象にする。

実測: base `7244f7f` / head `fa031c6`の独立reviewはCritical / Important 0件でAPPROVED。transaction/lock順序、retry非上書き、全projection、BFF固定error、Dialog/actor switch/useEffectなしを確認した。

- [x] **Step 4: Critical/ImportantをTDDで修正し再検証する**

runtimeでActor Switch直後に旧principalのquery projectionが残る問題を検出し、typed Today URLへのhard replaceでclient stateを再生成する`ff48046`を追加。実ブラウザで再読込なしの切替を再確認し、scoped reviewもAPPROVED。既知Minorはaccept routeが認証前にbody validationする既存順序で、未認証＋不正bodyが400になり得る点。raw data leakや通常UX影響がないため本sliceでは変更しない。

- [x] **Step 5: small PRを作る**

PR title: `feat: record Handoff next action`

実測: `feat/handoff-next-action`をpushし、small PR [#11](https://github.com/MAA39/amidala-v2/pull/11) `feat: record Handoff next action`を作成。Cloudflare deployは未実施。

- [x] **Step 6: GitHub checks後にmerge commit方式でmergeする**

root mainでfresh verification後、next-action worktree、local/remote branchを削除する。

実測: PR [#11](https://github.com/MAA39/amidala-v2/pull/11)はmerge commit `ee9b567`で`main`へ統合済み。merge後rootでAPI 13/13、Web 14/14、build 3/3、artifact marker 0をfresh確認し、worktreeとlocal/remote branchを削除した。Cloudflare deployは行っていない。
