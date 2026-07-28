# Today / Todo Handoff ローカルruntime検証

- 実行日: 2026-07-28（Asia/Tokyo）
- code baseline: `18366d915ce9ce8cc6df36795c124cff56ea921b`
- 対象: local `amidala_demo` PostgreSQL、TanStack Start Web Worker、auxiliary Hono API Worker
- Cloudflare deploy: 未実施

## 目的

PR #7のToday画面が静的に描画できるだけでなく、認証された2 actorの責任移管を実runtimeで投影できることを確認する。

検証経路:

```text
HTTP client + Better Auth cookie
  → TanStack Start Web Worker
  → createServerFn RPC (`/_serverFn/...`)
  → Cloudflare Service Binding (`env.API.fetch`)
  → private Hono API Worker
  → Drizzle transaction
  → local PostgreSQL `amidala_demo`
  → Today SSR
```

REST endpointをWeb Workerへ直接POSTする検証ではない。ブラウザUIが利用するServer Function RPCを通した。

## 前提

- `apps/api/.dev.vars`はignoredで、`DATABASE_URL`がlocal `amidala_demo`を指す
- `apps/web/.env.development.local`はignoredで、development-only Actor Switch用passwordが設定済み
- 値は出力・記録していない
- `pnpm db:demo:reset`のDB名guardを通し、demo DBだけを初期化した
- env変更後に`pnpm dev`を再起動し、Workerが現在設定を読み直した

Better Authの実HTTP sign-inはCSRF/trusted-origin検証を通すため、browser相当の`Origin: http://localhost:5173`を付けた。

## 実行結果

```text
login: Tanaka=200 Mori=200
Tanaka initial Today SSR: 200, own responsibility present
handoff request RPC: 200, typed result ok
Mori incoming Today SSR: 200, request and context present
handoff accept RPC: 200, accepted and assignee changed
Mori accepted Today SSR: 200, ownership present
Tanaka recent Today SSR: 200, transfer announcement present
Tanaka direct reload SSR: 200, state remains present
runtime journey: PASS
```

確認した内容:

1. 田中 彩と森 ハルがlocal seed accountでsign-inできる
2. 初期Todayに田中の担当Todo「顧客インタビューの論点を整理する」がある
3. 田中が森へ「背景と期待」付きHandoffを依頼できる
4. 森のToday「あなたへの依頼」にTodoとmessageがSSRされる
5. 森のaccept結果が`accepted`で、Todoのassignee membershipが森に変わる
6. 森のToday「いま自分が持つボール」にTodoが移る
7. 田中のToday「最近動いたボール」に「責任が移りました」と森が表示される
8. 同じURLへの直リンク再読込でも状態がSSRされる

## 補足した切り分け

最初のlogin probeはOriginなしで403になった。browser相当Originを付けると200となり、credential不一致ではなくBetter Authのorigin検証であることを確認した。

また、Web Workerはdomain REST routeをpublic proxyしていない。public proxyはhealth/authだけで、domain mutationはthin Server Functionからprivate Service Bindingを使う。最終検証ではこの設計どおり`/_serverFn`を利用した。

誤ったpublic REST pathを意図的にprobeした時だけ、TanStack Routerのgeneric not-found warningがdev logへ出た。最終RPC journeyの失敗ではない。

## この証跡が証明しないこと

- desktop/mobileの視覚品質
- button、select、dialog、focusの実操作
- browser hydration後のconsole error/warning
- Actor Switch UIのclick操作
- reduced-motion
- 3分でプロダクト価値が伝わるかという人間の評価

Codex内ブラウザは既存local tabが内部`data:` error pageになり、URL policyでlocalhostへ自動遷移できなかった。別browser/standalone Playwrightへ迂回していない。上記はClaude Codeの最初のhuman-visible verificationとして残す。

## 現在のlocal状態

- dev server: `http://localhost:5173/`で稼働を維持
- DB: 最終journey後の「森が引き受け済み」状態
- 初期状態へ戻す: `pnpm db:demo:reset`後に必要なら`pnpm dev`を再起動
- production / preview: mutation・deployなし
