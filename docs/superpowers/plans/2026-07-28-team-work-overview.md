# Team Work Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同じOrganizationのactive Memberが、誰がどのopen Todoを持ち、対応中・Handoff確認待ち・最近完了のどこにいるかを担当者別に確認できる画面を追加する。

**Architecture:** Todo repositoryへOrganization-scoped CQRS read model `TeamWorkOverview`を追加し、private Hono API → thin Server Function → Query loaderで読む。UIは新しいvisual systemを作らず、既存section / TodoCard / rail / empty/error surfaceを組み合わせる。

**Tech Stack:** TypeScript 7、Hono、Drizzle ORM、PostgreSQL、TanStack Start / Router / Query、React 19、Lucide、Vitest / Node test

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-28-work-lifecycle-visibility-design.md` Slice 3。
- Routeは`/$organizationId/work`、featureは`features/work`、read modelは`TeamWorkOverview`。
- UI label / titleは`チームのボール`。
- 同じOrganizationのactive Membershipは全open Todoとrecently completedを読める。
- 別OrganizationのTodoを返さない。
- 状況は`Todo.status`と`pendingHandoff`からpureに導出し、新しいworkflow columnを追加しない。
- pending Handoffはacceptまでcurrent assignee groupに置く。
- open groupは更新の新しいworkを持つmember順、member内は`updatedAt desc, todoId desc`。
- completedは`updatedAt desc, todoId desc`で最大20件。filter/order/limitはDBで行う。
- Overviewはread-only。完了/Handoff actionを重複させない。
- 新しい`useEffect`、new dependency、chart、kanban、table、Cloudflare deployを追加しない。
- UIは既存content / section heading / TodoCard / navigation / mobile 1-columnを踏襲する。

---

### Task 1: Organization全体read modelのbehaviorをREDで固定する

**Files:**
- Modify: `apps/api/src/routes/todo-handoffs.integration.test.ts`

**Interfaces:**
- Produces test-local `teamWorkOverviewSchema`
- Produces helper: `getTeamWork(cookie, organizationId?)`
- Proves Organization visibility、grouping、pending placement、recent order/limit

- [ ] **Step 1: test-local response schemaとhelperを書く**

```ts
const teamWorkOverviewSchema = z.object({
  organization: z.object({ organizationId: z.string(), name: z.string() }),
  currentMember: memberSchema,
  members: z.array(z.object({
    member: memberSchema,
    openTodos: z.array(todoSummarySchema),
  })),
  recentlyCompletedTodos: z.array(todoSummarySchema),
});

const getTeamWork = async (cookie: string, organizationId = 'org_acme_studio') => {
  const response = await app.fetch(new Request(
    `http://localhost:8787/organizations/${organizationId}/work`,
    { headers: { cookie } },
  ), env);
  const body = await response.json();
  return { status: response.status, body };
};
```

- [ ] **Step 2: grouping / pending placementのfailing testを書く**

```ts
it('groups open work under the current assignee and keeps pending Handoff with its requester', async () => {
  const ownerCookie = await signIn('owner@amidala.local');
  const moriCookie = await signIn('mori@amidala.local');
  const ownerTodo = await createTodo(ownerCookie, 'acme-studio-owner');
  const moriTodo = await createTodo(ownerCookie, 'acme-studio-mori');
  await requestHandoff(ownerCookie, ownerTodo.todoId, { recipientMembershipId: 'acme-studio-mori' });

  const response = await getTeamWork(moriCookie);
  expect(response.status).toBe(200);
  const overview = teamWorkOverviewSchema.parse(response.body);
  expect(overview.currentMember.membershipId).toBe('acme-studio-mori');
  expect(overview.members.find((group) => group.member.membershipId === 'acme-studio-owner')?.openTodos.find((todo) => todo.todoId === ownerTodo.todoId)?.pendingHandoff?.recipient.membershipId).toBe('acme-studio-mori');
  expect(overview.members.find((group) => group.member.membershipId === 'acme-studio-mori')?.openTodos.map((todo) => todo.todoId)).toContain(moriTodo.todoId);
});
```

- [ ] **Step 3: visibility / ordering / completed limit testsを書く**

同じtest fileでfixture prefix `todo-team-work-${fixtureId}-`を使い、`finally`でそのprefixだけ削除する。

- Acme memberはAcmeの全open Todoを見られる。
- Northstar memberがAcme pathを読むと403。
- Acme overviewへNorthstar Todo IDが混ざらない。
- open Todoを持たないactive member groupは返らない。
- group内はupdatedAt desc / ID desc。
- completed fixtureを21件作り、最新20件だけが期待順で返る。

DB fixture insertは既存testのparameterized query patternを使い、title以外をstring interpolationしない。

- [ ] **Step 4: REDを確認する**

```bash
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff \
  pnpm --filter @amidala/api test:integration -- todo-handoffs.integration.test.ts --run
