# Aimani AI v2 UX-firstプラットフォーム設計

- 日付: 2026-07-26
- 状態: UX-first方針反映済み
- 対象: 新規 `<repo-root>`
- 既存資産: `aimani-ai`、`aimani-ai-angular`、`aimani-ai-admin`、`BYARD`は読み取り専用

## 1. 最優先事項

初期ゴールは金融系システムのような完全性ではない。ユーザーが実際に画面を触りながら、次の体験とドメイン設計が正しいか確認できることを最優先する。

```text
ログイン
  -> 所属組織を開く
  -> 関係のある相手を選ぶ
  -> Todoを作る
  -> 相手へHandoffする
  -> 相手が承認または拒否する
  -> 担当と履歴が画面へ反映される
```

設計の将来拡張性は保つが、初期段階で網羅的テスト、過剰なセキュリティ層、非同期基盤、完全な監査機構は作らない。

## 2. 初期リリースの成功条件

- ブラウザ上で上記の導線を一通り操作できる
- UserはOrganizationから独立し、複数組織へMembershipで所属できる
- Relationship、Todo、Handoffが画面上で理解できる
- BrowserからDBや非公開APIへ直接アクセスしない
- Handoffの承認時に担当者が正しく切り替わる
- 未ログインと他組織の操作はAPIで拒否される
- 主要導線1本のPlaywright E2Eが通る
- Cloudflare previewでユーザーが触れる
- 既存Aimani AI/BYARDへ変更がない

## 3. 初期スコープから外すもの

以下は必要性が実体験から確認できるまで実装しない。

- PostgreSQL RLS
- Event Sourcing
- outbox / Cloudflare Queues
- Webhook Worker
- role変更履歴の完全保存
- 網羅的な状態遷移テスト
- coverage閾値
- mutation testing
- 全テーブルのTestcontainers検証
- SSO、SCIM、MFA
- メール確認とpassword reset
- 既存Aimani AIデータ移行
- 月次ヒアリング、Knowledge、通知、詳細監査ログ

ただし一般公開前には、メール確認、password reset、rate limit、RLSまたは同等のtenant防御、バックアップ/復旧を別のhardeningフェーズで判断する。

## 4. アーキテクチャ

```text
Browser
  |
  | same-origin
  v
TanStack Start Web Worker
  |  - SSR / Router / Server Functions
  |  - 画面用DTO composition
  |  - TanStack Query prefetch
  |
  | Service Binding + Hono RPC
  v
Private Hono API Worker
  |  - Better Auth
  |  - Awilix DI
  |  - authorization
  |  - command / query
  |  - Drizzle transaction
  v
Cloudflare Hyperdrive
  v
PlanetScale Postgres (Tokyo)
```

ローカル開発ではDocker ComposeのPostgreSQLを使用する。PlanetScaleとHyperdriveは画面導線がローカルで成立した後に作成する。

API Workerは`workers_dev = false`、`preview_urls = false`とし、Web WorkerのService Bindingから呼ぶ。認証URLもWeb Workerの`/api/auth/*`で受け、raw RequestをAPI Workerへ転送する。

## 5. モノレポ構成

```text
aimani-ai-v2/
├── apps/
│   ├── web/                       # TanStack Start / BFF / UI
│   └── api/                       # Hono / Auth / DI / DB access
├── packages/
│   ├── contracts/                 # Zod DTO
│   ├── api-client/                # Hono RPC client
│   ├── db/                        # Drizzle schema / migrations
├── docs/
└── tooling/
```

初期段階では細かいpackage分割を増やさない。Identity / Relationship / Todoは、最初のruntime consumerがAPI Workerだけである間は`apps/api`のdomain / application / infrastructureへ責務別に閉じる。2つ目のconsumerが現れた時点でpackage抽出を判断する。1on1 moduleはTodo/Handoffを触って境界を確認してから追加する。

## 6. 依存方向

```text
domain <- application <- infrastructure <- apps/api
```

