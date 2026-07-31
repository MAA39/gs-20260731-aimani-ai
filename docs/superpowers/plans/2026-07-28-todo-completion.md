# Todo Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現在担当者がopen Todoを安全に完了し、Today / Assignedから消え、shared workspaceへcompletedとして残る縦切りを追加する。

**Architecture:** 既存Todo aggregateへ`CompleteTodo` use caseとrepository transactionを追加し、Hono action endpointをthin TanStack Start Server Functionから呼ぶ。UIは既存`AssignedTodoCard`のaction slotとBase UI Dialogを再利用し、Query invalidationで既存read modelを更新する。

**Tech Stack:** TypeScript 7、Hono 4、Drizzle ORM 0.45、PostgreSQL、TanStack Start / Query、React 19、Base UI、Vitest / Node test

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-28-work-lifecycle-visibility-design.md` Slice 1。
- Todoの語彙は`open | completed`、operationは`CompleteTodo`に統一する。
- 完了権限はcurrent assignee Membershipだけ。creator / Organization roleでは代用しない。
- requested Handoff中は409 `handoff_pending`。Handoffを暗黙にcancelしない。
- 二重送信はcurrent assigneeに限り200で既存completed Todoを返す。
- DB migration、reopen、deadline、completion eventは追加しない。
- Router依存は`routes`、domain能力とBFFは`features/todos`へ置く。
- 新しい`useEffect`、新dependency、Cloudflare deployを追加しない。
- UIは既存TodoCard / Dialog / button / field / spacingを踏襲し、mock由来のvisual languageを持ち込まない。

---

### Task 1: API completion contractをREDで固定する

**Files:**
- Modify: `packages/contracts/src/todo.ts`
- Modify: `apps/api/src/routes/todo-handoffs.integration.test.ts`

**Interfaces:**
- Produces: `completeTodoPathSchema`、`completeTodoResponseSchema`
- Produces test helper: `completeTodo(cookie, todoId, organizationId?)`
- Consumes: existing `todoSummarySchema`、local integration PostgreSQL

- [ ] **Step 1: 完了path / response schemaをcontractsへ宣言する**

`packages/contracts/src/todo.ts`へ追加する。

```ts
export const completeTodoPathSchema = z.object({
  organizationId: z.string().min(1),
  todoId: z.string().min(1),
});
export const completeTodoResponseSchema = z.object({ todo: todoSummarySchema });
```

これはproduction behaviorを実装せず、次のintegration testがtyped responseを読むためのboundaryだけを作る。

- [ ] **Step 2: integration helperと失敗するbehavior testsをすべて先に書く**

`apps/api/src/routes/todo-handoffs.integration.test.ts`のhelper群へ追加する。

```ts
const completeTodo = async (
  cookie: string,
  todoId: string,
  organizationId = 'org_acme_studio',
) => {
  const response = await app.fetch(new Request(
    `http://localhost:8787/organizations/${organizationId}/todos/${todoId}/complete`,
    { method: 'POST', headers: { cookie } },
  ), env);
  const body = await response.json();
  return { status: response.status, body };
};
```

最初のtest:

```ts
it('lets only the current assignee complete an open Todo and removes it from assigned work', async () => {
  const ownerCookie = await signIn('owner@aimani-ai.local');
  const todo = await createTodo(ownerCookie);

  const completed = await completeTodo(ownerCookie, todo.todoId);
  expect(completed.status).toBe(200);
  expect(completeTodoResponseSchema.parse(completed.body).todo).toMatchObject({
    todoId: todo.todoId,
    status: 'completed',
    assignee: { membershipId: 'acme-studio-owner' },
  });

  expect((await getAssignedTodos(ownerCookie)).todos.map((item) => item.todoId)).not.toContain(todo.todoId);
  expect((await getSharedTodos(ownerCookie)).todos.find((item) => item.todoId === todo.todoId)?.status).toBe('completed');
});
```

同じRED commitで、実装前に次の責任境界も固定する。

```ts
it('keeps Todo completion idempotent for the assignee and forbidden for another Member', async () => {
  const ownerCookie = await signIn('owner@aimani-ai.local');
  const moriCookie = await signIn('mori@aimani-ai.local');
  const todo = await createTodo(ownerCookie);

  expect((await completeTodo(moriCookie, todo.todoId)).status).toBe(403);
  expect((await completeTodo(ownerCookie, todo.todoId)).status).toBe(200);
  const repeated = await completeTodo(ownerCookie, todo.todoId);
  expect(repeated.status).toBe(200);
  expect(completeTodoResponseSchema.parse(repeated.body).todo.status).toBe('completed');
});

