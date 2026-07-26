# Amidala v2 プラットフォーム・初期縦切り設計

- 日付: 2026-07-26
- 状態: ユーザーレビュー待ち
- 対象: 新規 `/Users/maa/Projects/gs/000_参照用/amidala-v2`
- 既存資産: `amidala`、`amidala-angular`、`amidala-admin`、`BYARD` は読み取り専用

## 1. 目的

稼働停止中のAmidalaを直接改修せず、新製品として再構築する。新製品の核は次の3領域とする。

1. 組織内の関係性（Relationship）
2. Todoと担当移譲（Todo / Handoff）
3. 1on1

最初の実装単位は、共通基盤とTodo/Handoffの縦切りである。1on1、月次ヒアリング、Knowledge、既存データ移行は後続の独立した設計・実装サイクルとする。

## 2. 成功条件

最初の実装単位は、以下をすべて満たしたとき完了とする。

- 既存4ディレクトリに変更がない
- TanStack Start Web Workerと非公開Hono API Workerが独立してデプロイできる
- BrowserからAPI Workerへ直接到達できない
- Web WorkerからService BindingとHono RPCでAPIを呼べる
- Better Authでサインアップ、ログイン、ログアウト、セッション確認ができる
- AccountはOrganizationが0件でも存在できる
- Membershipを通してのみAccountがOrganizationへ所属する
- Todoを作成し、相手へHandoffを申請し、承認または拒否できる
- API認可を迂回した直接リクエストが拒否される
- PostgreSQLのFK、CHECK、UNIQUE、tenant境界がテストで証明される
- Web、API、DB、ドメインのテストがCIで再現できる

## 3. 採用アーキテクチャ

```text
Browser
  |
  | same-origin HTTP / Server Function
  v
TanStack Start Web Worker
  |  - SSR / Route / Search Params
  |  - BFF DTO composition
  |  - TanStack Query prefetch
  |
  | Service Binding + Hono RPC
  v
Private Hono API Worker
  |  - Better Auth
  |  - authorization
  |  - command/query handlers
  |  - transaction / outbox
  |
  | node-postgres + Drizzle
  v
Cloudflare Hyperdrive (cache disabled)
  v
PlanetScale Postgres, AWS ap-northeast-1
```

API Workerは`workers_dev = false`、`preview_urls = false`とし、Service Bindingからのみ利用する。将来の公開Webhookは`apps/webhook`として別Workerを追加し、同じ非公開API WorkerをService Bindingで呼ぶ。

## 4. ディレクトリ構成

```text
amidala-v2/
├── apps/
│   ├── web/                 # TanStack Start / BFF
│   └── api/                 # Hono private Worker / Composition Root
├── packages/
│   ├── api-client/          # compiled Hono RPC client
│   ├── contracts/           # Zod input/output schemas and DTOs
│   ├── db/                  # Drizzle schema, migrations, DB primitives
│   ├── modules/
│   │   ├── identity/
│   │   ├── relationship/
│   │   ├── todo/
│   │   └── one-on-one/      # 後続フェーズで追加する最終形
│   ├── testkit/
│   └── config/
├── docs/
│   ├── adr/
│   ├── domain/
│   ├── migration/
│   └── superpowers/specs/
└── tooling/
```

各moduleは次の依存方向を守る。

```text
domain <- application <- infrastructure <- apps/api
```

- `domain`: 純粋TypeScript。I/O、Hono、Drizzle、Awilixをimportしない
- `application`: commands、queries、Port interface、Result型
- `infrastructure`: PostgreSQL repositoryなどPortの実装
- `apps/api`: Hono route、認証、DI Composition Root、Cloudflare binding
- `apps/web`: `contracts`と`api-client`のみ利用し、moduleやDBをimportしない

初期scaffoldでは`identity`、`relationship`、`todo`だけを作る。空の`one-on-one` packageは作らず、Phase Cの設計承認後に追加する。

## 5. DI設計

DIコンテナにはAwilixを採用する。TSyringeとInversifyはdecoratorとreflection metadataを要求するため採用しない。typed-injectは軽量だが、今回必要なrequest scopeとlifetime leak検査をAwilixほど明示的に提供しないため採用しない。

