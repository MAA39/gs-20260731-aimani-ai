# Work Lifecycle Visibility Design

- 日付: 2026-07-28（Asia/Tokyo）
- 対象repository: `/Users/maa/Projects/gs/000_参照用/amidala-v2`
- base: `b4adc5175945eb969ad4d02e4e89f2733ff36a55`
- 状態: ユーザー承認済み
- UI方針: モックを作らず、既存のToday、TodoCard、HandoffCard、People、Base UIの操作パターンを踏襲する

## 1. 背景

現在のAmidala v2では、Todoを作り、現在担当者から別MembershipへHandoffを依頼し、相手が受け入れるところまで触れる。Todayでは、自分への依頼、自分が持つボール、相手の確認待ち、最近動いたボールを確認できる。

一方、次の3点が欠けている。

1. Todoを正式に完了する操作がない
2. Handoffを受け入れた人が、次に何をするかを宣言できない
3. 組織全体で、誰がどの作業を持ち、どの状態にいるかを俯瞰できない

DBとcontractsには既に`Todo.status = open | completed`があるが、完了use case、API、Server Function、UI actionはない。Handoffには依頼者の`requestMessage`はあるが、受領者の次の行動を表すfieldはない。既存workspaceは本人または関係者単位であり、Organization全体の責任配置を返すread modelはない。

## 2. ユーザーが確認したいこと

このsliceで答えられるようにする問いは次である。

- いま誰がボールを持っているか
- その人は何に取り組んでいるか
- 作業中、引き継ぎ確認待ち、完了のどこにいるか
- Handoffを引き受けた人が、次に何をするつもりか
- 自分の仕事を完了すると、日々の作業面から正しく消えるか

これは工数管理、稼働率管理、詳細なworkflow管理ではない。責任と次の行動を短時間で理解するための機能である。

## 3. 検討したアプローチ

### A. 既存modelから責任状態を導出する（採用）

- `Todo.status`、`Todo.assignee`、`Todo.pendingHandoff`を正本とする
- 完了操作、Handoffの`nextAction`、Organization全体のread modelだけを追加する
- UIは既存cardとsectionを再利用する
- 「作業中」「確認待ち」「完了」は新しいDB stageではなく既存状態から導出する

利点は、既存の責任移管transactionと語彙を保ち、画面を早く触れること。欠点は、将来複雑な工程管理が必要になれば別modelが必要になることだが、現時点では問題にならない。

### B. Todoへ汎用workflow stageを追加する（不採用）

`todo.status`を`not_started / in_progress / waiting / completed`などへ増やす案。見た目上は状況を細かく表せるが、`waiting`がHandoff待ちなのか外部待ちなのか曖昧になり、状態遷移とUIが先に複雑になる。

### C. Event Sourcingまたはactivity feedを正本にする（不採用）

全操作をeventとして記録し、責任配置をprojectionする案。将来の監査には有効だが、現在必要なのは触れる責任把握であり、実装・運用負荷が大きい。

## 4. 全体の実装順序

変更は3つの独立した小PRへ分ける。

1. Todo Completion
2. Handoff Next Action
3. Team Work Overview

各PRは単独で動作し、review・merge・main上の検証を終えてから次へ進む。Cloudflare deployは含めない。

## 5. Slice 1 — Todo Completion

### 5.1 ドメイン語

- operation: `CompleteTodo`
- repository command: `CompleteTodoCommand`
- terminal status: `completed`
- UI: `完了にする` / `完了`

`done`、`close`、`resolve`を混在させない。Todoの実行が終わったことだけを表し、依頼者による成果受入や顧客課題の解決とは分ける。

### 5.2 権限と不変条件

- active MembershipだけがOrganization内のTodoへ操作できる
- current assignee Membershipだけが完了できる
- creator、manager、ownerという理由だけでは完了できない
- `open`なTodoだけを`completed`へ遷移させる
- 同じcurrent assigneeからの二重送信は`already_completed`として同じcompleted Todoを返す
- 別Membershipからの操作は`forbidden`
- Todo不在または別Organizationは`not_found`
- requested Handoffが存在する間は`handoff_pending` conflictとして完了を拒否する
- Handoffを暗黙に取消しない
- completed Todoをreopenする機能は追加しない

完了status更新とpending Handoff確認は、Todo rowをlockした短いtransactionで行う。

### 5.3 API / BFF

API endpoint:

```text
POST /organizations/:organizationId/todos/:todoId/complete
```

成功:

- `200 { todo }`
- 初回は`completed`
- 同じ担当者の再送も`200 { todo }`

失敗:

- `401 unauthorized`
- `403 forbidden`
- `404 not_found`
- `409 handoff_pending`
- `503 service_unavailable`

Webは`completeTodo`というthin `createServerFn`を`features/todos`へ置き、private API Workerへcookieを転送する。成功後は次をawaitしてinvalidateする。

- assigned Todo workspace
- Todayが使うHandoff workspace
- Organization配下のshared Todo workspace
- Slice 3導入後はTeam Work Overview

### 5.4 UI