```

Expected: `/work`が存在せず404のためnew testsがfailする。既存Handoff testはpassする。

- [ ] **Step 5: test-only commitを作る**

```bash
git add apps/api/src/routes/todo-handoffs.integration.test.ts
git commit -m "test: define Team Work overview behavior"
```

---

### Task 2: contracts / API read modelをGREENにする

**Files:**
- Modify: `packages/contracts/src/todo.ts`
- Modify: `apps/api/src/domain/todo.ts`
- Create: `apps/api/src/application/get-team-work-overview.ts`
- Modify: `apps/api/src/infrastructure/db/todo-repository.ts`
- Modify: `apps/api/src/composition/request-scope.ts`
- Modify: `apps/api/src/routes/todos.ts`

**Interfaces:**
- Produces: `teamWorkOverviewSchema` / `TeamWorkOverview`
- Produces: `TeamWorkOverviewQuery`
- Produces: `TodoRepository.getTeamWorkOverview(query)`
- Produces: `GetTeamWorkOverview.execute(userId, input)`
- Produces: `GET /organizations/:organizationId/work`

- [ ] **Step 1: shared contractを追加する**

`packages/contracts/src/todo.ts`:

```ts
export const teamWorkMemberGroupSchema = z.object({
  member: todoMemberSummarySchema,
  openTodos: z.array(todoSummarySchema),
});
export const teamWorkOverviewSchema = z.object({
  organization: z.object({ organizationId: z.string(), name: z.string() }),
  currentMember: todoMemberSummarySchema,
  members: z.array(teamWorkMemberGroupSchema),
  recentlyCompletedTodos: z.array(todoSummarySchema),
});
export type TeamWorkOverview = z.infer<typeof teamWorkOverviewSchema>;
```

- [ ] **Step 2: domain portとuse caseを追加する**

`apps/api/src/domain/todo.ts`:

```ts
export interface TeamWorkOverviewQuery {
  organizationId: string;
  currentMembershipId: string;
}
```

`TodoRepository`へ`getTeamWorkOverview(query): Promise<TeamWorkOverview>`を追加する。

`GetTeamWorkOverview.execute`は`findActiveMembershipForUser`でcurrent membershipを検証し、なければ403。repositoryへOrganization/current membershipを渡す。

- [ ] **Step 3: DB queryを実装する**

`getTeamWorkOverview`は次を並列取得する。

1. Organization summary
2. current Membership summary
3. open Todo rows + creator/assignee + requested Handoff/requester/recipient joins
4. completed Todo rows + creator/assignee joins、order/limit 20

open query:

```ts
.where(and(eq(todo.organizationId, q.organizationId), eq(todo.status, 'open')))
.orderBy(desc(todo.updatedAt), desc(todo.id))
```

completed query:

```ts
.where(and(eq(todo.organizationId, q.organizationId), eq(todo.status, 'completed')))
.orderBy(desc(todo.updatedAt), desc(todo.id))
.limit(20)
```

open rowsはquery順を保って`Map<membershipId, group>`へ一度だけgroupingする。groupの初回insert順が最新Todoを持つmember順になる。active assignee joinを`innerJoin`し、inactive/deleted memberのempty projectionを返さない。

既存`toTodoSummary`の第2引数をnamed typeへ抽出し、open/completedの両queryで再利用する。

```ts
type TodoProjection = {
  creatorName?: string | null;
  creatorTitle?: string | null;
  assigneeName?: string | null;
  assigneeTitle?: string | null;
  handoffId?: string | null;
  handoffRequesterId?: string | null;
  handoffRequesterName?: string | null;
  handoffRequesterTitle?: string | null;
  handoffRecipientId?: string | null;
  handoffRecipientName?: string | null;
  handoffRecipientTitle?: string | null;
  handoffMessage?: string | null;
  handoffRequestedAt?: Date | null;
};

