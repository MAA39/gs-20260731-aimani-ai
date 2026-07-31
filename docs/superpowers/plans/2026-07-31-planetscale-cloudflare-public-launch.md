# アイマニAI PlanetScale・Cloudflare公開 Implementation Plan

> **停止（2026-07-31）:** 提出を優先してDBなしmock API方式へ変更したため、本計画のPlanetScale/Hyperdrive作成タスクは実行しない。公開Web Workerは `gs-20260731-aimani-ai-web`。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アイマニAIを、他製品や業務用Supabaseへ一切触れず、専用PlanetScale PostgresとCloudflare Workersで操作可能な公開デモとして提供する。

**Architecture:** TanStack Start Web WorkerからService Binding `API` で非公開Hono API Workerを呼び、API Workerはcache-disabled Hyperdrive経由でPlanetScale Postgresへ接続する。既存のDrizzle、Better Auth、Awilix request scope DI、DDD/CQRS-lite境界を維持し、プロバイダ固有情報はWorker設定と運用Docsだけに閉じ込める。

**Tech Stack:** TypeScript 7、React 19、TanStack Start/Router/Query、Hono、Better Auth 1.6、Awilix 13、Drizzle ORM 0.45、node-postgres 8.22、PostgreSQL、Cloudflare Workers/Hyperdrive、PlanetScale Postgres、pnpm/Turborepo、Vitest。

## Global Constraints

- 実装正本は `docs/superpowers/specs/2026-07-31-planetscale-cloudflare-database-design.md` とする。
- SupabaseのCLI、API、接続文字列、環境変数、既存プロジェクトへアクセスしない。`SUPABASE_*`、`AIMANI_DATABASE_URL`、`AIMANI_BETTER_AUTH_SECRET` は使用禁止とする。
- D1、PlanetScale専用SDK、専用PgBouncerは追加しない。Hyperdriveが接続プールを担当する。
- 新規資産だけを作る。DBは `gs-20260731-aimani-ai`、Hyperdriveは `gs-20260731-aimani-ai-db`、Workersは `gs-20260731-aimani-ai-api` / `gs-20260731-aimani-ai-web` とする。
- PlanetScaleはAWS `ap-northeast-1`（Tokyo）、PS-5 Single Node、HAなし、development branchなしで開始する。
- API Workerは `workers_dev: false` のまま外部公開しない。Web Workerだけを公開する。
- secrets、接続文字列、token実値は標準出力、shell history、Git、Docs、Wrangler設定へ残さない。ローカル一時保管にはmacOS Keychainを使う。
- production DBに対してintegration testや破壊的resetを実行しない。migrationと確認済みの冪等demo seedだけを許可する。
- 触れるデモを優先し、金融系の網羅テスト、負荷試験、過剰な抽象化は追加しない。
- PlanetScale作成直前にCloudflare画面のregion、plan、日額・月額表示を人間へ提示する。承認済み条件と異なる場合は作成せず停止する。
- 外部操作前後に対象名を照合し、削除・変更はこの計画で作成した専用資産だけに限定する。

---

### Task 1: 公開seedを開発用命名から分離する

**Files:**
- Create: `apps/api/src/demo/seed-demo-data.ts`
- Modify: `apps/api/src/dev/seed.ts`
- Modify: `apps/api/src/dev/reset-demo-database.ts`
- Delete: `apps/api/src/dev/seed-development-data.ts`
- Test: `apps/api/src/dev/demo-seed.integration.test.ts`

**Interfaces:**
- Produces: `seedDemoData(databaseUrl: string): Promise<void>`
- Preserves: demo users、organizations、Todo、Process Labの固定fixtureと冪等性
- Preserves: shared login `owner@aimani-ai.local` / `aimani-ai-demo-2026`

- [ ] `git status --short` が空であることを確認する。空でなければ既存差分を分類し、今回の変更へ混ぜない。
- [ ] `apps/api/src/dev/seed-development-data.ts` を `apps/api/src/demo/seed-demo-data.ts` へ移し、export名を `seedDemoData` に変更する。fixtureの値や件数は変更しない。
- [ ] `apps/api/src/dev/seed.ts` と `apps/api/src/dev/reset-demo-database.ts` のimport・呼出名を `seedDemoData` に更新する。
- [ ] `rg -n 'seedDevelopmentData|seed-development-data' apps/api/src` が0件になることを確認する。
- [ ] ローカルPostgreSQL起動後に `pnpm db:demo:reset && pnpm --filter @aimani-ai/api test:demo` を実行し、2件通ることを確認する。
- [ ] `git diff --check` を実行する。
- [ ] `git add apps/api/src && git commit -m "refactor: separate reusable demo seed"` でコミットする。