既存`AssignedTodoCard`のaction areaへ`完了にする`を追加する。Todayと自分のTodo画面は同じcardを使うため、操作を重複実装しない。

- pending Handoff中は既存の「引き継ぎを依頼中」を表示し、完了buttonを出さない
- Handoff依頼buttonと完了buttonを同じaction areaに置く
- reopenがないため、誤操作防止として既存Base UI Dialog patternで確認する
- 確認文: `「{Todo title}」を完了しますか？`
- primary action: `完了にする`
- cancel: `戻る`
- 成功後はquery invalidationによりToday / Assignedからcardが消える
- shared Todo workspaceには既存`TodoCard`の`完了`statusで残る
- transport・validation・conflictのraw messageを表示せず、固定日本語で再試行方法を示す

### 5.5 DB

新しいcolumnとmigrationは追加しない。

- `status = completed`
- `updatedAt = completion time`
- current assigneeが完了主体であることは不変条件から判断できる

`completedAt`、`completedByMembershipId`、completion eventは、完了履歴やreopenが実際に必要になった時に追加する。

## 6. Slice 2 — Handoff Next Action

### 6.1 ドメイン語

- DB / contract / TypeScript: `nextAction`
- UI: `次の一手`
- requesterの説明: 既存`requestMessage` / `背景と期待`
- recipientの宣言: `nextAction` / `次の一手`

依頼者の要求と受領者の行動を同じfieldへ混ぜない。

### 6.2 model

`todo_handoff`へnullable text `next_action`を追加する。

```text
nextAction: string | null
```

- accept時だけ入力できる
- trim後1〜240文字、未入力は`null`
- request、reject、cancelでは`null`
- acceptと同じtransactionで保存する
- deadline、SLA、複数step、checkbox、comment threadは追加しない

### 6.3 API / BFF

既存accept inputを拡張する。

```ts
{
  organizationId: string
  handoffId: string
  nextAction?: string
}
```

API bodyは`{ nextAction?: string }`。同じacceptを再送した場合、最初に保存された`nextAction`を正とし、後の再送で書き換えない。

### 6.4 UI

既存`HandoffRequestCard`のaccept操作をBase UI Dialogで包む。既存のcard、button、field、dialog styleを再利用する。

- title: `このTodoを引き受けますか？`
- field label: `次の一手（任意）`
- placeholder: `次に何をするかを短く書きます`
- max length: 240
- primary action: `引き受ける`
- secondary action: `戻る`

成功後:

- recipientのTodayではTodoが「いま自分が持つボール」へ移る
- requesterのTodayでは「最近動いたボール」にrecipientと`次の一手`を表示する
- Handoff履歴cardでも`nextAction`がある場合だけ表示する
- 空なら余分なlabelや空白を表示しない

## 7. Slice 3 — Team Work Overview

### 7.1 役割

Todayは「自分が今日判断・実行するもの」の画面として維持する。Organization全体の俯瞰を混ぜてTodayを長くしない。

新しいOrganization-scoped routeを追加する。

```text
/$organizationId/work
```

- route / internal feature: `work`
- read model: `TeamWorkOverview`
- use case: `GetTeamWorkOverview`
- navigation label / page title: `チームのボール`

BYARDの`Work`語彙を参照するが、工程管理画面にはしない。

### 7.2 可視範囲

- Organizationのactive Membershipは、同じOrganizationのTeam Work Overviewを閲覧できる
- 別OrganizationのTodoは返さない
- 現在のmodelにconfidential Todoがないため、同じOrganization内では全open Todoを見せる
- 将来confidential workが必要になった場合は、推測でrole条件を足さず、visibility modelを別sliceとして設計する

このvisibility拡張は、ユーザーが確認した「組織全体で誰の作業がどこでどうなっているかを見る」という要件に基づく。

### 7.3 read model

```ts
type TeamWorkOverview = {
  organization: OrganizationSummary
  members: Array<{
    member: TodoMemberSummary
    openTodos: TodoSummary[]
  }>
  recentlyCompletedTodos: TodoSummary[]
}
```

- `members`はopen Todoを1件以上持つactive Membershipだけ
- memberはdisplay name昇順ではなく、最終更新の新しいopen Todoを持つ順
- member内のTodoは`updatedAt desc, todoId desc`
- `recentlyCompletedTodos`は`updatedAt desc, todoId desc`で最大20件
- queryがfilter/order/limitをDBで行い、Organization全件をmemoryで切り捨てない
- open Todoにrequested Handoffがあれば`pendingHandoff`を含める

### 7.4 状況表示

新しい永続statusは追加せず、Webのpure presenterで導出する。

| source | UI状況 |
|---|---|
| `status = open`, `pendingHandoff = null` | `対応中` |
| `status = open`, `pendingHandoff != null` | `{recipient.name}さんの確認待ち` |
| `status = completed` | `完了` |

pending Handoff中のTodoは、acceptまではcurrent assigneeのgroupに置く。recipient groupへ先に移さない。

### 7.5 UI

