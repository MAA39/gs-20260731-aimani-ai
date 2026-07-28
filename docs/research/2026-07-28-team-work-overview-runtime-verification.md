# Team Work Overview local runtime verification

- 日付: 2026-07-28（Asia/Tokyo）
- repository: `/Users/maa/Projects/gs/000_参照用/amidala-v2`
- 実装branch基準: `6b7da4f`
- 対象: `/$organizationId/work`（UI表示: `チームのボール`）
- deploy: Cloudflareへは未deploy。local `amidala_demo` PostgreSQLだけを使用

## 結果

Organization内で「誰が現在担当し、引き継ぎ確認待ち・対応中・完了のどこにいるか」を、既存Todo/Handoffを正本にしたread-only画面で確認できた。新しいworkflow status、chart、Kanban、tableは追加していない。

## ブラウザjourney

`pnpm db:demo:reset`後、TanStack Start Web Worker → typed Server Function → Cloudflare Service Binding → private Hono API Worker → local PostgreSQLの実経路で次を操作した。

1. 田中 彩の`Today`でdemo Todoを確認
2. `チームのボール`で田中groupの`対応中`を確認
3. 田中から森 ハルへ、背景と期待付きでHandoffを依頼
4. Team WorkでTodoが田中groupのまま、`森 ハルさんの確認待ち`になることを確認
5. Actor Switchで森へ切り替え、`インタビュー仮説を3点にまとめる`を次の一手としてaccept
6. Team WorkでTodoが森groupへ移り、`対応中`になることを確認
7. 森がTodoを完了し、open groupから消えて`最近完了`へ移ることを確認
8. 森sessionからNorthstar pathを開き403の固定表示となり、Acme Todoが出ないことを確認

結果:

- desktop `1280x720`: 横overflowなし
- mobile `390x844`: 横overflowなし。bottom nav 5項目は各56px高、nowrap
- direct reload: SSR表示を維持
- browser console warning / error: 0件
- read-only Team Work画面に完了/Handoff mutationを重複配置していない

## 検証結果

```text
API unit: 13/13 PASS
Web tests: 17/17 PASS
PostgreSQL integration: 24/24 PASS
demo seed: 1/1 PASS（amidala_demo reset後）
full monorepo build: 3/3 PASS
generated route diff: PASS
production artifact demo marker scan: 0 matches
production artifact local env file scan: 0 files（cache bypass rebuild後）
git diff --check: PASS
```

## runtimeで見つけたTanStack Start境界バグ

### 症状

Task 5直後、認証済みSSRで`/work`はHTTP 200 / 40ms前後だったが、`/today`、`/todos`、`/handoffs`は5〜12秒で0 bytesのままtimeoutした。API/integration/buildはPASSしていた。

### 原因

mutation componentはQuery keyだけが必要なのに`team-work-queries.ts`をimportしていた。同moduleは`team-work.functions.ts`、さらにserver-only adapterへ繋がる。これによりclient componentのSSR graphへServer Function split境界が逆流し、component graph評価がTTFB前でstuckした。

### 修正

side-effect-free leaf `team-work-query-key.ts`へQuery keyを分離した。

```text
client mutation component → team-work-query-key.ts
route/query owner          → team-work-queries.ts → Server Function
```

cold restart後の同一認証条件で次へ復帰した。

```text
/work     200 / 56ms
/today    200 / 54ms
/todos    200 / 39ms
/handoffs 200 / 34ms
```

再利用するルールは「Query keyのみを使うclient moduleは、Server Function/queryFnをimportするmoduleに依存しない」である。build/typecheckだけでは検出できなかったため、authenticated direct SSRを最終検証に含める。

## local envとbuild cacheの注意

worktreeのignored `.dev.vars`をsymlinkしたままWeb buildすると、auxiliary API bundleが`dist/amidala_api/.dev.vars`を含む場合がある。さらにTurbo cacheがそのartifactを復元し得る。

最終buildではworktreeのenv symlinkを外し、`pnpm clean:web:build && pnpm exec turbo run build --force`を実行した。その後、local env file名がdistに0件であることとdemo marker 0件を確認した。値をlogやDocsへ出してはいけない。
