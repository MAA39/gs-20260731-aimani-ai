# Todo Handoff 検証記録

検証日: 2026-07-27  
対象: Amidala v2 Todo Handoff vertical slice  
状態: **NEEDS_CONTEXT**（実ブラウザ接続不可）

## 環境とデータ

- Worktree: `amidala-v2/.worktrees/todo-handoff`
- PostgreSQL: `postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff`
- `amidala_handoff` はdrop/recreate後、全Drizzle migrationと`apps/api/src/dev/seed.ts`を適用。
- Seed accounts: `owner@amidala.local`（田中 彩）、`sato@amidala.local`（佐藤 花子）、`mori@amidala.local`（森 ハル）、`suzuki@amidala.local`（鈴木 健）。Organizations: Acme Studio / Northstar Lab。
- 開発Worker: `http://localhost:5173/`（Vite TanStack Start、API auxiliary Worker Service Binding）。実行中PID/sessionは完了時停止予定。

## 実行コマンドと結果

| command | result |
|---|---|
| `pnpm --filter @amidala/api test -- --run` | PASS（1 file / 2 tests） |
| `TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff pnpm --filter @amidala/api test:integration -- todo-handoffs.integration.test.ts --run` | PASS（3 files / 4 tests。integration configが既存integration 3 fileを対象） |
| `pnpm --filter @amidala/web exec tsc --noEmit` | PASS |
| `pnpm build --force` | PASS。Turbo warning: `@amidala/db#build` output files未設定のみ |
| `pnpm --filter @amidala/api exec wrangler deploy --dry-run` | PASS。No bindings found。dry-runのみ |
| `pnpm --filter @amidala/web exec wrangler deploy --config dist/server/wrangler.json --dry-run` | PASS。`env.API (amidala-api)` binding確認。dry-runのみ |
| `git diff --check` | PASS |

## Browser journey

指定手順に従いIn-App Browserの接続を試みたが、`Browser is not available: iab`で初期化できなかった。既存Zenn tabを操作せず、証拠のない成功やconsole結果を記録していない。したがって次の項目は未確認である。

- 1280×900: owner→Acme→Sato SharedTodo→Moriへのrequest→Mori accept→recent accepted→自分のTodo→Organization URL direct reload SSR。
- reject / cancel / retry / re-request、stale two-tab terminal retry、Northstar tenant separation。
- 390×844: Dialog focus return、stable wrapper focus、rail stacking、44px action、bottom nav、overflow、reduced motion。
- fresh tabのReact hydration warning / application error 0件。

スクリーンショットは「実画面のみ」の要件を守り、Browser unavailableのため未作成。再開時に以下へ保存する。

- `docs/assets/todo-handoff/accepted-recent-desktop.png`
- `docs/assets/todo-handoff/request-or-incoming-mobile.png`

## Deferred

Task 3 deferred minor（raw anchor、recent `resolvedAt`）は実画面評価前のため判断保留。Browser接続後、再現→必要なら最小変更→build→再ブラウザ確認の順で扱う。

## 再利用できるlesson

Dialogのfocus復帰と成功後wrapper focus、mutation後の関連Query invalidation、Organization-scoped typed navigation、SSR direct reloadのrequest-scoped QueryClient、そしてBrowser証拠がない場合に未確認を明示することを共通基準とする。