- domainは純粋TypeScript
- applicationはuse caseとPortを持つ
- infrastructureはDrizzle repositoryを持つ
- API routeはuse case呼び出しとHTTP変換だけを行う
- Webはcontractsとapi-clientだけを利用する
- WebからDB/moduleをimportしない

依存境界はまず package exports と TypeScript project reference で表す。専用の検査ツールは、実際に越境が起きてから追加する。

## 7. DI

Awilixを採用し、`apps/api`のComposition Rootだけで使用する。domain/applicationはAwilixをimportしない。

```text
Root container
  - Clock
  - IdGenerator

Request scope
  - Env
  - Request
  - DB client
  - Better Auth
  - repositories
  - use cases
```

- `strict: true`
- requestごとにchild scopeを作る
- DB Clientをrequest終了時にcloseする
- domain/applicationはconstructorまたはdeps objectで依存を受ける
- 単体テストはDIコンテナを使わずfakeを直接渡せる

DIのための網羅的テストは作らない。Composition Rootが主要use caseをresolveでき、request終了時にDB Clientをcloseできるsmoke testだけを置く。

## 8. 認証・組織モデル

Better Auth coreを採用する。Organization Pluginは使わず、組織所属はドメインで管理する。Better Authの公式語彙と衝突させないため、`User`を組織非依存のログイン主体、`Account`をpassword / OAuthなどのcredentialとする。

```text
user                           # グローバルなログイン主体
account                        # password / OAuth credential
session
verification

organization
membership                     # userとorganizationを接続
relationship
```

UserはOrganizationが0件でも存在できる。Organizationを退会してもUserや他組織のMembershipを変更しない。

初期roleは`owner | manager | member`をMembershipに持つ。boolean role列は使わない。動的roleやrole履歴は実需要が出た時点で別テーブルへ切り出す。

初期previewは招待された検証ユーザーだけを対象とし、email/passwordでログインする。一般公開前の認証hardeningは別フェーズとする。

## 9. 初期データモデル

### Organization / Membership

```text
User 1 -- N Membership N -- 1 Organization
```

`membership`は`user_id`、`organization_id`、`role`、`status`を持つ。`UNIQUE(user_id, organization_id)`で重複所属を防ぐ。

### Relationship

```text
Relationship
  - organization_id
  - source_membership_id
  - target_membership_id
  - kind: manager_report | peer | supporter
```

初期UIでは「自分と関係のある相手」を一覧するために使う。

### Todo / Handoff

```text
Todo
  - organization_id
  - context_membership_id
  - creator_membership_id
  - title
  - description
  - status: open | completed
  - assignee_membership_id

Handoff
  - organization_id
  - todo_id
  - from_membership_id
  - to_membership_id
  - status: requested | accepted | rejected
  - requested_at
  - responded_at
```

`context_membership_id`はTodoが「誰との文脈で生まれたか」を表す不変のMembership IDであり、現在の担当者や認可境界を表さない。Relationship未設定のMemberともTodoを作れるため、nullableなRelationship IDを成立条件にしない。Handoffは`organization_id`を持ち、Todoとfrom/to Membershipを複合FKで同じOrganizationへ閉じる。requested HandoffはTodoごとに1件とし、承認時は1 transactionでrecipient・statusを再検証してHandoffをacceptedへ変更し、Todoの`assignee_membership_id`を相手へ更新する。完全なAssignment履歴は初期には作らず、Handoff行を最低限の履歴として画面表示する。

すべてのドメインテーブルに`organization_id`を持たせ、API queryでは必ずPrincipalのOrganization IDを条件へ含める。基本的なFK、UNIQUE、CHECKに加え、Organization越境を構造的に防ぐMembershipへの複合FKは使用する。RLSや汎用permission graphは初期には導入しない。

## 10. Web/BFFの責務

Web Workerは次を担当する。

