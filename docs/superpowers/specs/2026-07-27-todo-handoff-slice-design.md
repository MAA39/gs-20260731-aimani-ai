# Todo Handoff Vertical Slice Design

- 日付: 2026-07-27
- 対象: `amidala-v2`
- 状態: AI設計レビューで確定
- 親仕様: [`2026-07-26-amidala-v2-platform-design.md`](./2026-07-26-amidala-v2-platform-design.md)
- 前提: [`2026-07-27-relationship-todo-slice-design.md`](./2026-07-27-relationship-todo-slice-design.md)

## 1. 目的

現在担当者がTodoの引き継ぎを依頼し、指名された相手が引き受けるか見送るかを決められるようにする。引き受けたTodoは「自分のTodo」へ現れ、責任の移動を同じOrganization内で画面から確認できる。

```text
Person SharedTodo / 自分のTodo
  → 引き継ぎを依頼
  → 引き継ぎ先が「引き継ぎ」で確認
  → 引き受ける / 見送る
  → 受諾時だけTodoの現在担当が変わる
  → 自分のTodoと最近の引き継ぎで結果を確認
```

このsliceは担当変更を相手の同意なしに行う管理機能ではない。creator、作成時のperson context、Organizationは変えない。

## 2. AI設計レビューからの決定

Codexのドメイン・PostgreSQL・React/UXレビューと、Claude Opusの反証レビューを行った。Claudeが指摘した次の3点を採用した。

1. 第三者が引き受けたTodoは既存Person pair一覧だけでは見つからないため、Organization scopedの「自分のTodo」が必要。
2. 未回答や引き継ぎ先Membershipの停止でrequestedが残ると次の依頼を作れないため、依頼者による取消が必要。依頼者自身が停止された場合の管理者回復はこのsliceの対象外とする。
3. `TodoHandoff`からTodoへOrganization込みの複合FKを張るには、Todo側の`(id, organization_id)` uniqueが必要。

一方、次の提案は再審査で棄却した。

- 永続Entityを汎用`Handoff`と呼ぶ: 現在の実体はTodo担当移管だけであり、未実装の汎用性を含む。
- `DecideHandoff(decision)`へ統合する: acceptだけがTodo担当を変更するため、reject/cancelと副作用が非対称。
- accept/rejectへ確認Dialogを重ねる: 「引き継ぎ」画面自体が意思決定画面であり、明示されたinline actionの方が速く理解できる。
- Handoff履歴から現在担当を再構築する: 現在担当の正本は`Todo.assigneeMembershipId`のままとする。