private toTodoSummary(row: TodoRow, projection?: TodoProjection): TodoSummary
```

open queryはrequested Handoff joinsを`TodoProjection`へ渡す。completed queryはcreator / assigneeだけを渡すため`pendingHandoff`は必ずnullになる。

- [ ] **Step 4: DI / routeを接続する**

`RequestCradle`とregisterへ`getTeamWorkOverview`を追加する。route moduleへsession helperを先に抽出する。

```ts
async function currentUserId(context: Context<ApiEnv>): Promise<string> {
  const auth = await context.get('scope').resolve('auth');
  const session = await auth.api.getSession({ headers: context.req.raw.headers });
  if (!session?.user) throw new ApiError('unauthorized', 'Authentication required');
  return session.user.id;
}
```

`Context`は`hono`からtype importし、既存create/read routeもこのhelperを使う。

`apps/api/src/routes/todos.ts`:

```ts
.get('/organizations/:organizationId/work', async (context) => {
  const path = organizationPathSchema.safeParse(context.req.param());
  if (!path.success) throw new ApiError('validation_error', 'Invalid Organization path.');
  const userId = await currentUserId(context);
  const useCase = await context.get('scope').resolve<GetTeamWorkOverview>('getTeamWorkOverview');
  return context.json(await useCase.execute(userId, path.data));
})
```

- [ ] **Step 5: GREENを確認する**

```bash
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff \
  pnpm --filter @amidala/api test:integration -- todo-handoffs.integration.test.ts --run
```

Expected: new testsと既存tests pass。

- [ ] **Step 6: API read model commitを作る**

```bash
git add packages/contracts/src/todo.ts apps/api/src/domain/todo.ts apps/api/src/application/get-team-work-overview.ts apps/api/src/infrastructure/db/todo-repository.ts apps/api/src/composition/request-scope.ts apps/api/src/routes/todos.ts
git commit -m "feat: expose Team Work overview"
```

---

### Task 3: Web status presenterとBFFをTDDで追加する

**Files:**
- Create: `apps/web/src/features/work/team-work-status.ts`
- Create: `apps/web/src/features/work/team-work-status.test.ts`
- Create: `apps/web/src/features/work/team-work-schema.ts`
- Create: `apps/web/src/features/work/team-work.server.ts`
- Create: `apps/web/src/features/work/team-work.functions.ts`
- Create: `apps/web/src/features/work/team-work-queries.ts`

**Interfaces:**
- Produces: `teamWorkStatus(todo)`
- Produces: `TeamWorkOverviewResult`
- Produces: `getTeamWorkOverview` Server Function / Query options

- [ ] **Step 1: pure status RED testを書く**

```ts
test('Team Work statusはTodoとpending Handoffから導出する', () => {
  assert.deepEqual(teamWorkStatus(openTodo), { kind: 'in_progress', label: '対応中' });
  assert.deepEqual(teamWorkStatus({ ...openTodo, pendingHandoff }), {
    kind: 'handoff_pending',
    label: '森 ハルさんの確認待ち',
  });
  assert.deepEqual(teamWorkStatus({ ...openTodo, status: 'completed', pendingHandoff: null }), {
    kind: 'completed',
    label: '完了',
  });
});
```

Run `pnpm --filter @amidala/web test`。Expected: module不存在でfail。

- [ ] **Step 2: presenterをGREENにする**

`teamWorkStatus`を次のpure functionとして実装する。React、Query、dateをimportしない。

```ts
export type TeamWorkStatus =
  | { kind: 'in_progress'; label: '対応中' }
  | { kind: 'handoff_pending'; label: string }
  | { kind: 'completed'; label: '完了' };