### Task 2: production seedの接続先ガードをTDDで追加する

**Files:**
- Create: `apps/api/src/operations/public-demo-target.ts`
- Create: `apps/api/src/operations/public-demo-target.test.ts`
- Create: `apps/api/src/operations/seed-public-demo.ts`
- Modify: `apps/api/tsconfig.test.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `assertPublicDemoTarget(databaseUrl: string, confirmation: string): URL`
- Requires: `PUBLIC_DEMO_SEED_CONFIRMATION=gs-20260731-aimani-ai`
- Accepts only: TLS PlanetScale direct URL whose hostname ends with `.horizon.psdb.cloud`, port is `5432`, and database pathname is `/postgres`
- Rejects: localhost、Supabase hosts、pooler URL、他provider、別DB名、confirmation不一致
- Produces CLI: `pnpm db:public:seed`

- [ ] table-driven unit testを先に書き、正しいPlanetScale URLだけが通り、localhost、`*.supabase.co`、port 6543、pathname `/aimani_ai_demo`、confirmation不一致が明示的エラーになることを定義する。テスト用URLのpasswordは架空値だけを使う。
- [ ] `pnpm --filter @aimani-ai/api test -- public-demo-target.test.ts` を実行し、未実装で失敗することを確認する。
- [ ] `assertPublicDemoTarget` をURL構文解析で実装する。文字列の部分一致だけで許可せず、protocol、hostname、port、pathname、confirmationを個別に検査する。
- [ ] エラーメッセージに接続文字列、username、passwordを含めない。
- [ ] `seed-public-demo.ts` を作り、`DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`PUBLIC_DEMO_SEED_CONFIRMATION` の存在確認、`assertPublicDemoTarget`、`seedDemoData` の順に実行する。migrationはこのCLIへ混在させない。
- [ ] root `package.json` に `"db:public:seed": "node --import tsx apps/api/src/operations/seed-public-demo.ts"` を追加する。
- [ ] `pnpm --filter @aimani-ai/api test -- public-demo-target.test.ts` を再実行して通ることを確認する。
- [ ] `DATABASE_URL='postgresql://postgres:fake@127.0.0.1:54329/aimani_ai_demo' BETTER_AUTH_SECRET='fake-secret-at-least-32-characters' BETTER_AUTH_URL='http://localhost:5173' PUBLIC_DEMO_SEED_CONFIRMATION='gs-20260731-aimani-ai' pnpm db:public:seed` がDB接続前に拒否されることを確認する。
- [ ] `git diff --check` と `pnpm --filter @aimani-ai/api test` を実行する。
- [ ] `git add package.json apps/api/src apps/api/tsconfig.test.json && git commit -m "feat: guard public demo seeding"` でコミットする。

### Task 3: 明示的なmigration URLを安全に受け取れるようにする

