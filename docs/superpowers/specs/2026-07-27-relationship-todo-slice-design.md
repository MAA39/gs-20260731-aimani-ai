# Relationship Todo Vertical Slice Design

- 日付: 2026-07-27
- 対象: `amidala-v2`
- 状態: 実装用に確定
- 親仕様: [`2026-07-26-amidala-v2-platform-design.md`](./2026-07-26-amidala-v2-platform-design.md)

## 1. 目的

Peopleで相手を選び、その人との文脈を失わずに共有Todoを作り、現在の担当者を同じ画面で確認できるようにする。

```text
People
  → Person Todo workspace
  → Todoを作る（自分が担当 / 相手にお願い）
  → 一覧を再取得
  → 作成したTodoと現在担当が同じ画面へ現れる
```

このsliceではHandoffを実装しない。ただし次sliceの`request → accept/reject`で、Todoの担当者を一つのtransaction内で変更できるモデルにする。

## 2. 調査からの決定

### Todoだけをpackageへ分離しない

既存のIdentity/Peopleは`apps/api/src/domain`、`application`、`infrastructure`で動いている。Todoだけを`packages/modules/todo`へ置くと、consumerが一つの段階でbuild・exports・依存設定を先払いし、実装境界も不揃いになる。

Todoはまず次へ閉じる。

```text
apps/api/src/domain/todo.ts
apps/api/src/application/create-todo.ts
apps/api/src/application/list-shared-todos.ts
apps/api/src/infrastructure/db/todo-repository.ts
apps/api/src/routes/todos.ts
```

domain/applicationはAwilix、Hono、Drizzleをimportしない。2つ目のruntime consumerが現れた時に、このまとまりをpackageへ抽出する。

### Relationship IDをTodoの成立条件にしない

Peopleには「関係を未設定」のMemberも表示される。その二人もTodoを作れる必要があるため、nullableな`relationship_id`ではperson workspaceを一意に表せない。

Todoは`context_membership_id`を必須・不変で持つ。これは「誰との文脈で生まれたか」という事実であり、現在の担当者や権限を表さない。Relationship labelは現在のRelationshipから読み、Todoへ複製しない。

### TanStack Queryをこのsliceで導入する

Todoはperson workspace、将来のorganization Todo一覧、Handoff inboxから同じデータを更新する。React `useActionState`だけではQuery cacheの所有と無効化を表せないため、一覧は`queryOptions`、作成は`useMutation`を採用する。

route loaderが`queryClient.ensureQueryData`を行い、Pageは`useSuspenseQuery`で読む。作成成功時は`invalidateQueries`をawaitし、一覧の更新が終わるまでpendingを維持する。作成の楽観更新、自動retry、localStorage永続化は行わない。TanStack Queryはmutationをserver side-effect向けとし、成功時の関連Query invalidationを公式に案内している。[TanStack Query mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)、[Invalidations from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)

TanStack StartではServer Functionをsame-origin RPCとして使い、`.functions.ts`を薄く、`.server.ts`へprivate Hono API adapterを置く。認証・認可はHono側で再検証する。[TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)

## 3. ドメインモデル

```text
Todo
  id
  organizationId
  contextMembershipId      # 作成したperson workspaceの相手。不変
  creatorMembershipId      # session UserのCurrent Membershipから導出。不変
  assigneeMembershipId     # 現在担当。Handoff accept transactionで更新
  title                    # trim後1〜160文字
  description              # optional、最大2000文字
  status                   # open | completed
  createdAt
  updatedAt
```

`creatorMembershipId`をBrowser入力として受けない。create時の`assigneeMembershipId`はCurrent MembershipまたはContext Membershipのどちらかだけを許可する。将来のHandoffだけが第三者Membershipへの変更を許可する。

`contextMembershipId`、`creatorMembershipId`、`assigneeMembershipId`は、すべて`(membership.id, membership.organization_id)`への複合FKで同一Organizationを保証する。

## 4. APIとアプリケーション語彙

```text
ListSharedTodosForRelationship
CreateTodoForRelationship
TodoRepository.listSharedTodos(currentMembership, contextMembershipId)
TodoRepository.createTodo(command)

GET  /organizations/:organizationId/people/:contextMembershipId/todos
POST /organizations/:organizationId/people/:contextMembershipId/todos
```

