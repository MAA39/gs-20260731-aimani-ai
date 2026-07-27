# Task 4 report

## Status

実装完了。local `amidala_demo` のみを対象に、安全なDB作成・スキーマリセット・migration・決定的seedを行うroot commandと、PostgreSQL story integration testを追加した。

## 変更

- `apps/api/src/dev/reset-demo-database.ts`
  - `DATABASE_URL`必須化、derive/assertによるlocal demo target guard
  - maintenance DB (`/postgres`) で `amidala_demo` を必要時のみ作成
  - targetのpublic schemaとDrizzle migration journalを再初期化し、migration/seed実行
  - credentialを出力しない固定完了メッセージ
- `apps/api/src/dev/demo-seed.integration.test.ts`
  - `TEST_DATABASE_URL`をguard後に接続し、todo/domain countsをSQLで検証
- root `package.json` に `db:demo:reset` を追加
- `apps/api/.dev.vars.example` を `amidala_demo` に変更
- `docs/README.md` にローカル起動順と既存vars利用時の注意を追記

## Verification

- reset前 story test: `amidala_demo` 不在でFAIL（期待どおり）
- `pnpm db:up`: PASS
- reset + story integration: PASS（7 tests）
- reset再実行 + story integration: PASS（7 tests）
- normal DB URL guard: `Refusing reset` で拒否
- `pnpm --filter @amidala/api build`: PASS
- `git diff --check`: PASS

## Concerns

Drizzleのmigration journalは `drizzle` schemaに保持されるため、reset再実行時にも全migrationを適用できるよう、target DB内の `drizzle` schemaも削除している。remote/通常DB URLはderive/assertで到達前に拒否される。
