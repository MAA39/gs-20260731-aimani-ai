# Task 1 Report: Request-scoped API composition root

## Status

実装完了。`awilix` による Worker isolate 単位の root container と、リクエスト単位の scope を導入した。

## 変更内容

- `HealthCheck` と `Clock` を Hono/Awilix 非依存の application service として追加。
- `createRootContainer()` は strict/proxy 設定で `clock` singleton のみを登録。
- `withRequestScope()` は env/request を value 登録し、`healthCheck` を scoped 登録。成功・例外の双方で `scope.dispose()` を実行。
- `createApp()` の middleware で全リクエストを scope 化し、`/health` は scope の `healthCheck` を解決。
- Worker では isolate ごとに root container を一度だけ生成。
- `awilix@13.0.5`、`vitest@4.1.10` を固定追加。

## TDD / 検証エビデンス

- RED: `pnpm --filter @amidala/api test -- --run` は、未実装の `./root-container` を解決できず失敗。
- GREEN: 同コマンドで 2 test files / 4 tests passed。
- `pnpm --filter @amidala/api build`: exit 0。
- `pnpm build`: turbo build 2 successful、exit 0。

## 自己レビュー

ブリーフ記載の request scope 隔離、disposer（正常終了・例外終了）、health response `{ ok: true }`、依存境界を確認。DB・認証・外部リソースは追加していない。

## Concerns

なし。

## Round 1/5 Fix

- `apps/api/src/app.ts` から Awilix の型 import を削除し、composition が公開する `RootContainer` alias を `ApiEnv.Variables.scope` に使用。Awilix import は composition 配下に限定。
- `pnpm --filter @amidala/api test -- --run`: exit 0、2 test files / 4 tests passed。
- `pnpm --filter @amidala/api build`: exit 0（TypeScript 成功）。