export function teamWorkStatus(todo: TodoSummary): TeamWorkStatus {
  if (todo.status === 'completed') return { kind: 'completed', label: '完了' };
  if (todo.pendingHandoff) {
    return {
      kind: 'handoff_pending',
      label: `${todo.pendingHandoff.recipient.name}さんの確認待ち`,
    };
  }
  return { kind: 'in_progress', label: '対応中' };
}
```

- [ ] **Step 3: schema / BFF / queryを実装する**

`TeamWorkOverviewResult`はok / forbidden / not_found / validation_error / service_unavailable union。

`team-work.server.ts`は`env.API.fetch('http://api.internal/organizations/${organizationId}/work')`へcookieを転送し、200 bodyを`teamWorkOverviewSchema.safeParse`する。401 redirect、403/404固定日本語、その他は`チームのボールを読み込めませんでした。時間をおいてもう一度お試しください。`。

Query key:

```ts
export const teamWorkOverviewKey = (organizationId: string) => ['teamWork', organizationId] as const;
```

Server Function validatorは`z.object({ organizationId: z.string().min(1) })`。

- [ ] **Step 4: Web tests / typecheckを確認する**

```bash
pnpm --filter @amidala/web test
pnpm --filter @amidala/web exec tsc --noEmit
```

- [ ] **Step 5: presenter / BFF commitを作る**

```bash
git add apps/web/src/features/work
git commit -m "feat: connect Team Work overview BFF"
```

---

### Task 4: typed routeと既存card UIを追加する

**Files:**
- Create: `apps/web/src/features/work/TeamWorkPage.tsx`
- Create: `apps/web/src/features/work/TeamWorkTodoCard.tsx`
- Create: `apps/web/src/routes/$organizationId/work.tsx`
- Modify: generated `apps/web/src/routeTree.gen.ts`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `teamWorkOverviewQuery`
- Consumes: `teamWorkStatus`
- Reuses: `TodoCard`
- Produces route: `/$organizationId/work`

- [ ] **Step 1: Page / cardを実装する**

`TeamWorkTodoCard`は`TodoCard`のaction slotへread-only status surfaceを渡す。mutation buttonを置かない。

```tsx
const status = teamWorkStatus(todo);
const action = <div className={`team-work-status ${status.kind}`}>
  <span>{status.label}</span>
  {todo.pendingHandoff ? <small>{todo.assignee.name} → {todo.pendingHandoff.recipient.name}</small> : null}
