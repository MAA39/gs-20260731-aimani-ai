# Todo Handoff 検証記録

検証日: 2026-07-27  
対象: Amidala v2 Todo Handoff vertical slice  
状態: **DONE_WITH_CONCERNS**（実ブラウザ検証済み。reduced motionは未エミュレート）

## 環境とデータ

- Worktree: `amidala-v2/.worktrees/todo-handoff`
- PostgreSQL: `postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff`
- `amidala_handoff` はdrop/recreate後、全Drizzle migrationと`apps/api/src/dev/seed.ts`を適用。
- Seed accounts: `owner@amidala.local`（田中 彩）、`sato@amidala.local`（佐藤 花子）、`mori@amidala.local`（森 ハル）、`suzuki@amidala.local`（鈴木 健）。Organizations: Acme Studio / Northstar Lab。
- 開発Worker: `http://localhost:5173/`（Vite TanStack Start、API auxiliary Worker Service Binding）。Browser viewportはdesktop `1280×720`、mobile `390×844`。

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

1280×720でowner login→Acme Studio→Sato共有Todo→owner-assigned Todo→Moriへmessage付きrequest→recipient acceptを確認した。accept後はincomingからRecent acceptedへ即時移動し、Assigned Todoでは作成者が田中 彩、現在担当が森 ハルになった。Organization-scoped URLのdirect reloadも正しいSSRを表示した。

recipient roleはlogout UIが未実装のため、ブラウザでMori loginを行ったとは記録しない。local disposable DBの最新Better Auth session rowだけをMoriへ更新して確認した。

390×844ではrequest Dialogを確認した。recipient selectが初期focus、未選択時はsubmit disabled、`clientWidth=390` / `scrollWidth=375`、Close `80×48.4`、submit `144×50.4`。Browser warn/error logsは空。reduced motionは未エミュレートのためpending/static-only。

初回Browser runでaccept後にstale UIが残る問題を検出し、`b45e87d`で`useSuspenseQuery` + invalidate/revalidationへ修正後、同じjourneyを再実行してRecent/Assigned Todoの更新を確認した。

Screenshots: [accepted → recent desktop](../assets/todo-handoff/accepted-recent-desktop.png), [request Dialog mobile](../assets/todo-handoff/request-or-incoming-mobile.png)

## Deferred

Task 3 deferred minor（raw anchor、recent `resolvedAt`）は未変更。reduced-motionは未エミュレートのためpending。

## 再利用できるlesson

Dialogのfocus復帰と成功後wrapper focus、mutation後の関連Query invalidation、Organization-scoped typed navigation、SSR direct reloadのrequest-scoped QueryClient、そしてBrowser証拠がない場合に未確認を明示することを共通基準とする。
