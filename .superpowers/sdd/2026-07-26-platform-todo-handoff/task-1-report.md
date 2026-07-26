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