Awilixは`apps/api`のComposition Rootだけで使用する。domain/applicationのクラスと関数はAwilixを知らず、通常のconstructor引数またはdeps objectで依存を受け取る。

```text
Root container
  singleton: Clock, IdGenerator, policy definitions
  ※ I/Oオブジェクトを登録しない

Request scope
  scoped: Env, Request, Principal, pg Client, UnitOfWork
  scoped: repositories, command handlers, query handlers
```

必須設定は次の通り。

- `strict: true`
- requestごとに`createScope()`する
- DB clientやRequestをsingletonへ注入しない
- request終了時にscopeをdisposeし、DB clientをcloseする
- singletonは状態を持たない純粋なものに限定する
- テストは原則としてuse caseへfake Portを直接注入する
- route統合テストではtest用scopeを構成して差し替える

DIの受入テストでは、短いlifetimeの依存をsingletonへ注入した登録がstrict modeで失敗することも確認する。

## 6. 認証と組織所属

Better Auth coreを採用するが、Organization Pluginは初期リリースでは使用しない。Organization、Membership、Roleは製品の中核ドメインであり、認証ライブラリのスキーマとライフサイクルへ従属させない。

```text
auth schema (Better Auth managed)
├── accounts             # Better Auth user model。グローバルなログイン主体
├── auth_identities      # Better Auth account model。password/OAuth provider
├── sessions
└── verifications

app schema (domain managed)
├── organizations
├── memberships
├── organization_roles
├── membership_role_assignments
└── relationships
```

Better Authの`user` modelを`accounts`、providerの`account` modelを`auth_identities`へ明示的にrenameする。生成スキーマはBetter Auth CLIで生成するが、適用はDrizzle migrationへ統合し、productionでBetter Auth CLIによる自動migrationは行わない。

`memberships.account_id`は`auth.accounts.id`を参照する。Organization解約・退職はMembershipを無効化し、Accountと他OrganizationのMembershipには触れない。Account自体の削除は本人によるアカウント削除ユースケースとして別に扱う。

Organization選択はURLまたはBFF入力として渡す。CookieやURLのOrganization IDは権限の根拠にせず、APIが毎回Membershipを検証する。

### 認証リクエスト

```text
Browser /api/auth/*
  -> Web Worker same-origin proxy
  -> API Service Binding
  -> Better Auth handler
  -> auth schema
```

OAuthを追加した場合も公開callback URLはWeb Workerとし、raw Request/ResponseをAPI Workerへ中継する。初期実装はemail/passwordのみとする。

初期previewは招待された検証ユーザーだけを対象とし、email verificationを必須にしない。一般公開前にはtransactional email provider、email verification、password reset、auth endpointのrate limitを別のセキュリティゲートとして実装し、未完了ならproduction公開しない。

## 7. 認可境界

TanStack Routerの`beforeLoad`は画面UXのために使うが、セキュリティ境界にはしない。APIの各command/queryで次を解決する。

```text
Session
  -> Account
  -> requested Organization
  -> active Membership
  -> assigned Roles
  -> resource/relationship policy
  -> Principal
```

Browser入力から`accountId`、`authorType`、`role`を受け取らない。操作主体はSessionから決定する。Web BFFも認可結果をキャッシュして権限根拠にはしない。

## 8. PostgreSQL設計原則

採用する原則は次の通り。

1. 概念設計、論理設計、物理設計の順に検討し、必要なら前段へ戻る
2. 正本には観測・入力された事実を保存する
3. ResourceとEvent/履歴をライフサイクルで分離する
4. 導出値を保存する場合はprojectionと明記し、再生成可能にする
5. FK、UNIQUE、CHECK、transactionで不正状態をDBでも拒否する
6. nullableとindex数は設計レビューのシグナルであり、一律禁止にしない
7. JSONBは構造が未確定または外部payloadの保存に限定する
8. Full Event Sourcingは採用しない

