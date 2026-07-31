# アイマニAI 改名・外部公開 Implementation Plan

> **停止事項（2026-07-31）:** 本計画のTask 3以降にあるSupabase前提は撤回された。Task 3以降は実行禁止とし、`docs/superpowers/specs/2026-07-31-planetscale-cloudflare-database-design.md` の承認後にPlanetScale前提で計画を書き直す。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現在ローカルで動く製品を「アイマニAI」へ改名し、既存製品を変更せず、専用PostgreSQLとCloudflare Workersで触れる公開デモとして提供する。

**Architecture:** TanStack StartのWeb WorkerからService BindingでHono API Workerを呼び、API WorkerはCloudflare Hyperdrive経由で専用Supabase PostgreSQLへ接続する。既存のDDD/CQRS-lite境界、Drizzle ORM、Awilixのrequest scope DI、Better Authを維持し、D1は導入しない。

**Tech Stack:** TypeScript 7、React 19、TanStack Start/Router/Query、Hono、Better Auth、Awilix、Drizzle ORM、PostgreSQL 17、Cloudflare Workers、Hyperdrive、pnpm/Turborepo、Vitest。

## Global Constraints

- HTMLと画面上の製品名は必ず `アイマニAI` とする。
- 機械識別子は `aimani-ai`、package scopeは `@aimani-ai/*` とする。
- GitHubリポジトリ名は `gs-20260731-aimani-ai` とする。
- Worker名は `gs-20260731-aimani-ai-web` と `gs-20260731-aimani-ai-api` とする。
- 本番DBとHyperdriveはこの製品専用に新規作成し、既存のSupabase、Hyperdrive、Workerを変更・流用しない。
- DBはPostgreSQLを使用し、D1は導入しない。
- Awilixのrequest scope DIとRepository/UseCase境界を維持する。
- 重い網羅テストを追加せず、主要なユーザー導線を触れることを優先する。
- secrets、接続文字列、実トークンをGit管理下へ保存しない。
- 現在のローカルHEAD `c10b0ab` はタグ `pre-aimani-ai-rename-20260731` で退避する。

---