既存`content`、`section-heading`、`todo-list`、`TodoCard`、status copyを再利用する。chart、kanban、table、avatar wallは追加しない。

```text
チームのボール
  田中 彩
    TodoCard — 対応中
    TodoCard — 森さんの確認待ち
  森 ハル
    TodoCard — 対応中

最近完了
  TodoCard — 完了
```

- member headingにnameとtitle、open件数を表示する
- TodoCardに担当者は既存表示を残し、状況labelを追加する
- pending Handoffではcurrent assigneeからrecipientへのrailを表示する
- open Todoがない時は`いまチームが持っているボールはありません`と表示する
- recently completedがない時はsection自体を省略する
- desktop/mobileの情報順序は同じ
- mobileは1column、既存44px操作面と8px rhythmを維持する

Team Work Overviewはread-onlyから開始する。完了・Handoff actionはTodayまたはAssigned Todoで行い、Organization全体画面へ操作を重複させない。

## 8. React / TanStack方針

- route loaderは`queryClient.ensureQueryData`
- Pageは同じquery optionsを`useSuspenseQuery`で読む
- mutation後は関係するquery keyを正確にinvalidateし、完了をawaitする
- query resultからのgrouping / status copyはpure functionで行う
- URLへ保存すべきfilterを追加しないため、search paramsは今回使わない
- user actionはevent handlerで扱い、query同期やderived stateのために`useEffect`を追加しない
- Dialogのopen、text input、pending/errorだけをlocal interaction stateとする

## 9. Error UX

上流のHTTP message、DB error、snake_case reasonを画面へ出さない。

Completion:

- pending Handoff: `引き継ぎの確認待ちです。依頼を取り消すか、相手の返答後に完了してください。`
- already completed: successとして扱う
- forbidden: `現在の担当者だけがこのTodoを完了できます。`
- unavailable: `Todoを完了できませんでした。時間をおいて、もう一度お試しください。`

Next Action:

- 240文字超過はclient/schema双方で拒否
- accept conflictは既存typed copyを維持
- nextAction保存だけを別mutationにせず、accept全体を成功または失敗させる

Team Work Overview:

- 403はOrganization選択へ戻す
- 404はOrganization選択へ戻す
- service unavailableは既存retry buttonを使う

## 10. Test Strategy

テスト数を目的化せず、責任境界と状態遷移を守る。

### Completion integration

- current assigneeがopen Todoをcompleteできる
- completed TodoがAssigned / Todayのown sectionから消える
- shared workspaceにはcompletedとして残る
- non-assigneeは403
- pending Handoff中は409で、TodoとHandoffが変化しない
- current assigneeの二重送信は200で同じcompleted Todoを返す
- session Userがpath Organizationのactive Membershipでなければ403、同じOrganizationのactorが別Organizationまたは存在しないTodo IDを指定した場合は404

### Next Action integration

- recipientがaccept時にnextActionを保存できる
- Todo assignee変更とnextAction保存が同一transaction
- non-recipientは保存できない
- reject / cancelではnextActionがnull
- accept再送で最初のnextActionを上書きしない
- 241文字は400

### Web pure tests

- Team Work status presenterが対応中 / 確認待ち / 完了を正しく導出する
- Today announcementがnextActionを含む場合だけ表示する
- error mapperがraw upstream messageを漏らさない

### Team Work integration

- active memberだけが同じOrganizationのoverviewを読める
- 別OrganizationのTodoを返さない
- pending Handoffをcurrent assignee groupに置く
- open groupsとrecent completedのorder / limitが正しい
- open Todoを持たないmemberを空groupとして返さない

### Runtime journey

1. demo reset
2. 完了確認用Todoを田中が完了し、Todayから消えてshared workspaceで完了になる
3. 別の引き継ぎ確認用Todoを田中が森へHandoff依頼する
4. `チームのボール`で田中groupのまま森の確認待ちになることを確認する
5. 森が次の一手付きでacceptする
6. 田中・森双方のTodayで次の一手を確認する
7. `チームのボール`で森groupの対応中へ移ったことを確認する
8. desktop 1280x720、mobile 390x844、direct reload、browser consoleを確認する

## 11. 非目標

- Todo reopen
- 完了取消
- deadline / reminder / notification
- 稼働率、工数、capacity planning
- generic workflow stage
- kanban drag and drop
- comment / activity feed
- full Event Sourcing
- Webhook / Queue Worker
- confidential Todo / role policy
- Cloudflare deploy
- 網羅的なtest追加

## 12. 完了条件

- current assigneeがTodoを安全に完了できる
- pending Handoffとの矛盾を作らない
- Handoff recipientがaccept時に次の一手を残せる
- requesterとrecipient双方が次の一手をTodayで確認できる
- Organization全体のopen Todoがcurrent assignee別に見える
- 各Todoが対応中、確認待ち、完了のどこにいるか分かる
- existing UI/UX patternを踏襲し、mock固有の新visual languageを持ち込まない
- API / Web tests、build、production credential scanが通る
- 3つの小PRがreview後にmainへmergeされ、feature worktreeが残らない