テナントデータには必ず`organization_id`を持たせる。関連テーブルには可能な限り複合FKを使い、異なるOrganizationのMembershipやRelationshipを接続できないようにする。

API認可を第一境界としつつ、app schemaにはPostgreSQL RLSを適用する。migration roleとruntime roleを分け、runtime roleは`BYPASSRLS`を持たない。transaction内で検証済みのAccount IDとOrganization IDを`SET LOCAL`し、policyへ渡す。RLSを理由にapplication認可を省略してはならない。

Principal解決も同じtransaction内で行う。Better Authが検証したAccount IDと、リクエストされたOrganization IDを`SET LOCAL`した後、RLS下で`memberships`を検索する。Organization IDは検索範囲を狭める値にすぎず、active Membershipが取得できた場合だけPrincipalを成立させる。以降のrepository queryはすべてこのtransactionとPrincipalを受け取る。

## 9. 初期データモデル

### Identity / Organization

```text
auth.accounts
  1 -- N memberships N -- 1 organizations

memberships
  1 -- N membership_role_assignments N -- 1 organization_roles
```

- AccountはOrganization非依存
- Membershipは`active / suspended / left`の状態を持つ
- roleはboolean列にせず、割当行として表す
- Membershipの状態変更とRole変更は履歴を残す

### Relationship

Relationshipは同一Organizationの2つのMembership間に張る。順序が意味を持つ関係は`source_membership_id`と`target_membership_id`を使う。対称な関係を同じテーブルへ無理に混ぜない。

### Todo / Handoff

```text
todos
├── current status
├── creator membership
└── optional relationship

todo_assignments
└── 現在・過去の担当期間

todo_handoffs
├── from membership
├── to membership
├── requested / accepted / rejected / cancelled
└── request/respond timestamps
```

Handoff承認は単一transactionで次を行う。

1. pending Handoffをlockして再確認
2. Handoffをacceptedへ遷移
3. 現在Assignmentを終了
4. 新しいAssignmentを作成
5. outboxへ`TodoHandedOff`をINSERT

二重承認や異なる相手による承認はDB制約とcommand handlerの双方で拒否する。

## 10. CQRS-liteとイベント

`commands/`と`queries/`をコード上で分けるが、初期は同じPostgreSQLを使う。

- Commandはtransaction、domain invariant、outboxを担当する
- Queryは画面用DTOを返し、domain entityをそのまま返さない
- Web BFFは複数Queryの画面単位compositionを担当できる
- API routeはhandler呼び出しとHTTP変換に限定する

重要なdomain eventだけ`outbox_events`へ保存する。outboxはCloudflare Queueへ配送し、成功後にdelivery状態を更新する。通知失敗によってdomain transactionをrollbackしない。

APIはcommit後にQueue送信をbest effortで試みる。送信失敗またはWorker中断に備え、API Workerのscheduled handlerが未配送outboxを定期走査して再送する。Queue messageとconsumerは`outbox_event_id`を冪等キーにし、少なくとも1回配送による重複処理を無害化する。domain transaction内でQueueへ直接送信しない。

## 11. TanStack Start BFF

Web Workerが担当するものは次の通り。

- route/search paramsをZodで検証してQuery inputへ変換
- Session cookieを保持したsame-origin endpoint
- Hono RPCを使ったAPI呼び出し
- Page DTOのcomposition
- TanStack Queryの`queryOptions`とloader prefetch
- API errorからroute error/pending UIへの変換

Web Workerは禁止事項は次の通り。

- PostgreSQL/Hyperdriveへ直接接続する
- Drizzle schemaやdomain moduleをimportする
- BrowserへHono Service Binding clientを公開する
- 認可やdomain invariantを最終決定する

## 12. ライブラリ