### Task 1: 製品識別子をアイマニAIへ改名する

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/*/package.json`
- Modify: `packages/*/package.json`
- Modify: `apps/**/src/**/*.{ts,tsx}` の `@aimani-ai/*` importと製品固有型名
- Modify: `packages/**/src/**/*.ts` の `@aimani-ai/*` importと製品固有型名
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/routes/login.tsx`
- Modify: `apps/web/src/routes/organizations.tsx`
- Modify: `compose.yaml`
- Modify: `apps/api/.dev.vars.example`
- Modify: `apps/api/wrangler.jsonc`
- Modify: `apps/web/wrangler.jsonc`
- Modify/Rename: `docs/**/*.md`
- Test: existing API unit tests and Web tests

**Interfaces:**
- Produces: package names `@aimani-ai/api`, `@aimani-ai/web`, `@aimani-ai/api-client`, `@aimani-ai/contracts`, `@aimani-ai/db`
- Produces: UI product label `アイマニAI`
- Produces: local PostgreSQL database names `aimani_ai`, `aimani_ai_demo`, `aimani_ai_handoff`

- [ ] `Aimani AI` / `aimani-ai` / `@aimani-ai` の全追跡対象を分類し、外部の別製品を指すものがないことを確認する。
- [ ] package名、import、DB型など機械識別子を `aimani-ai` / `aimaniAi` / `@aimani-ai` に置換する。
- [ ] HTML title、ナビゲーション、ログイン、組織選択の表示を `アイマニAI` に置換する。
- [ ] Docker ComposeのDBユーザー、DB名、volume名を専用品へ変更し、既存volumeを変更しない。
- [ ] Worker名とService Binding参照を日付付き専用名へ変更する。
- [ ] Docs内の旧称と旧称を含むファイル名を新名称へ更新する。
- [ ] `pnpm install --lockfile-only` でlockfileを同期する。
- [ ] `rg -ni 'aimani-ai'` が追跡対象で0件になることを確認する。
- [ ] API単体、Webテスト、ビルドを実行する。
- [ ] `chore: rename product to Aimani AI` としてコミットする。

### Task 2: 外部公開用の最小ドキュメントとCIを整備する

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `.github/workflows/ci.yml`
- Modify: `docs/README.md`
- Create: `docs/product/public-demo.md`
- Create: `docs/operations/deployment.md`

**Interfaces:**
- Produces: 初見の利用者が価値、機能、ローカル起動、デモ導線を理解できるREADME
- Produces: push/PR時にAPI単体、Webテスト、buildを実行するCI

- [ ] READMEへ「誰の作業がどこで止まっているかを見て、引き継ぐ」価値、主要画面、アーキテクチャ、起動方法を記載する。
- [ ] 公開デモのログイン情報、データリセット方針、Process Labが試験機能であることを記載する。
- [ ] MIT LICENSEを追加する。
- [ ] GitHub Actionsでpnpm install、API単体、Webテスト、buildを実行する。
- [ ] env exampleがダミー値のみであること、tracked fileにsecretがないことを確認する。
- [ ] `docs/operations/deployment.md` に専用資産名、作成順序、rollback方法を記載する。
- [ ] CI相当コマンドをローカルで実行する。
- [ ] `docs: prepare Aimani AI for public demo` としてコミットする。

### Task 3: 専用Supabase PostgreSQLとHyperdrive接続を準備する

**Files:**
- Modify: `apps/api/wrangler.jsonc`（作成されたHyperdrive IDを設定）
- Modify: `docs/operations/deployment.md`
- Test: `apps/api` integration/demo tests

**Interfaces:**
- Consumes: `ApiBindings.HYPERDRIVE.connectionString`
- Produces: 専用Supabase PostgreSQL、専用Hyperdrive binding `HYPERDRIVE`

- [ ] Supabase Management API認証の有無を値を表示せず確認する。
- [ ] Tokyoリージョンに専用プロジェクト `gs-20260731-aimani-ai` を新規作成する。既存project refは使わない。
- [ ] 専用PostgreSQLへDrizzle migrationを直接接続で適用する。
- [ ] 公開デモ専用アカウントと組織データをseedする。
- [ ] Supabase direct connectionをoriginにしてHyperdrive `gs-20260731-aimani-ai-db` を作成する。
- [ ] Hyperdrive query cacheを無効にする。
- [ ] `apps/api/wrangler.jsonc` に実際のHyperdrive IDを設定する。
- [ ] Docker Desktopまたは専用PostgreSQLでAPI integration 30件、demo 2件を実行する。
- [ ] `chore: configure dedicated production PostgreSQL` としてコミットする。

### Task 4: CloudflareへAPI/Web Workerをデプロイする

**Files:**
- Modify: `docs/operations/deployment.md`
- Modify: `README.md`（公開URLを追記）

**Interfaces:**
- Consumes: Worker names `gs-20260731-aimani-ai-api` / `gs-20260731-aimani-ai-web`
- Consumes: service binding `API`, Hyperdrive binding `HYPERDRIVE`
- Produces: 公開Web URL

- [ ] Cloudflare認証の有無を値を表示せず確認する。
- [ ] API Workerへ `BETTER_AUTH_SECRET` と本番URLをsecretとして登録する。
- [ ] API Workerを先にdeployし、health checkを確認する。
- [ ] Web WorkerをAPI Service Binding付きでdeployする。
- [ ] Web URL、API内部接続、認証cookieを確認する。
- [ ] READMEとdeployment docsへ公開URLと再デプロイ手順を追記する。
- [ ] `chore: deploy Aimani AI workers` としてコミットする。

### Task 5: 公開デモの主要UXを確認してGitHubへ反映する

**Files:**
- Create: `docs/research/2026-07-31-public-demo-verification.md`
- Modify: `README.md`（必要な最終補足のみ）

**Interfaces:**
- Produces: 提出可能なWeb URL、GitHub URL、デモ導線、確認記録

- [ ] デスクトップでログイン、組織選択、People、Todo、Handoff、Today、Team Work、Process Labを確認する。
- [ ] モバイル幅でToday、Team Work、Process Labを確認する。
- [ ] dev actor switchなど公開時に誤解を招くUIが安全なデモ用途に限定されていることを確認する。
- [ ] tracked secret scan、`git diff --check`、全テスト、build、Wrangler dry-runを実行する。
- [ ] 検証結果と既知の制約をDocsへ残す。
- [ ] ローカル21コミットを含む履歴をprivate remoteへバックアップし、改名ブランチをpushしてPRを作成する。
- [ ] レビュー後、GitHub repositoryを `gs-20260731-aimani-ai` へ改名しoriginを更新する。
- [ ] public化の直前にsecret履歴とREADMEを再確認する。