it('does not complete a Todo while its Handoff is waiting for a decision', async () => {
  const ownerCookie = await signIn('owner@aimani-ai.local');
  const todo = await createTodo(ownerCookie);
  const requested = await requestHandoff(ownerCookie, todo.todoId, { recipientMembershipId: 'acme-studio-mori' });

  const result = await completeTodo(ownerCookie, todo.todoId);
  expect(result.status).toBe(409);
  expect(errorSchema.parse(result.body).error.message).toBe('handoff_pending');
  expect((await getAssignedTodos(ownerCookie)).todos.find((item) => item.todoId === todo.todoId)?.pendingHandoff?.handoffId)
    .toBe(requested.handoff?.handoffId);
});

it('does not disclose a Todo through another Organization path', async () => {
  const ownerCookie = await signIn('owner@aimani-ai.local');
  const northstarCookie = await signIn('suzuki@aimani-ai.local');
  const todo = await createTodo(ownerCookie);

  expect((await completeTodo(northstarCookie, todo.todoId, 'org_northstar_lab')).status).toBe(404);
  expect((await completeTodo(northstarCookie, todo.todoId, 'org_acme_studio')).status).toBe(403);
});
```

- [ ] **Step 3: REDを確認する**

Run:

```bash
TEST_DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani_ai_handoff \
  pnpm --filter @aimani-ai/api test:integration -- todo-handoffs.integration.test.ts --run
```

Expected: 新endpointが存在せず、各new testが404または期待bodyのparse errorでfailする。他の既存test errorではないことを確認する。

- [ ] **Step 4: test/contractだけをcommitする**

```bash
git add packages/contracts/src/todo.ts apps/api/src/routes/todo-handoffs.integration.test.ts
git commit -m "test: define Todo completion behavior"
```

---

### Task 2: CompleteTodo domain / application / repositoryをGREENにする

**Files:**
- Modify: `apps/api/src/domain/todo.ts`
- Create: `apps/api/src/application/complete-todo.ts`
- Modify: `apps/api/src/infrastructure/db/todo-repository.ts`
- Modify: `apps/api/src/composition/request-scope.ts`
- Modify: `apps/api/src/routes/todos.ts`

**Interfaces:**
- Consumes: `completeTodoPathSchema`
- Produces: `CompleteTodoCommand`
- Produces: `CompleteTodoOutcome`
- Produces: `TodoRepository.completeTodo(command)`
- Produces: `CompleteTodo.execute(userId, input)`
- Produces: `POST /organizations/:organizationId/todos/:todoId/complete`

- [ ] **Step 1: domain command / outcome / portを定義する**

`apps/api/src/domain/todo.ts`へ追加する。

```ts
export interface CompleteTodoCommand {
  organizationId: string;
  todoId: string;
  assigneeMembershipId: string;
  now: Date;
}

export type CompleteTodoOutcome =
  | { kind: 'completed' | 'already_completed'; todo: TodoSummary }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; reason: 'handoff_pending' };
```

`TodoRepository`へ追加する。

```ts
completeTodo(command: CompleteTodoCommand): Promise<CompleteTodoOutcome>;
```

- [ ] **Step 2: application use caseを実装する**

`apps/api/src/application/complete-todo.ts`を作る。

```ts
import { ApiError } from '../errors/api-error';
import type { Clock } from './health-check';
import type { TodoRepository } from '../domain/todo';

export class CompleteTodo {
  constructor(private readonly repository: TodoRepository, private readonly clock: Clock) {}

