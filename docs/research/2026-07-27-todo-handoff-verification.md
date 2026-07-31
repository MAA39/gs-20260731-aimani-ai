# Todo Handoff 検証記録

検証日: 2026-07-27
対象: Aimani AI v2 Todo Handoff vertical slice
状態: **DONE_WITH_CONCERNS**（実ブラウザ検証済み。reduced motionは未エミュレート）

## 環境とデータ

- Worktree: `aimani-ai-v2/.worktrees/todo-handoff`
- PostgreSQL: `postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani_ai_handoff`
- `aimani_ai_handoff` はdrop/recreate後、全Drizzle migrationと`apps/api/src/dev/seed.ts`を適用。
- Seed accounts: `owner@aimani-ai.local`（田中 彩）、`sato@aimani-ai.local`（佐藤 花子）、`mori@aimani-ai.local`（森 ハル）、`suzuki@aimani-ai.local`（鈴木 健）。Organizations: Acme Studio / Northstar Lab。
- 開発Worker: `http://localhost:5173/`（Vite TanStack Start、API auxiliary Worker Service Binding）。Browser viewportはdesktop `1280×720`、mobile `390×844`。

## 実行コマンドと結果

| command | result |
|---|---|
| `pnpm --filter @aimani-ai/api test -- --run` | PASS（2/2 tests） |
| `TEST_DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani_ai_handoff pnpm --filter @aimani-ai/api test:integration -- todo-handoffs.integration.test.ts --run` | PASS（6/6 tests） |
| `pnpm --filter @aimani-ai/web exec tsc --noEmit` | PASS |
| `pnpm build --force` | PASS。Turbo warning: `@aimani-ai/db#build` output files未設定のみ |
| `pnpm --filter @aimani-ai/api exec wrangler deploy --dry-run` | PASS。No bindings found。dry-runのみ |
| `pnpm --filter @aimani-ai/web exec wrangler deploy --config dist/server/wrangler.json --dry-run` | PASS。`env.API (aimani-ai-api)` binding確認。dry-runのみ |
| `git diff --check` | PASS |

## Browser journey

1280×720でowner login→Acme Studio→Sato共有Todo→owner-assigned Todo→Moriへmessage付きrequest→recipient acceptを確認した。accept後はincomingからRecent acceptedへ即時移動し、Assigned Todoでは作成者が田中 彩、現在担当が森 ハルになった。Organization-scoped URLのdirect reloadも正しいSSRを表示した。

recipient roleはlogout UIが未実装のため、ブラウザでMori loginを行ったとは記録しない。local disposable DBの最新Better Auth session rowだけをMoriへ更新して確認した。

390×844ではrequest Dialogを確認した。recipient selectが初期focus、未選択時はsubmit disabled、`clientWidth=390` / `scrollWidth=375`、Close `80×48.4`、submit `144×50.4`。Browser warn/error logsは空。reduced motionは未エミュレートのためpending/static-only。

初回Browser runでaccept後にstale UIが残る問題を検出し、`b45e87d`で`useSuspenseQuery` + invalidate/revalidationへ修正後、同じjourneyを再実行してRecent/Assigned Todoの更新を確認した。

その後の最終レビューで、Organization全体のrecent漏洩とlimit-before-filter、Assigned routeのloader data stale、完了TodoのAssigned表示、accepted CTAのactor条件、Recentの`requestedAt`表示を検出した。`9108967`と`7527f41`で、requestedはMembership party scope、terminalはparty scope + `resolvedAt DESC`をSQLでlimit 20、Assignedはopenのみ、routeは`useSuspenseQuery`、accepted CTAはrecipientかつcurrent assigneeのみ、Recent日時は`resolvedAt`へ修正した。最終API unit 2/2、integration 6/6、Web typecheck、full build、diff-checkはPASS。独立reviewerは構造/query修正にBrowser再実行不要と判断したため、この2 commit後のBrowser再実行は行っていない。

Screenshots: [accepted → recent desktop](../assets/todo-handoff/accepted-recent-desktop.png), [request Dialog mobile](../assets/todo-handoff/request-or-incoming-mobile.png)

## Deferred

Task 3でdeferredだったaccepted CTAとrecent `resolvedAt`は`7527f41`で解消した。reduced-motionは未エミュレートのためpending。

## 再利用できるlesson

Dialogのfocus復帰と成功後wrapper focus、mutation後の関連Query invalidation、Organization-scoped typed navigation、SSR direct reloadのrequest-scoped QueryClientを共通基準とする。Inbox read modelはOrganizationだけでなくactor partyでscopeし、filter/order/limitをSQL内でこの順に成立させる。Assigned Todoはopenのみ、terminal timelineは`resolvedAt`を表示し、CTAはactorと現在担当の双方を満たす場合だけ出す。