**Files:**
- Modify: `packages/db/src/migrate.ts`
- Create: `packages/db/src/migration-database-url.ts`
- Create: `packages/db/src/migration-database-url.test.ts`
- Modify: `packages/db/package.json`
- Create: `packages/db/tsconfig.test.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `resolveMigrationDatabaseUrl(explicitUrl: string | undefined, loadDevelopmentUrl: () => string | undefined): string`
- Local behavior: `DATABASE_URL` が未設定の場合だけ `apps/api/.dev.vars` を読む
- Production behavior: 呼出元が注入した `DATABASE_URL` を優先し、`.dev.vars` で上書きしない

- [ ] `packages/db/package.json` にVitestをdevDependency、`"test": "tsc -p tsconfig.test.json && vitest run"` をscriptとして追加し、test用tsconfigを作る。
- [ ] `packages/db/src/migration-database-url.test.ts` に「明示URLを優先」「明示URLなしではdev vars loaderを一度呼ぶ」「最終的にURLがなければsecret非表示のエラー」の3ケースを先に書く。
- [ ] `pnpm --filter @aimani-ai/db test` を実行し、`migration-database-url.ts` がないため失敗することを確認する。
- [ ] `resolveMigrationDatabaseUrl(explicitUrl, loadDevelopmentUrl)` を実装する。`packages/db/src/migrate.ts` から渡すcallbackは `loadEnvFile(resolve(process.cwd(), 'apps/api/.dev.vars'))` の後に `process.env.DATABASE_URL` を返す。
- [ ] root `package.json` の `db:migrate` から `--env-file=apps/api/.dev.vars` を外し、migration本体のfallbackへ一本化する。
- [ ] `pnpm db:migrate` がローカル `.dev.vars` で従来どおり動くことを確認する。
- [ ] 架空の明示URLを渡したunit testで `.dev.vars` のURLへ差し替わらないことを確認する。実DBへの接続はmockする。
- [ ] `git diff --check && pnpm --filter @aimani-ai/db test && pnpm build` を実行する。
- [ ] `git add package.json packages/db && git commit -m "fix: preserve explicit migration database URL"` でコミットする。

### Task 4: デプロイDocsをPlanetScale正本へ更新する

**Files:**
- Modify: `docs/operations/deployment.md`
- Modify: `README.md`
- Create: `docs/operations/planet-scale-runbook.md`

**Interfaces:**
- Produces: 作成、migration、seed、deploy、smoke、停止の一貫したrunbook
- Records names: `gs-20260731-aimani-ai`、`gs-20260731-aimani-ai-db`、`gs-20260731-aimani-ai-api`、`gs-20260731-aimani-ai-web`

- [ ] `docs/operations/deployment.md` のSupabase記述を削除し、PlanetScale Postgres + Hyperdriveの作成順序へ置き換える。
- [ ] `planet-scale-runbook.md` にmigration roleとruntime roleの分離、cache disabled、direct 5432、TLS必須、Keychain service名を記載する。
- [ ] Keychain service名を `gs-20260731-aimani-ai-migration-url` と `gs-20260731-aimani-ai-better-auth-secret` に固定する。
- [ ] 接続URLを値やprocess引数へ表示せず保存する手順として `security add-generic-password -a postgres -s gs-20260731-aimani-ai-migration-url -U -w` を実行し、promptへCloudflare画面からCopyした値を貼り、直後に `printf '' | pbcopy` でclipboardを消す方法を記載する。
- [ ] 専用Better Auth secretは `openssl rand -base64 32 | pbcopy`、`security add-generic-password -a worker -s gs-20260731-aimani-ai-better-auth-secret -U -w`、promptへ貼付、`printf '' | pbcopy` の順で、terminalとprocess引数へ値を出さず保存する方法を記載する。
- [ ] migration、guarded seed、Hyperdrive cache無効化、API→Web deploy、停止・専用資産だけの削除順を記載する。
- [ ] READMEのアーキテクチャをPlanetScaleへ更新し、公開URLは実deploy完了まで未記載のままにする。
- [ ] `rg -ni 'supabase|AIMANI_DATABASE_URL|AIMANI_BETTER_AUTH_SECRET' README.md docs/operations docs/superpowers/plans/2026-07-31-planetscale-cloudflare-public-launch.md` を実行し、禁止事項の説明以外に利用手順がないことを確認する。
- [ ] `git diff --check` を実行する。
- [ ] `git add README.md docs/operations && git commit -m "docs: add PlanetScale deployment runbook"` でコミットする。

### Task 5: Cloudflare経由で専用PlanetScaleを作成しmigrationする

**Files:**
- Modify: `docs/operations/planet-scale-runbook.md`（実行日、表示料金、region、plan、resource IDを値がsecretでない範囲で記録）

**Interfaces:**
- Produces: PlanetScale Postgres `gs-20260731-aimani-ai`
- Produces: migration roleのdirect PostgreSQL URL（Keychainだけに保存）
- Applies: `packages/db/drizzle` の全migration

- [ ] `browser:control-in-app-browser` skillを読み、既存ログインセッションを使ってCloudflare dashboardを開く。
- [ ] Workers & PagesのPlanetScale integrationから新規Postgres作成画面へ進み、名前 `gs-20260731-aimani-ai`、AWS `ap-northeast-1`（Tokyo）、PS-5 Single Node、HAなし、development branchなしを選ぶ。
- [ ] 作成ボタンを押す前に、画面に表示された日額・月額、region、planをユーザーへ提示する。条件が異なる場合は停止し、一致した場合だけ最終承認後に作成する。
- [ ] 作成後、CloudflareとPlanetScaleの一覧でDB名を再照合し、既存DBを操作していないことを確認する。
- [ ] default/migration roleのdirect primary接続URL（port 5432、database `postgres`、TLS有効）をCopyし、`security add-generic-password -a postgres -s gs-20260731-aimani-ai-migration-url -U -w` のpromptへ貼ってKeychainへ保存する。保存直後に `printf '' | pbcopy` でclipboardを消し、terminal本文やprocess引数へ値を出さない。
- [ ] URLのsecretを表示せず、hostname suffix、port、pathnameだけをNodeスクリプトで検証する。`.horizon.psdb.cloud`、`5432`、`/postgres` 以外なら停止する。
- [ ] `DATABASE_URL="$(security find-generic-password -a postgres -s gs-20260731-aimani-ai-migration-url -w)" pnpm db:migrate` でDrizzle migrationを適用する。
- [ ] PlanetScale consoleでschema/table一覧だけを確認し、個人情報や他製品tableが存在しないことを確認する。
- [ ] 実行日、region、plan、画面の料金、secretではないDB識別情報をrunbookへ記録する。
- [ ] `git add docs/operations/planet-scale-runbook.md && git commit -m "docs: record dedicated PlanetScale database"` でコミットする。

### Task 6: runtime roleとcache-disabled Hyperdriveを接続する

**Files:**
- Modify: `apps/api/wrangler.jsonc`
- Modify: `docs/operations/planet-scale-runbook.md`

**Interfaces:**
- Produces: PlanetScale runtime role with read/write only
- Produces: Hyperdrive `gs-20260731-aimani-ai-db`
- Produces binding: `HYPERDRIVE` with actual Hyperdrive ID

- [ ] PlanetScaleでruntime roleを作成し、アプリが必要とする既存schema/tableへのread/write権限だけを与える。schema変更権限は与えない。
- [ ] Cloudflare integrationが自動作成したHyperdriveを `pnpm --filter @aimani-ai/api exec wrangler hyperdrive list` で確認する。未作成ならCloudflare dashboardからruntime roleを使って `gs-20260731-aimani-ai-db` を作る。
- [ ] 一覧で名前 `gs-20260731-aimani-ai-db` を一意に特定し、別HyperdriveのIDを使わない。
- [ ] 一覧で確認した専用IDを `AIMANI_HYPERDRIVE_ID` へ設定し、空でないことを `test -n "$AIMANI_HYPERDRIVE_ID"` で検証する。IDはsecretではないが、名前との対応を二重確認する。
- [ ] `pnpm --filter @aimani-ai/api exec wrangler hyperdrive update "$AIMANI_HYPERDRIVE_ID" --caching-disabled` を実行する。command historyへ接続文字列を含めない。
- [ ] `apps/api/wrangler.jsonc` に `hyperdrive` 配列を追加し、bindingを `HYPERDRIVE`、idを `AIMANI_HYPERDRIVE_ID` に保持したUUID文字列そのものへ設定する。環境変数名や`$`は設定ファイルへ書かない。
- [ ] `wrangler hyperdrive get` でcaching disabledと専用PlanetScale originを確認し、接続credentialはDocsへ転記しない。
- [ ] Hyperdrive IDとcache disabled確認日をrunbookへ記録する。
- [ ] `pnpm --filter @aimani-ai/api exec wrangler deploy --dry-run && git diff --check` を実行する。
- [ ] `git add apps/api/wrangler.jsonc docs/operations/planet-scale-runbook.md && git commit -m "chore: bind dedicated PlanetScale Hyperdrive"` でコミットする。

### Task 7: 専用認証secretと公開demo seedを投入する

**Files:**
- Modify: `apps/api/wrangler.jsonc`
- Modify: `docs/operations/planet-scale-runbook.md`

**Interfaces:**
- Consumes: Cloudflare dashboardで確認したWeb Workerの正確なworkers.dev URL
- Produces API var: `BETTER_AUTH_URL`
- Produces API secret: new product-only `BETTER_AUTH_SECRET`
- Produces: idempotent public demo data

- [ ] Cloudflare dashboardまたはread-only APIで正確なworkers.dev account subdomainを確認し、推測でURLを書かない。
- [ ] `apps/api/wrangler.jsonc` の `vars` にWebの正確なHTTPS URLを `BETTER_AUTH_URL` として追加する。secret値は追加しない。
- [ ] Keychainに同serviceがないことを確認してから、`openssl rand -base64 32 | pbcopy` で専用secretをclipboardへ生成し、`security add-generic-password -a worker -s gs-20260731-aimani-ai-better-auth-secret -U -w` のpromptへ貼る。直後に `printf '' | pbcopy` でclipboardを消す。
- [ ] `security find-generic-password -a worker -s gs-20260731-aimani-ai-better-auth-secret -w | pnpm --filter @aimani-ai/api exec wrangler secret put BETTER_AUTH_SECRET` でAPI Worker secretへ登録する。値を表示しない。
- [ ] migration URLのhostname/port/pathnameを再検証し、`PUBLIC_DEMO_SEED_CONFIRMATION=gs-20260731-aimani-ai` を明示して `pnpm db:public:seed` を一度実行する。`DATABASE_URL` と `BETTER_AUTH_SECRET` はKeychainから同一command内だけへ注入する。
- [ ] seed CLIをもう一度実行し、冪等で成功することを確認する。production DBをdrop/truncateしない。
- [ ] PlanetScale consoleのcount queryでdemo users 4、organizations 2、Process Lab board 1が存在することだけを確認する。password hashやsessionを表示しない。
- [ ] `pnpm --filter @aimani-ai/api exec wrangler deploy --dry-run && git diff --check` を実行する。
- [ ] `git add apps/api/wrangler.jsonc docs/operations/planet-scale-runbook.md && git commit -m "chore: configure public authentication origin"` でコミットする。

### Task 8: ローカル品質ゲートとWorker dry-runを通す

**Files:**
- Modify: implementation files only when a failing check reveals an in-scope defect

**Interfaces:**
- Verifies: API unit 17件、Web 23件、PostgreSQL integration 30件、demo seed 2件、production build、API/Web Wrangler dry-run

- [ ] Docker Desktopを起動し、`docker info` が成功してから `pnpm db:up` を実行する。Dockerが使えなければproduction DBへ代替接続せず停止する。
- [ ] `pnpm db:migrate && pnpm db:demo:reset` を実行し、ローカル専用DBだけを準備する。
- [ ] `pnpm --filter @aimani-ai/api test`、`pnpm --filter @aimani-ai/web test`、`pnpm --filter @aimani-ai/api test:integration`、`pnpm --filter @aimani-ai/api test:demo` を順に実行し、実件数を記録する。
- [ ] `pnpm build` を実行する。
- [ ] `pnpm --filter @aimani-ai/api exec wrangler deploy --dry-run` と `pnpm --filter @aimani-ai/web exec wrangler deploy --dry-run` を実行する。
- [ ] `rg -n '(lin_api_|ghp_|cfat_|sbp_|sb_secret_|postgresql://[^ ]+:[^ ]+@)' --glob '!pnpm-lock.yaml' --glob '!docs/superpowers/plans/2026-07-31-planetscale-cloudflare-public-launch.md' .` を実行し、tracked secretが0件であることを確認する。
- [ ] `git diff --check` と `git status --short` を確認する。修正が必要だった場合だけ対象テストを再実行し、`fix: pass public deployment checks` として独立コミットする。

### Task 9: API→Webの順にCloudflareへデプロイする

**Files:**
- Modify: `README.md`
- Modify: `docs/operations/deployment.md`
- Modify: `docs/operations/planet-scale-runbook.md`

**Interfaces:**
- Produces internal Worker: `gs-20260731-aimani-ai-api` (`workers_dev: false`)
- Produces public Worker: `gs-20260731-aimani-ai-web`
- Preserves service binding: `API` → `gs-20260731-aimani-ai-api`

- [ ] `pnpm --filter @aimani-ai/api exec wrangler whoami` で対象Cloudflare account IDだけを照合し、token実値は表示・保存しない。
- [ ] `apps/api/wrangler.jsonc` のWorker名、Hyperdrive binding、Better Auth URL、`workers_dev: false` を再確認する。
- [ ] `apps/web/wrangler.jsonc` のWorker名とService Binding先を再確認する。
- [ ] `pnpm --filter @aimani-ai/api exec wrangler deploy` でAPI Workerを先にデプロイする。外部workers.dev URLが作られていないことを確認する。
- [ ] `pnpm --filter @aimani-ai/web exec wrangler deploy` でWeb Workerをデプロイし、出力された正確な公開URLを記録する。
- [ ] READMEとdeployment docsへ公開URL、demo login、データが共有demoである注意を追記する。
- [ ] runbookへdeploy日時、commit SHA、Worker version IDを記録する。
- [ ] `git add README.md docs/operations && git commit -m "docs: publish Aimani AI demo URL"` でコミットする。

### Task 10: 公開UXをブラウザでsmoke testする

**Files:**
- Create: `docs/research/2026-07-31-public-demo-verification.md`
- Modify: UI files only when a major public-demo blocker is reproduced

**Interfaces:**
- Verifies login: `owner@aimani-ai.local` / `aimani-ai-demo-2026`
- Verifies screens: Organizations、People、Todo、Handoff、Today、Team Work、Process Lab
- Verifies widths: desktop and mobile

- [ ] `browser:control-in-app-browser` skillを読み、公開URLを新しいtabで開く。
- [ ] ログインし、組織選択から `Acme Studio` へ入る。
- [ ] Peopleでメンバーと関係が読めること、Todoを作成・完了できることを確認する。
- [ ] Handoffをrequest、accept、reject、cancelでき、TodayとTeam Workへ状態が反映されることを確認する。
- [ ] Process Labで工程、依存線、担当者、進捗が見え、試験機能として他画面と混同しないことを確認する。
- [ ] mobile幅でToday、Team Work、Process Labの主要操作が画面外へ失われないことを確認する。
- [ ] productionでdev actor switchや内部debug UIが表示されないことを確認する。
- [ ] 重大なUX blockerだけを修正し、該当テスト、build、Worker再deployを行う。磨き込みだけの追加作業は別issueへ分離する。
- [ ] 検証日時、URL、commit SHA、確認済み導線、既知の制約を `docs/research/2026-07-31-public-demo-verification.md` に残す。secretやsession cookieは記録しない。
- [ ] `git add docs/research/2026-07-31-public-demo-verification.md` と必要な修正だけをstageし、`docs: record public demo verification` でコミットする。

### Task 11: 最終確認とGitHub引き渡しを行う

**Files:**
- Modify: `docs/HANDOFF-CLAUDE-2026-07-28.md`
- Modify: `README.md` only if the final GitHub URL changes

**Interfaces:**
- Produces: clean local branch、reviewable GitHub PR、public demo URL、rollback手順
- Preserves: tag `pre-aimani-ai-rename-20260731`

- [ ] `git status --short` が空であること、`git log --oneline --decorate -15` で今回のコミットが意図どおり分離されていることを確認する。
- [ ] API/Web tests、build、API/Web dry-run、tracked secret scanを最終実行し、verification docへ結果を追記する。
- [ ] handoff docへPlanetScale/Hyperdrive/Workerの専用資産名、公開URL、未完了事項、停止・削除順、禁止されたSupabaseを明記する。
- [ ] `superpowers:requesting-code-review` を使い、設計正本、secret安全性、DB誤爆防止、公開UX blockerの4点に絞ってレビューする。重箱の隅の指摘は採用基準にしない。
- [ ] actionableな指摘だけを修正し、対象checkを再実行する。
- [ ] `superpowers:verification-before-completion` を使って証跡を確認する。
- [ ] `superpowers:finishing-a-development-branch` を使い、local mergeかPRかをユーザーへ提示する。推奨はprivate remoteへbranchをpushしてdraft PRを作り、公開前に履歴のsecret scanを行う方式とする。
- [ ] GitHub repositoryの改名はPR確認後に `gs-20260731-aimani-ai` へ行い、origin URLとREADMEを更新する。既存の他repositoryを改名しない。

## Completion Criteria

- 専用PlanetScale Postgres、専用Hyperdrive、専用Workers、専用Better Auth secret以外を利用していない。
- Supabase、D1、他製品DB/Worker/secretへ変更を加えていない。
- API Workerは非公開、Web Workerは公開され、Service Binding経由で主要導線が操作できる。
- public seedは接続先guardを通ったときだけ実行でき、local/他provider/他DBを拒否する。
- Hyperdrive query cacheが無効で、Todo/Handoff/認証の書き込み直後に最新状態が見える。
- ローカル品質ゲート、Wrangler dry-run、公開ブラウザsmoke、tracked secret scanの結果がDocsへ残っている。
- 作業branchがcleanで、引き継ぎ先が公開URL、資産名、停止方法、未完了事項をフルパスDocsから把握できる。
