# Task 1 実装レポート

## 変更概要

- pnpm workspace / Turborepo の monorepo skeleton を追加
- Cloudflare Vite plugin を使う React/TanStack Router の Web シェルを追加
- People-first のホーム画面、desktop left navigation、mobile bottom navigation を実装
- indigo design token、Manrope/Noto Sans JP、visible focus、reduced-motion を追加
- Hono API Worker と `/health`、Web/API の Wrangler 設定を追加
- contracts / api-client の workspace package を追加

## Commands / tests

- `pnpm install` — 成功（pnpm 11.17.0、lockfile 生成）
- `pnpm build` — 成功（Turbo: API tsc + Web Vite build）
- `pnpm --filter @amidala/api exec wrangler dev --local --port 8788` + `curl http://localhost:8788/health` — `{"ok":true}`

## 結果

ブラウザで触れる Amidala v2 シェルと API health endpoint を提供できる状態。

## 未解決懸念

- TanStack Start の SSR route generation は次 slice で導入する。今回の touchable MVP は Vite のブラウザシェルを優先。
- Google Fonts はネットワーク利用可能時に Manrope/Noto Sans JP を読み込む。オフライン時は sans-serif fallback。

## Fix round 1

### 変更

- `tanstackStart()` と Cloudflare Vite plugin を公式順で設定し、file routes / SSR bundle を有効化
- Tailwind CSS v4 の Vite plugin と `@import "tailwindcss"` を追加
- 外部 Google Fonts import を削除し、system fallback に変更
- `/`, `/todos`, `/handoffs` の file routes と URL 追従 active navigation を追加
- `/api/health` server route から Cloudflare Service Binding `API` の `/health` を呼ぶ経路を追加
- API Worker に `workers_dev:false` / `preview_urls:false` を追加
- Handoff placeholder に requester → Todo → recipient の relationship rail を追加

### Commands / results

- `pnpm install` — 成功
- `pnpm build` — 成功（Web client + SSR bundle、API tsc）
- API local `wrangler dev` — 起動確認済み（`/health` は `{"ok":true}`）
- Web Vite dev — 起動確認済み。client-side の3 file route navigation を構成

### 懸念

- Vite の開発サーバーは SSR runtime ではないため、`/api/health` の Service Binding 実行確認は Cloudflare preview/deploy 相当の Worker runtime で行う必要がある。

## Fix round 2

### 変更

- mobile の固定 `:first-child` brand 表示を除去し、desktop/mobile とも URL active のみで表示
- root link は `activeOptions.exact`、top-bar title は現在 pathname から People / Todos / 引き継ぎを表示
- Cloudflare Vite plugin に `viteEnvironment:ssr` と API auxiliary Worker (`../api/wrangler.jsonc`) を設定

### Commands / results

- `pnpm build` — 成功（Web client/SSR + API tsc）
- `pnpm dev` — 単一コマンドで Web Vite 起動確認
- `curl /`, `/todos`, `/handoffs` — dev server の root は 200。file route は client-side navigation 用に生成済み
- `curl /api/health` — Vite dev server では 404。Service Binding の health 経路は Cloudflare Worker/auxiliary runtime での確認が必要

### 懸念

- 現環境の `pnpm dev` は Vite 開発サーバー表示までで、Cloudflare auxiliary Worker の SSR runtime を直接起動しないため、dev URL への直接 `/api/health` は未成立。production build には SSR bundle と auxiliary Worker 設定が含まれる。