- URL/search paramsのZod検証
- same-origin auth proxy
- Hono RPCによるAPI呼び出し
- TanStack Queryのprefetchと再取得
- pending/error/empty state
- 画面単位DTOのcomposition

Web WorkerはDBへ接続せず、認可の最終判断もしない。

初期画面は次の5つに限定する。

1. Login
2. Organization selector
3. Organization home / People
4. Person detail / Todo list
5. Handoff inbox

## 11. UI方針

- Tailwind CSS 4.3.3
- Base UI 1.6.0はDialog/Menuなど必要な箇所だけ
- Lucide React 1.27.0
- desktopは左navigation、mobileはbottom navigationで操作可能
- pending、empty、errorを必ず画面として用意する
- デザインシステム構築はせず、色・余白・文字サイズの小さなtokenだけ定義する
- Peopleを単なる名簿にせず、関係・未完了Todo・次のactionを同じ視線上に置く
- Handoffは依頼者、現在担当、引継ぎ先を結ぶ`relationship rail`で可視化する
- 既存Aimani AIのindigoを再解釈し、BYARDのgreenはsuccess/connectedへ限定する
- Manropeを見出し/utility、Noto Sans JPを本文に使う
- 色だけで状態を表さず、iconと日本語labelを併用する

最初から汎用TableやForm Builderを作らない。Todo/Handoffの画面を直接作り、2画面以上で同じ形が現れた時だけcomponentを共通化する。

色、typography、layout、motion、copy、accessibilityの具体値は [`docs/design/foundation.md`](../../design/foundation.md) を正本とする。既存画面からの移植判断は [`docs/product/legacy-ux-audit.md`](../../product/legacy-ux-audit.md) に記録する。

## 12. テスト予算

初期実装で必須にするテストは次だけとする。

- Todo/Handoffの主要happy path単体テスト1〜2本
- 他組織の操作を拒否するAPI integration test 1本
- Composition Root smoke test 1本
- LoginからHandoff承認までのPlaywright E2E 1本

細かな表示差分、全error branch、全DB制約をテストしない。実際にブラウザで触ったフィードバックを優先し、再発した不具合だけ回帰テストへ追加する。

## 13. 実装順

### Milestone 1: 触れる骨格

- monorepo
- TanStack Start画面
- Hono API health
- Awilix Composition Root
- local PostgreSQL
- Login画面

### Milestone 2: 人と関係

- User / Organization / Membership
- People一覧
- Person詳細

### Milestone 3: Todo/Handoff

- Todo作成・一覧
- Handoff Dialog
- Inboxで承認・拒否
- 画面への担当反映

### Milestone 4: Preview

- PlanetScale Postgres Tokyo
- Hyperdrive
- Cloudflare Web/API Workers
- 主要導線E2E
- ユーザーが実際に触るレビュー

次の1on1設計は、Milestone 4の操作感レビュー後に開始する。

## 14. 採用ライブラリ

| 領域 | 採用 |
| --- | --- |
| workspace | pnpm + Turborepo |
| Web/BFF | TanStack Start / Router / Query / Form |
| UI | Tailwind CSS / Base UI / Lucide React |
| API | Hono + Hono RPC |
| validation | Zod |
| auth | Better Auth core |
| DI | Awilix |
| DB | PostgreSQL / Hyperdrive |
| query/migration | node-postgres / Drizzle ORM / Drizzle Kit |
| tests | Vitest / Playwright |

正確なversion、採用理由、代替案、Cloudflare制約は [`ADR-0001`](../../decisions/0001-technology-selection-2026-07-26.md) を正本とする。

## 15. 後から固める判断点

実際に触った結果をもとに、次を必要な順番で判断する。

- Relationship中心の画面構成が使いやすいか
- TodoとHandoffを分けて見せるべきか
- 1on1をRelationship配下に置くべきか
- roleをMembershipの1値から複数割当にするか
- assignment履歴が必要か
- RLS/outbox/Queueが必要になる運用条件は何か
- 既存Aimani AIから何を移行し、何を捨てるか