| 領域 | 採用 |
| --- | --- |
| workspace | pnpm workspaces + Turborepo |
| Web/BFF | TanStack Start / Router / Query / Form |
| API | Hono + Hono RPC |
| validation | Zod |
| auth | Better Auth core/minimal |
| DI | Awilix strict mode |
| database | PlanetScale Postgres Tokyo + Hyperdrive |
| driver | node-postgres |
| query/migration | Drizzle ORM + Drizzle Kit |
| async | Cloudflare Queues + PostgreSQL outbox |
| file | Cloudflare R2 |
| unit tests | Vitest |
| Worker tests | @cloudflare/vitest-pool-workers |
| DB integration | Testcontainers PostgreSQL |
| browser E2E | Playwright |
| lint/boundary | ESLint + typescript-eslint + dependency-cruiser |
| format | Prettier |
| IDs | UUIDv7 |

依存バージョンはscaffold時点のstableを調査して固定する。Better Authはminor versionも固定し、更新はschema diffと認証E2Eを通して行う。

## 13. エラー設計

application層の想定内失敗は、外部Resultライブラリを使わずdiscriminated unionで返す。

```text
{ ok: true, value }
{ ok: false, error: { _tag, ...details } }
```

route adapterが`_tag`をHTTP statusと公開error codeへ変換する。DB例外や予期しない例外の内部情報は返さず、correlation IDだけを返す。認証不足は401、Membership/権限不足は403、競合は409、入力不正は400または422として一貫させる。

## 14. テスト戦略

### Domain/Application

- pure unit test
- fake repository、fake clock、deterministic ID generatorを直接注入
- Handoff状態遷移の全分岐をtable-driven testで検証

### PostgreSQL

- Testcontainersで実PostgreSQLを起動
- migrationを先頭から適用
- FK、CHECK、UNIQUE、RLS、transaction rollbackを検証
- 異なるOrganization間の参照がDBでも拒否されることを確認

### Workers

- Cloudflare Vitest integrationでBindingsとruntime差異を検証
- Web/APIの単体Workerテスト
- Service Bindingを含む複数Workerの統合はlocal WranglerまたはPlaywright E2Eで検証

### E2E

- signup -> organization作成 -> membership作成
- Todo作成 -> Handoff申請 -> 相手が承認
- 拒否、二重承認、他組織アクセス、未認証アクセス
- logout後の直接API呼び出し

## 15. デプロイとmigration

デプロイ順は互換性を維持する。

1. backward-compatible DB migration
2. API Worker
3. Web Worker
4. Queue consumer
5. 不要カラム削除は別リリース

API Workerを先にデプロイし、Web Workerを後から切り替える。破壊的migrationとコード切替を同じリリースで行わない。rollback時にも旧APIが新schemaで動けるexpand/contract方式を使う。

## 16. 既存Amidalaの扱い

- 既存コード、DB、migration、設定は変更しない
- 必要な仕様は読み取り調査し、新製品のdocsへ出典付きで再定義する
- 既存schemaをそのまま新DBへ複製しない
- 既存データ移行は新schemaと機能が安定した後の独立プロジェクトとする
- 現段階では既存production credentialやDBを使用しない

## 17. フェーズ分割

### Phase A: Platform foundation

- monorepo、CI、Workers、Service Binding
- PostgreSQL、Hyperdrive、Drizzle migration
- Better Auth、Account、Organization、Membership
- Awilix Composition Root

### Phase B: Todo/Handoff vertical slice

- Relationship最小モデル
- Todo、Assignment、Handoff
- Web route、BFF Query、API commands/queries
- outbox、テスト、preview deployment

### Phase C以降

- 1on1
- Monthly Hearingとreporting projection
- Knowledge/Advice
- notification/integration
- 既存データの選択的migration

Phase C以降は、それぞれ別の設計書と実装計画を作る。

## 18. 根拠資料

- Linear: WF ストーリー→テーブル設計ガイド Part1 / Part2
- Linear: Better Auth統合チェックリスト
- Linear: ADR-V2-006 Effect-TS見送り
- BYARD: Account / Membership / Organization、Definition / Executionモデル
- そーだい: RDB THE Right Way
- Cloudflare: Hyperdrive、Service Bindings、Workers testing
- Better Auth: PostgreSQL、Hono、database schema
- TanStack Start: authentication、hosting、server functions
- Hono: RPC custom fetch / Service Binding
- Drizzle: PostgreSQL、migration