HTTPの`people/:contextMembershipId`は画面文脈を表す。applicationはCurrent MembershipとContext Membershipが同じOrganizationのactive Membershipかを確認する。

POST body:

```ts
type CreateTodoInput = {
  title: string
  description?: string
  assigneeMembershipId: string
}
```

GET response:

```ts
type RelationshipTodoWorkspace = {
  organization: { organizationId: string; name: string }
  currentMember: TodoMemberSummary
  contextMember: MemberSummary
  todos: TodoSummary[]
}
```

`TodoSummary`はtitle、description、status、creator、assignee、createdAtを持つ。User IDやcredential Accountを返さない。

## 5. 認可とQuery条件

1. Better Auth sessionからUserを得る。
2. `organizationId`に対するactive Current Membershipを得る。なければ403。
3. `contextMembershipId`が同じOrganizationのactive Membershipか確認する。なければ404相当のnot found。
4. 共有一覧は次のpairだけを返す。

```text
(creator = current AND context = selected)
OR
(creator = selected AND context = current)
```

5. POSTはcreatorをCurrent Membershipから導出し、assigneeがpairのどちらかであることを確認する。

すべてのDB条件に`organization_id`を含める。RLS、汎用policy engine、監査logは追加しない。

## 6. UX

routeは`/$organizationId/people/$contextMembershipId/todos`とする。

- People card全体をPerson Todo workspaceへのLinkにする。
- API read modelから得たOrganization名を使い、headerに戻る操作、氏名、title、Relationship label、現在Organizationを表示する。
- composerはtitle、optional description、担当の2択だけにする。
- desktopはcomposerと一覧を一つのwork surfaceに置く。
- mobileは縦積みとし、固定bottom navigationを隠さない。
- 空状態は「この人との共有Todoはまだありません」+「Todoを作る」。
- pendingは一覧寸法のskeleton、作成中はbuttonをdisabledにして文言を変える。
- validation errorはfield近く、API errorはform内の`aria-live`へ表示する。
- 成功はtoastだけにせず、invalidate後の一覧と担当者表示で確認できるようにする。

Organization全体のglobal Todos一覧はこのsliceの対象外とする。Person Todo workspaceではshellのTodos項目を現在URLへ向けてactive表示し、People項目は`/$organizationId/people`へ戻す。これにより未実装の`/todos`へ遷移してOrganization/Contextを失わない。

旧AmidalaのPeople→相手workspace→Todoという情報設計は継承する。一方、Chart/Matrix、priority、label、添付、複雑filter、期限、完了操作はこのsliceへ入れない。

## 7. テスト予算

Todo sliceの自動テストはAPI integration 1本に絞る。

- ownerがAcmeの佐藤とのTodoを作成し、pairの一覧へ作成者・担当者とともに現れる。
- 同じtest内で、Acmeにしか所属しない佐藤がNorthstarのcontextへ作成しようとすると403で、Todoが増えない。

UIは1280pxと390pxの実ブラウザで、People→作成→一覧反映とOrganization分離を確認する。表示componentの細かなsnapshot testは作らない。

## 8. 将来のHandoff境界

HandoffはTodoとは別のtransaction recordとして持ち、`organization_id`と`todo_id`の組で同一Organizationを構造的に保証する。from/to MembershipにもOrganization複合FKを使い、requested HandoffはTodoごとに1件へ制約する。accept時だけ、recipient・status・Organizationをtransaction内で再検証し、Handoff statusの変更と`todo.assignee_membership_id`更新を同時commitする。現担当をHandoff履歴から毎回導出するevent-sourced read modelは採用しない。

## 9. 採用version

- `@tanstack/react-query`: `5.101.4`
- `@tanstack/react-router-ssr-query`: `1.167.1`

後者のpeer dependencyはReact 18/19、React Query 5.90以上、React Router 1.127以上で、現行構成と互換。公式integrationはrequestごとのQueryClient、loaderの`ensureQueryData`、componentの`useSuspenseQuery`を案内している。[TanStack Router Query integration](https://tanstack.com/router/latest/docs/integrations/query)