</div>;
return <TodoCard todo={todo} action={action} />;
```

`TeamWorkPage`:

- ok以外は既存empty surface、retry button、Organization chooser link。
- header eyebrow Organization name、h2 `チームのボール`、説明 `誰がどの仕事を持ち、どこで止まっているかを確認できます。`
- member group heading: name / title / `{count}件`
- open groupは`todo-list`でcard表示。
- empty: `いまチームが持っているボールはありません`。
- recently completedはitemsがある時だけ`最近完了` section。

- [ ] **Step 2: route loaderを実装する**

```tsx
export const Route = createFileRoute('/$organizationId/work')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(teamWorkOverviewQuery(params.organizationId)),
  pendingComponent: () => <section className="content"><div className="skeleton-block" /></section>,
  component: TeamWorkRoute,
});
```

componentは`useSuspenseQuery`で同じqueryを読み、`TeamWorkPage`へ渡す。

- [ ] **Step 3: navigationへ既存patternで追加する**

`__root.tsx`のlinksへ`BriefcaseBusiness` icon、`to: 'work'`、label `チームのボール`をToday直後に追加する。

- page title `/work$` → `チームのボール`
- Organization regexへ`work`
- `NavItem`へtyped `/$organizationId/work` branch
- desktop side nav / mobile bottom navは同じlinks sourceを使う

Vite route generationで`routeTree.gen.ts`を生成し、手書き編集しない。

- [ ] **Step 4: existing design tokensでstyleする**

新規classesはlayoutだけに限定する。

- `.team-work-groups`: grid gap
- `.team-work-member`: section spacing
- `.team-work-member-heading`: existing section heading相当
- `.team-work-status`: existing `brand-soft` / `attention` / `connected` colors

TodoCard、rail、status、empty surface、button、radius、shadow、font tokenを再定義しない。mobile 800px以下は1columnのまま。

- [ ] **Step 5: tests / build / generated routeを検証する**

```bash
pnpm --filter @amidala/web test
pnpm build
rg -n "'/\$organizationId/work'" apps/web/src/routeTree.gen.ts
! rg -n 'owner@amidala\.local|mori@amidala\.local|amidala-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist
git diff --check
```

- [ ] **Step 6: route / UI commitを作る**

```bash
git add apps/web/src/features/work apps/web/src/routes/'$organizationId'/work.tsx apps/web/src/routeTree.gen.ts apps/web/src/routes/__root.tsx apps/web/src/styles.css
git commit -m "feat: show Team Work overview"
```

---

### Task 5: completion / Handoff mutationからTeam Workをinvalidateする

**Files:**
- Modify: `apps/web/src/features/todos/CompleteTodoDialog.tsx`
- Modify: `apps/web/src/features/handoffs/HandoffRequestCard.tsx`
- Modify: `apps/web/src/features/handoffs/RequestTodoHandoffDialog.tsx`

**Interfaces:**
- Consumes: `teamWorkOverviewKey`
- Preserves existing exact invalidations

- [ ] **Step 1: 3 mutationへTeam Work keyを追加する**

Completion、Handoff request、accept/reject/cancelの既存`Promise.all`へ次を追加する。

```ts
client.invalidateQueries({ queryKey: teamWorkOverviewKey(organizationId), exact: true })
```

mutationがTeam Work pageから実行されるわけではないためoptimistic updateは追加しない。

- [ ] **Step 2: Web tests / buildを再実行する**

```bash
pnpm --filter @amidala/web test
pnpm build
```

- [ ] **Step 3: invalidation commitを作る**

```bash
git add apps/web/src/features/todos/CompleteTodoDialog.tsx apps/web/src/features/handoffs/HandoffRequestCard.tsx apps/web/src/features/handoffs/RequestTodoHandoffDialog.tsx
git commit -m "fix: refresh Team Work after responsibility changes"
```

---

### Task 6: runtime、review、small PR、mergeを完了する

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-team-work-overview.md`
- Modify: `docs/HANDOFF-CLAUDE-2026-07-28.md`

**Interfaces:**
- Produces: reviewed Team Work Overview PR
- Base: Next Action merge後のlatest `main`

- [ ] **Step 1: full verificationを実行する**

```bash
pnpm --filter @amidala/api test
pnpm --filter @amidala/web test
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff pnpm --filter @amidala/api test:integration --run
pnpm --filter @amidala/api test:demo --run
pnpm build
git diff --exit-code -- apps/web/src/routeTree.gen.ts
! rg -n 'owner@amidala\.local|mori@amidala\.local|amidala-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist
git diff --check
```

- [ ] **Step 2: end-to-end local journeyを実行する**

1. demo reset
2. 田中TodayのTodoがTeam Workの田中groupへ`対応中`で出る
3. 田中が森へHandoffを依頼し、Team Workでは田中groupのまま`森 ハルさんの確認待ち`
4. 森が次の一手付きでacceptし、Team Workでは森groupへ移って`対応中`
5. 森がTodoを完了し、open groupから消えて`最近完了`へ移る
6. 田中、森の両sessionで同じOrganization overviewを確認
7. Northstar path / sessionでAcme dataが出ない
8. direct reload、desktop 1280x720、mobile 390x844、console error/hydration 0

- [ ] **Step 3: independent reviewを依頼する**

Organization越境、all-member visibility、DB-side limit/order、pending placement、read-only UI、route typing、query invalidation、existing design consistencyをreview対象にする。

- [ ] **Step 4: Critical/ImportantをTDDで修正して再検証する**

- [ ] **Step 5: small PRを作る**

PR title: `feat: show Team Work overview`

- [ ] **Step 6: GitHub checks後にmerge commit方式でmergeする**

root mainでfresh verificationし、work overview worktree、local/remote branchを削除する。Cloudflare deployは行わない。