  async execute(userId: string, input: { organizationId: string; todoId: string }) {
    const membership = await this.repository.findActiveMembershipForUser(userId, input.organizationId);
    if (!membership) throw new ApiError('forbidden', 'This organization is not available to this user.');
    const outcome = await this.repository.completeTodo({
      ...input,
      assigneeMembershipId: membership.membershipId,
      now: this.clock.now(),
    });
    if (outcome.kind === 'not_found') throw new ApiError('not_found', 'Todo not found.');
    if (outcome.kind === 'forbidden') throw new ApiError('forbidden', 'Only the current assignee can complete this Todo.');
    if (outcome.kind === 'conflict') throw new ApiError('conflict', outcome.reason);
    return outcome;
  }
}
```

- [ ] **Step 3: repository transactionを実装する**

`apps/api/src/infrastructure/db/todo-repository.ts`へ`todoHandoff`と`sql` importを追加し、次を実装する。

```ts
async completeTodo(command: CompleteTodoCommand): Promise<CompleteTodoOutcome> {
  return this.database.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level read committed`);
    const [row] = await tx.select().from(todo)
      .where(and(eq(todo.id, command.todoId), eq(todo.organizationId, command.organizationId)))
      .for('update').limit(1);
    if (!row) return { kind: 'not_found' } as const;
    if (row.assigneeMembershipId !== command.assigneeMembershipId) return { kind: 'forbidden' } as const;
    if (row.status === 'completed') {
      return { kind: 'already_completed' as const, todo: await this.loadTodoSummary(tx as Db, row) };
    }
    const [pending] = await tx.select({ id: todoHandoff.id }).from(todoHandoff)
      .where(and(
        eq(todoHandoff.organizationId, command.organizationId),
        eq(todoHandoff.todoId, command.todoId),
        eq(todoHandoff.status, 'requested'),
      )).for('update').limit(1);
    if (pending) return { kind: 'conflict' as const, reason: 'handoff_pending' as const };
    const [completed] = await tx.update(todo)
      .set({ status: 'completed', updatedAt: command.now })
      .where(and(eq(todo.id, row.id), eq(todo.organizationId, command.organizationId), eq(todo.status, 'open')))
      .returning();
    if (!completed) throw new Error('Todo completion lost its locked row.');
    return { kind: 'completed' as const, todo: await this.loadTodoSummary(tx as Db, completed) };
  });
}
```

`type Db = AimaniAiDatabase`をrepository moduleへ追加する。`createSharedTodo`に埋め込まれたcreator / assignee / pending Handoffのjoin projectionを、次のprivate helperへ抽出する。

```ts
private async loadTodoSummary(
  database: Db,
  row: typeof todo.$inferSelect,
): Promise<TodoSummary> {
  const creator = alias(membership, 'todo_summary_creator');
  const assignee = alias(membership, 'todo_summary_assignee');
  const requester = alias(membership, 'todo_summary_handoff_requester');
  const recipient = alias(membership, 'todo_summary_handoff_recipient');
  const [projection] = await database
    .select({
      creatorName: creator.displayName,
      creatorTitle: creator.title,
      assigneeName: assignee.displayName,
      assigneeTitle: assignee.title,
      handoffId: todoHandoff.id,
      handoffRequesterId: todoHandoff.requesterMembershipId,
      handoffRequesterName: requester.displayName,
      handoffRequesterTitle: requester.title,
      handoffRecipientId: todoHandoff.recipientMembershipId,
      handoffRecipientName: recipient.displayName,
      handoffRecipientTitle: recipient.title,
      handoffMessage: todoHandoff.requestMessage,
      handoffRequestedAt: todoHandoff.requestedAt,
    })
    .from(todo)
    .leftJoin(creator, and(eq(creator.id, row.creatorMembershipId), eq(creator.organizationId, row.organizationId)))
    .leftJoin(assignee, and(eq(assignee.id, row.assigneeMembershipId), eq(assignee.organizationId, row.organizationId)))
    .leftJoin(todoHandoff, and(eq(todoHandoff.todoId, row.id), eq(todoHandoff.organizationId, row.organizationId), eq(todoHandoff.status, 'requested')))
    .leftJoin(requester, and(eq(requester.id, todoHandoff.requesterMembershipId), eq(requester.organizationId, row.organizationId)))
    .leftJoin(recipient, and(eq(recipient.id, todoHandoff.recipientMembershipId), eq(recipient.organizationId, row.organizationId)))
    .where(and(eq(todo.id, row.id), eq(todo.organizationId, row.organizationId)))
    .limit(1);
  return this.toTodoSummary(row, projection);
}
```

`createSharedTodo` / completed retry / completed updateは必ず`loadTodoSummary`を通し、外部interfaceと既存projectionを変えない。

- [ ] **Step 4: DIとHono routeを接続する**

`RequestCradle`へ`completeTodo: Promise<CompleteTodo>`を追加し、registerへ次を足す。

```ts
completeTodo: asFunction(async ({ todoRepository, clock }) =>
  new CompleteTodo(await todoRepository, clock),
).scoped(),
```

`apps/api/src/routes/todos.ts`へ`Context`、`completeTodoPathSchema`、`CompleteTodo`をimportする。同file内に次のprivate helperを追加し、create/read/completeで使う。`todo-handoffs.ts`の同名helperは別route module内privateなので変更しない。

```ts
async function currentUserId(context: Context<ApiEnv>): Promise<string> {
  const auth = await context.get('scope').resolve('auth');
  const session = await auth.api.getSession({ headers: context.req.raw.headers });
  if (!session?.user) throw new ApiError('unauthorized', 'Authentication required');
  return session.user.id;
}
```

endpointを既存`createTodoRoutes()` chainへ追加する。

```ts
.post('/organizations/:organizationId/todos/:todoId/complete', async (context) => {
  const path = completeTodoPathSchema.safeParse(context.req.param());
  if (!path.success) throw new ApiError('validation_error', 'Invalid Todo path.');
  const useCase = await context.get('scope').resolve<CompleteTodo>('completeTodo');
  const outcome = await useCase.execute(await currentUserId(context), path.data);
  return context.json({ todo: outcome.todo });
})
```

- [ ] **Step 5: GREENを確認する**

```bash
TEST_DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani_ai_handoff \
  pnpm --filter @aimani-ai/api test:integration -- todo-handoffs.integration.test.ts --run
```

Expected: happy-path、assignee authority、idempotency、pending conflict、Organization non-disclosureと既存testsがすべてpassする。

- [ ] **Step 6: API implementationをcommitする**

```bash
git add apps/api/src/domain/todo.ts apps/api/src/application/complete-todo.ts apps/api/src/infrastructure/db/todo-repository.ts apps/api/src/composition/request-scope.ts apps/api/src/routes/todos.ts
git commit -m "feat: complete assigned Todo"
```

---

### Task 3: Web BFFとfixed Japanese errorをTDDで追加する

**Files:**
- Create: `apps/web/src/features/server/api-fetcher.server.ts`
- Modify: `apps/web/src/features/todos/todo-schema.ts`
- Modify: `apps/web/src/features/todos/todo-error-presentation.ts`
- Modify: `apps/web/src/features/todos/todo-error-presentation.test.ts`
- Modify: `apps/web/src/features/todos/todos.server.ts`
- Modify: `apps/web/src/features/todos/todos.functions.ts`

**Interfaces:**
- Produces: `completeTodoInputSchema`
- Produces: `CompleteTodoResult`
- Produces: `completeTodoFromApi(input)`
- Produces: `completeTodo` Server Function

- [ ] **Step 1: error mapperのfailing testsを書く**

`TodoOperationContext`へ`complete`を追加する前にtestへ次を足す。

```ts
assert.equal(todoFailureMessage('complete', 403), '現在の担当者だけがこのTodoを完了できます。');
assert.equal(todoFailureMessage('complete', 409, 'handoff_pending'), '引き継ぎの確認待ちです。依頼を取り消すか、相手の返答後に完了してください。');
assert.equal(todoFailureMessage('complete', 503), 'Todoを完了できませんでした。時間をおいて、もう一度お試しください。');
```

signatureを`todoFailureMessage(context, status, reason?)`へ変えるtestなので、compileまたはassertionがfailすることを確認する。

- [ ] **Step 2: error mapperをGREENにする**

`TodoOperationContext`へ`complete`を追加し、次のcopyを固定する。

```ts
if (context === 'complete' && status === 403) return '現在の担当者だけがこのTodoを完了できます。';
if (context === 'complete' && status === 409 && reason === 'handoff_pending') {
  return '引き継ぎの確認待ちです。依頼を取り消すか、相手の返答後に完了してください。';
}
if (context === 'complete' && status === 404) return 'このTodoは見つかりませんでした。';
if (context === 'complete' && status === 400) return 'Todoを完了する入力を確認してください。';
if (context === 'complete') return 'Todoを完了できませんでした。時間をおいて、もう一度お試しください。';
```

`reason`はknown `handoff_pending`だけを識別し、unknown/raw messageは画面へ返さない。

- [ ] **Step 3: schema / BFF / Server Functionを実装する**

既存`todos.server.ts`のprivate fetch/body helperを共通server-only moduleへ移し、既存Todo adapterと新adapterの両方から使う。

```ts
// apps/web/src/features/server/api-fetcher.server.ts
import '@tanstack/react-start/server-only';
import { env } from 'cloudflare:workers';

export function createApiFetcher(cookie: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookie) headers.set('cookie', cookie);
    return env.API.fetch(new Request(input, { ...init, headers }));
  };
}

export async function readApiBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
```

`todos.server.ts`の既存`createApiFetcher` / `readBody`定義を削除し、このmoduleからimportする。既存3 operationsの挙動を変えない。

`todo-schema.ts`:

```ts
export const completeTodoInputSchema = completeTodoPathSchema;
export type CompleteTodoInput = z.infer<typeof completeTodoInputSchema>;
export type CompleteTodoResult =
  | { status: 'ok'; todo: TodoSummary }
  | { status: 'forbidden' | 'not_found' | 'conflict'; error: { code: string; message: string } }
  | { status: 'error'; error: { code: 'validation_error' | 'service_unavailable'; message: string } };
```

`todos.server.ts`へ`completeTodoFromApi`を追加し、`createApiFetcher(cookie)`でprivate endpointをPOSTする。`readApiBody`でbodyを1回読み、401 redirect、403/404/409/400/fallbackをfixed copyへ変換し、200 bodyを`completeTodoResponseSchema`でparseする。

`todos.functions.ts`:

```ts
export const completeTodo = createServerFn({ method: 'POST' })
  .validator(completeTodoInputSchema)
  .handler(({ data }) => completeTodoFromApi(data));
```

- [ ] **Step 4: Web testsとbuildを確認する**

```bash
pnpm --filter @aimani-ai/web test
pnpm --filter @aimani-ai/web exec tsc --noEmit
```

Expected: error tests pass、TypeScript pass。

- [ ] **Step 5: BFFをcommitする**

```bash
git add apps/web/src/features/server/api-fetcher.server.ts apps/web/src/features/todos/todo-schema.ts apps/web/src/features/todos/todo-error-presentation.ts apps/web/src/features/todos/todo-error-presentation.test.ts apps/web/src/features/todos/todos.server.ts apps/web/src/features/todos/todos.functions.ts
git commit -m "feat: connect Todo completion BFF"
```

---

### Task 4: 既存cardへCompletion Dialogを接続する

**Files:**
- Create: `apps/web/src/features/todos/CompleteTodoDialog.tsx`
- Modify: `apps/web/src/features/todos/AssignedTodoCard.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `completeTodo`
- Consumes query keys: `assignedTodoWorkspaceKey`、`todoHandoffWorkspaceKey`、`sharedTodoWorkspaceOrganizationPrefix`
- Produces: `CompleteTodoDialog`

- [ ] **Step 1: Dialog componentを実装する**

Base UI `Dialog`を既存`RequestTodoHandoffDialog`と同じPortal / Backdrop / Viewport / Popup classesで使う。props:

```ts
type Props = {
  organizationId: string;
  todo: TodoSummary;
  onCompleted: (message: string) => void;
};
```

triggerは`quiet-button`の`完了にする`。titleは`このTodoを完了しますか？`、descriptionはTodo title、actionsは`戻る`と`完了にする`。

mutation成功時は3 query keyを`Promise.all`でinvalidateし、完了後にdialogを閉じて`onCompleted('Todoを完了しました。')`を呼ぶ。409/403/transport errorはBFFの固定copyをdialog内`role="alert"`へ表示する。

- [ ] **Step 2: AssignedTodoCardのactionを統合する**

pending Handoffがある場合は現行pending表示だけ。ない場合は同じaction areaに次を置く。

```tsx
<RequestTodoHandoffDialog ... />
<CompleteTodoDialog organizationId={organizationId} todo={todo} onCompleted={...} />
```

`currentMembershipId`と`todo.assignee.membershipId`が一致する時だけaction areaをTodoCardへ渡す既存条件を維持する。

- [ ] **Step 3: 最小styleを追加する**

既存`.dialog-*`、`.dialog-actions`、`.todo-handoff-action`を再利用する。新規styleはcompletion resultのspacingが既存classで表せない場合だけ`.todo-completion-result`を1 rule追加する。色・radius・shadow tokenを増やさない。

- [ ] **Step 4: Web tests / buildを実行する**

```bash
pnpm --filter @aimani-ai/web test
pnpm build
! rg -n 'owner@aimani-ai\.local|mori@aimani-ai\.local|aimani-ai-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist
git diff --check
```

Expected: tests/build pass、marker 0、diff check pass。

- [ ] **Step 5: UIをcommitする**

```bash
git add apps/web/src/features/todos/CompleteTodoDialog.tsx apps/web/src/features/todos/AssignedTodoCard.tsx apps/web/src/styles.css
git commit -m "feat: complete Todo from assigned work"
```

---

### Task 5: runtime、review、small PR、mergeを完了する

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-todo-completion.md`（checkbox / 実測のみ）
- Modify: `docs/HANDOFF-CLAUDE-2026-07-28.md`（実装結果のみ）

**Interfaces:**
- Produces: reviewed Todo Completion PR
- Base: merge時点の最新`main`

- [x] **Step 1: full local checksを実行する**

```bash
pnpm --filter @aimani-ai/api test
pnpm --filter @aimani-ai/web test
TEST_DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani_ai_handoff pnpm --filter @aimani-ai/api test:integration --run
pnpm --filter @aimani-ai/api test:demo --run
pnpm build
! rg -n 'owner@aimani-ai\.local|mori@aimani-ai\.local|aimani-ai-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist
git diff --check
```

実測（2026-07-28、todo-completion worktree / bd47a9c）: API 13/13 PASS、Web 14/14 PASS、PostgreSQL integration 10/10 PASS、demo seed 1/1 PASS、`pnpm build` 3/3 PASS、production artifact scan 0 matches、`git diff --check` PASS。demo checkはブラウザ確認でpending Handoffが残ったため、`pnpm db:demo:reset`後に`TEST_DATABASE_URL`をローカル`aimani_ai_demo`へ設定してfresh実行した。canonical completion schemaへ一本化した最終commit後にもcontrollerが全コマンドをfresh再実行した。

- [x] **Step 2: demo runtime journeyを実行する**

`pnpm db:demo:reset`後、田中でTodayを開き、確認Dialogからdemo Todoを完了する。次を確認する。

- Today / Assigned Todoから消える
- 田中と森のshared Todo workspaceでは`完了`表示が残る
- direct reload後も同じ
- pending Handoffを作った別Todoでは完了buttonが表示されない
- desktop 1280x720 / mobile 390x844でdialogがviewport内
- browser console error / hydration warning 0

実測（controller実測、2026-07-28）: desktop 1280x720 / mobile 390x844とも横overflowなし。完了確認Dialogはviewport内（mobile rect left 32 / right 343 / top 324.6 / bottom 519.4）、cancel後に完了triggerへfocus復帰。田中のTodayからTodoが消え、live-region「Todoを完了しました。」を表示。森のshared workspaceでは「完了」として残り、完了TodoにHandoff依頼actionは表示されない。pending Handoff作成後は完了actionが非表示で、direct reload後も維持。browser console error / warning 0。

- [x] **Step 3: independent reviewを依頼する**

base/head SHA、design、planを渡し、assignee authority、row lock、pending Handoff conflict、idempotency、raw error leak、query invalidation、existing UI踏襲をCritical/Important対象としてreviewする。

実測: 独立reviewはCritical / Important 0件でAPPROVED。assignee authority、row lock順序、pending Handoffの409、冪等完了、固定error copy、3系統のquery invalidation、既存Dialog/Card踏襲、新規`useEffect`なし、focus復帰とlive regionを確認した。

- [x] **Step 4: Critical/ImportantをTDDで修正して再検証する**

MinorはUX価値を損なわないものだけhandoff Docsへ記録する。

Critical / Importantの修正対象はなし。MinorだったWeb側completion input schemaの重複は`completeTodoPathSchema`のaliasへ一本化し、scoped再review APPROVED、Web 14/14、TypeScript、全体fresh checkを通した。ignored SDD task reportの古いcommit/style記載だけは製品成果物に影響しないため未修正。

- [x] **Step 5: branchをpushしsmall PRを作る**

PR title: `feat: complete assigned Todo`

PR bodyにdesign link、behavior、integration counts、runtime result、Cloudflare未deployを記載する。

実測: `feat/todo-completion`をpushし、small PR [#10](https://github.com/MAA39/gs-20260731-aimani-ai/pull/10) `feat: complete assigned Todo`を作成した。Cloudflare deployは未実施。

- [x] **Step 6: GitHub checks後にmerge commit方式でmergeする**

root mainをfast-forwardし、API/Web tests、build、artifact scanをfresh実行する。成功後にcompletion worktree、local/remote branchを削除する。

実測: PR [#10](https://github.com/MAA39/gs-20260731-aimani-ai/pull/10)はmerge commit `7244f7f`で`main`へ統合済み。merge後rootでAPI 13/13、Web 14/14、build 3/3、artifact marker 0をfresh確認し、worktreeとlocal/remote branchを削除した。