名前は効果と目的を表し、理解の変化に合わせて更新する。[Eric Evans: Honest Names](https://www.domainlanguage.com/articles/good-design-is-imperfect-design-part-1-honest-names/)、[Martin Fowler: Ubiquitous Language](https://martinfowler.com/bliki/UbiquitousLanguage.html)

## 3. ユビキタス言語

| 概念 | TypeScript / DB | UI |
| --- | --- | --- |
| Todo担当の引き継ぎ | `TodoHandoff` / `todo_handoff` | 引き継ぎ |
| 依頼する | `RequestTodoHandoff` | 引き継ぎを依頼 |
| 引き受ける | `AcceptTodoHandoff` | 引き受ける |
| 見送る | `RejectTodoHandoff` | 見送る |
| 取り消す | `CancelTodoHandoff` | 依頼を取り消す |
| 依頼者 | `requesterMembershipId` | 依頼者 / 現在の担当 |
| 引き継ぎ先 | `recipientMembershipId` | 引き継ぎ先 |
| 終端日時 | `resolvedAt` | 引き継ぎ済み / 見送り / 取消日時 |

`from` / `to`、`sender` / `receiver`、`targetUserId`、`UpdateStatus`、`HandoffService`は使わない。Organization内の人物はUserではなくMembershipで表す。

## 4. ドメインモデルと状態機械

```text
TodoHandoff
  id
  organizationId
  todoId
  requesterMembershipId     # request時の現在担当。sessionから導出
  recipientMembershipId     # acceptまでは担当者ではない
  requestMessage            # optional、trim後500文字以内
  status                    # requested | accepted | rejected | canceled
  requestedAt
  resolvedAt                # requestedならnull、終端なら必須
```

```text
requested ──accept──> accepted
          ├─reject──> rejected
          └─cancel──> canceled
```

accepted / rejected / canceledは終端状態である。同じTodoにrequestedは1件だけとし、終端後は現在担当者が新しい依頼を作れる。

### Request時の不変条件

1. requesterはsession Userから検証した同じOrganizationのactive Membership。
2. requesterはTodoの現在の`assigneeMembershipId`と一致する。
3. recipientは同じOrganizationのactive Membershipで、requesterとは異なる。
4. Todoは`open`。
5. requesterをBrowser入力として受け取らない。

### Accept時の不変条件

1. actorはrecipient本人。
2. TodoHandoffはrequested。
3. recipientは引き続きactive。
4. Todoはopenで、現在担当はrequesterのまま。
5. Handoffのaccepted化とTodoのassignee更新を同一transactionでcommitする。
6. `contextMembershipId`、`creatorMembershipId`は更新しない。

Rejectはrecipient本人、Cancelはrequester本人だけがrequestedから実行できる。Reject/CancelではTodoを更新しない。

## 5. PostgreSQL設計

Todoへ`UNIQUE (id, organization_id)`を追加し、`todo_handoff`は次をDBで保証する。

- `(todo_id, organization_id)` → Todoの複合FK
- `(requester_membership_id, organization_id)` → Membershipの複合FK
- `(recipient_membership_id, organization_id)` → Membershipの複合FK
- requesterとrecipientの非同一CHECK
- status CHECK
- requestedなら`resolved_at IS NULL`、終端なら`resolved_at IS NOT NULL`のCHECK
- `(organization_id, todo_id) WHERE status = 'requested'`のpartial unique index
- incoming一覧用`(organization_id, recipient_membership_id, requested_at DESC) WHERE status = 'requested'`
- outgoing一覧用`(organization_id, requester_membership_id, requested_at DESC) WHERE status = 'requested'`
- Todo履歴用`(organization_id, todo_id, requested_at DESC)`

transactionはPostgreSQL既定の`READ COMMITTED`を使う。すべてのcommandでTodoを最初に`FOR UPDATE`し、ロック順を`Todo → Membership → TodoHandoff`へ揃える。複数Membershipをlockする場合はID昇順に固定する。更新は`WHERE status = 'requested'`を含むconditional UPDATEと`RETURNING`で成立件数を確認する。[PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html)、[Partial Indexes](https://www.postgresql.org/docs/18/indexes-partial.html)、[Drizzle Transactions](https://orm.drizzle.team/docs/transactions)

同じrequestまたは同じ終端commandの再送は既存結果を200で返す。requestの同一性は、同じTodoのactive requestedに対して`requesterMembershipId`、`recipientMembershipId`、trim後nullへ正規化した`requestMessage`がすべて一致することと定義する。それ以外のactive requestedは409とする。

terminal commandは次の順で判定する。

1. Organization条件を含むnon-locking lookupでTodoHandoffから`todoId`と当事者を得る。
2. actorがcommandの当事者でなければ403。
3. transactionを開始し、Todo → Membership → TodoHandoffの順でlockする。
4. statusが同じcommandの終端状態なら既存結果を200で返す。
5. statusが別の終端状態なら409。
6. requestedの場合だけ、active Membership、open Todo、accept時のcurrent assigneeを検証してconditional UPDATEへ進む。

これによりaccept後にassigneeが変わっていても、同じacceptの再送はstale判定より先に200となる。別recipientへの同時request、異なる終端command、stale assigneeは409。汎用idempotency table、Serializable retry、Event Store、outboxは追加しない。

## 6. APIとread model

```text
POST /organizations/:organizationId/todos/:todoId/handoffs
POST /organizations/:organizationId/handoffs/:handoffId/accept
POST /organizations/:organizationId/handoffs/:handoffId/reject
POST /organizations/:organizationId/handoffs/:handoffId/cancel
GET  /organizations/:organizationId/handoffs
GET  /organizations/:organizationId/todos/assigned-to-me
```

application use case:

```text
RequestTodoHandoff
AcceptTodoHandoff
RejectTodoHandoff
CancelTodoHandoff
GetTodoHandoffWorkspace
GetAssignedTodoWorkspace
```

`GetTodoHandoffWorkspace`は`TodoHandoffWorkspace`として次を返す。

- `incomingRequests`: 現在Membershipがrecipientのrequested
- `outgoingRequests`: 現在Membershipがrequesterのrequested
- `recentHandoffs`: 現在Membershipが当事者のaccepted/rejected/canceled直近20件

`GetAssignedTodoWorkspace`は`AssignedTodoWorkspace`としてOrganization、current Member、現在Membershipが担当するopen Todoを返す。Person SharedTodo pair条件へassignee条件を混ぜない。

`TodoSummary`には`pendingHandoff`を追加する。値は`handoffId`、requester、recipient、requestMessage、requestedAt。画面はこれを使って「○○さんへ依頼中」を表示し、別依頼を抑止する。

## 7. Web / BFF境界

```text
features/handoffs/
  handoff-schema.ts
  handoff-queries.ts
  handoffs.functions.ts
  handoffs.server.ts
  RequestTodoHandoffDialog.tsx
  HandoffPage.tsx
  HandoffRequestCard.tsx

features/todos/
  AssignedTodoPage.tsx
  TodoCard.tsx

routes/$organizationId/
  todos.tsx
  handoffs.tsx

routes/
  todos.tsx              # 削除。global placeholderを残さない
  handoffs.tsx           # 削除。global placeholderを残さない

routes/__root.tsx        # desktop/mobile nav、title、active stateをOrganization scoped routeへ更新
routeTree.gen.ts         # TanStack Routerで再生成
```

routeはvalidate/loader/component adapterだけを持つ。Server Functionは薄く、private Hono Service Binding呼び出しは`.server.ts`へ閉じる。loaderはQueryClientへ`ensureQueryData`し、Pageは`useSuspenseQuery`で読む。

依頼は`@base-ui/react` `1.6.0`のDialogで行う。候補者は既存People queryを再利用し、現在担当を除外する。DialogはTitle/Description、visible close、focus return、mobile 44px targetを満たす。[Base UI Dialog](https://base-ui.com/react/components/dialog)

accept/rejectはHandoff card内のinline action、cancelはoutgoing card内のquiet actionとする。別のAlertDialogは挟まない。mutation中は同じcardの操作をdisabledにし、結果を`aria-live`と再取得済みの画面本体へ反映する。

## 8. QueryとReact状態

- user actionはevent handlerから`useMutation`を呼ぶ。side effectのために`useEffect`を追加しない。
- assignee、Handoff statusをoptimisticに変更しない。責任移管はserver transaction確定後だけ表示する。
- success時に同じOrganizationの`assignedTodos`、`todoHandoffWorkspace`、`sharedTodoWorkspace`を厳密にinvalidateし、awaitする。
- FormDataはsubmit時にZod検証し、serializable objectへ変換する。
- errorはvalidation / forbidden / not found / conflict / service unavailableを画面語へ変換する。
- 409 already decidedは赤い致命的errorではなく「この依頼はすでに処理されています」と再取得を案内する。

Reactは外部systemとの同期以外にEffectを使わず、イベント起因の処理をevent handlerへ置くよう案内している。[React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

## 9. UX

### 自分のTodo

- route: `/$organizationId/todos`
- 現在担当のopen Todoを一覧表示。
- pending Handoffをstatus badgeとrecipient名で表示。
- 現在担当かつrequestedがなければ「引き継ぎを依頼」。
- accept直後は「引き継ぎ」から「自分のTodoで確認」へ移動できる。

### 引き継ぎ

- route: `/$organizationId/handoffs`
- 「あなたへの依頼」「送った依頼」「最近の引き継ぎ」の3区分。
- railは`現在の担当 → Todo → 引き継ぎ先`を表す。
- incoming cardに「引き受ける」primaryと「見送る」secondary。
- outgoing cardに「依頼を取り消す」quiet action。
- acceptedはgreenだけに頼らず「引き継ぎ済み」、rejectedは「見送り」、canceledは「取消済み」と表示。

desktop / mobileともOrganization contextを保持する。shell navigationはglobal `/todos` / `/handoffs`を使わず、現在の`organizationId`を含むrouteへ向ける。390pxではrailを縦積みにし、bottom navigationと重ならない。

既存global placeholder routeは削除する。Organizationをまだ選んでいない時のTodos / 引き継ぎ導線は`/organizations`へ向ける。旧fixtureの「田中 彩 → 佐藤 花子」や静的な空状態を実データ画面へ残さない。

## 10. エラーと再送

| 状況 | HTTP | UI |
| --- | ---: | --- |
| 未認証 | 401 | Loginへ |
| Organizationに所属しない | 403 | 組織を選び直す |
| Todo/Handoffが同じOrganizationにない | 404 | 見つからない |
| 別recipientへrequested済み | 409 | 現在の依頼を表示 |
| 既に別の終端状態 | 409 | 再取得して現在状態を表示 |
| recipientがinactive / assigneeが変化 | 409 | 引き継ぎを再確認 |
| DB一時失敗 | 503 | 再試行 |

## 11. テスト予算と実ブラウザ確認

自動テストはAPI integrationを中心に2本までとする。

1. current assigneeがrequestし、recipientがacceptするとHandoffとTodo担当が同一transactionで変わり、同じaccept再送は同じ結果を返す。
2. accept/reject競合は一方だけが成立し、別Organizationのsessionはdecisionできず、requesterはrequestedをcancelして再依頼できる。

UIの細かなbranch testは増やさない。fresh DBの実ブラウザで次を確認する。

- ownerがTodoを第三者へ依頼する。
- recipientが引き受け、自分のTodoへ現れる。
- 見送ると担当は変わらない。
- 依頼者が取消し、別recipientへ再依頼できる。
- 1280px / 390px、direct SSR、console warning/error 0、Organization分離。
- desktop/mobile navigationからglobal placeholderへ到達せず、Organization IDを保持する。

## 12. 対象外

- 管理者による強制担当変更
- 通知、Webhook、Queue、WebSocket
- 回答期限、自動失効、reminder
- Todo detail、完了操作、filter、sort
- Todo単位の完全な履歴画面
- Undo、コメントthread、添付
- RLS、汎用policy engine、Event Sourcing、audit/outbox
- requester Membership停止後の管理者によるrequested解除
