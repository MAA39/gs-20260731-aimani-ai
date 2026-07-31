# アイマニAI PlanetScale・Cloudflare データベース設計

**Status:** 採用済み。外部資産の作成前に本書を実装正本とする。

## 目的

アイマニAIの公開デモを、既存の業務用・他製品用データベースへ一切触れずに公開する。画面を操作したときの応答性と、現在のPostgreSQL・Drizzle・Awilix DI設計を優先する。

## 採用判断

- Cloudflareダッシュボード経由でPlanetScale Postgresを新規契約する。
- Database nameは `gs-20260731-aimani-ai` とする。
- EngineはPostgres、regionはAWS `ap-northeast-1`（Tokyo）とする。
- 初期clusterはPS-5 Single Nodeとし、HA replica、専用PgBouncer、development branchは作成しない。
- PlanetScaleとAPI Workerの間はCloudflare Hyperdrive `gs-20260731-aimani-ai-db` を使う。
- Hyperdrive query cacheは無効化する。
- D1は導入しない。
- SupabaseのCLI、API、接続文字列、環境変数、既存プロジェクトは使用しない。

PlanetScaleをCloudflareダッシュボードから作成した場合、PlanetScale利用料はCloudflare請求へ統合される。Cloudflare公式はPlanetScale PostgresとHyperdriveの直接統合を提供している。

- https://developers.cloudflare.com/hyperdrive/planetscale/
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/planetscale-postgres/
- https://planetscale.com/docs/plans/regions
- https://planetscale.com/docs/postgres/pricing

## アーキテクチャ

```text
Browser
  │
  ▼
TanStack Start Web Worker
  │ Service Binding / RPC (`API`)
  ▼
Hono API Worker (`gs-20260731-aimani-ai-api`)
  │ `env.HYPERDRIVE.connectionString`
  ▼
Cloudflare Hyperdrive (`gs-20260731-aimani-ai-db`, cache disabled)
  │ PostgreSQL direct connection
  ▼
PlanetScale Postgres (`gs-20260731-aimani-ai`, Tokyo, PS-5 Single Node)
```

Cloudflare WorkersにはPostgreSQLを内包させない。API Workerは既存の`pg`とDrizzleを維持し、request-scoped Awilix container内で接続を生成・破棄する。Hyperdriveが下位の接続プールを管理する。

## コード境界

- `apps/web`: TanStack Start、画面、Server Function、API WorkerへのRPCだけを担当する。
- `apps/api`: Hono、Better Auth、UseCase、Repository、request scope DIを担当する。
- `packages/db`: Drizzle schema、migration、`pg` client生成を担当する。
- `packages/contracts`: Web/API間の型付き契約を担当する。
- DB provider固有情報は`apps/api/wrangler.jsonc`のHyperdrive bindingと運用Docsに閉じ込める。

既存の`resolveDatabaseUrl`は本番で`HYPERDRIVE.connectionString`を優先し、ローカルだけ`DATABASE_URL`へfallbackする。PlanetScale専用SDKは追加しない。

## Cloudflare資産

- Web Worker: `gs-20260731-aimani-ai-web`
- API Worker: `gs-20260731-aimani-ai-api`
- Service Binding: `API`
- Hyperdrive: `gs-20260731-aimani-ai-db`
- Hyperdrive Binding: `HYPERDRIVE`

API Workerは外部公開せず、Web WorkerのService Bindingからのみ呼ぶ。Web Workerだけを公開URLとして案内する。

## DB roleとsecret

PlanetScale側では用途を分離する。

1. migration role: schema変更とseed投入に使う。接続文字列はローカル作業時だけ注入し、Gitへ保存しない。
2. runtime role: Hyperdriveからのアプリ実行に使う。読み書きに必要な権限だけを付与する。

Better Authには、この製品専用の新しい`BETTER_AUTH_SECRET`を生成する。添付資料にある既存製品用`AIMANI_BETTER_AUTH_SECRET`と`AIMANI_DATABASE_URL`は使用しない。Supabase関連の全変数も使用しない。

Cloudflare操作で利用できる既存資格情報は`CLOUDFLARE_ACCOUNT_ID`と`CLOUDFLARE_API_TOKEN`に限定する。実値はDocs、shell history、Wrangler設定、GitHubへ保存しない。

## キャッシュと整合性

ログイン、session、membership、Todo、Handoff、Process Labは、書き込み直後に最新状態を読む必要がある。Hyperdriveはアプリケーションの書き込み時にキャッシュ済みreadを自動失効しないため、初期構成ではquery cacheを全面的に無効化する。

公開後に計測して必要になった場合のみ、一覧表示などread-only用途へ別のcache-enabled Hyperdriveを追加する。認証・権限・責任移管は常にcache-disabled経路を使う。

## Migrationとseed

1. PlanetScale databaseとmigration roleをCloudflare/PlanetScale dashboardで作成する。
2. migration roleのdirect PostgreSQL URLを一時的な環境変数として渡す。
3. 既存Drizzle migrationを適用する。
4. 公開デモ専用seedを一度だけ投入する。
5. runtime roleを作成し、Hyperdriveへ接続する。
6. migration接続文字列をローカル環境から破棄する。

公開デモ資格情報はREADME記載の共有アカウントを使い、個人情報・顧客情報を保存しない。デモ状態を戻す運用は、全DB削除ではなく専用seed resetに限定する。

## エラー処理

- DB接続失敗はAPI Workerで内部エラーとして記録し、画面には再試行可能な日本語メッセージを返す。
- Hyperdrive binding未設定は起動時またはrequest scope生成時に設定エラーとして失敗させる。
- migration失敗時はWorkerをデプロイせず停止する。
- seed失敗時は中途半端な公開を避け、データ確認後に再実行する。

## 検証

公開前に以下だけを必須とする。

- API unit 17件
- Web 23件
- PostgreSQL integration 30件
- demo seed 2件
- production build
- Wrangler API/Web dry-run
- PlanetScale経由でlogin、organization、People、Todo、Handoff、Today、Team Work、Process Labのsmoke test
- desktopとmobile幅の主要画面確認

金融系の網羅的テストや負荷試験は行わない。触れるデモとして主要導線が成立することを優先する。

## 課金と停止

PlanetScaleはDBを作成した時点から、クエリがなくても削除まで日割りで課金される。作成直前にCloudflare dashboardでTokyo、PS-5 Single Node、表示料金を確認する。

デモを停止するときは次の順序にする。

1. Web/API Workerの公開導線を停止する。
2. Hyperdrive `gs-20260731-aimani-ai-db` を削除する。
3. 必要なデータをexportする。
4. PlanetScale database `gs-20260731-aimani-ai` だけを削除する。
5. 他のWorker、DB、Hyperdriveを削除しない。

## 非対象

- Supabaseへの接続、調査、作成、変更、削除
- 既存の他製品DB、Worker、Hyperdrive、Better Auth secretの再利用
- D1への移行
- HA構成、read replica、複数region、development branch
- DB provider変更に伴うdomain/application層のリファクタリング
