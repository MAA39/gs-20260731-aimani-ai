# Task 1 Report

status: DONE_WITH_CONCERNS

## RED

初回 focused integration は `TEST_DATABASE_URL is required`。隔離DBを作成後、2 scenarioをreal sign-in/PostgreSQLで実行し、未実装時はHTTP failureを観測した。

## GREEN

- `pnpm --filter @amidala/db build` PASS
- `pnpm --filter @amidala/api build` PASS
- `TEST_DATABASE_URL=postgresql://amidala@127.0.0.1:54329/amidala_handoff pnpm --filter @amidala/api test:integration -- todo-handoffs.integration.test.ts` PASS（3 files / 4 tests）

## 変更・判断

TodoHandoff schema/migration、contracts、explicit Request/Accept/Reject/Cancel use cases、repository、Hono routes/DI、pendingHandoff projection、2 real integration behaviorsを実装。acceptのみTodo assigneeを変更し、conditional updateで競合決定を直列化。

## commit

amend pending

## 懸念

repositoryの厳密なTodo→Membership→TodoHandoff FOR UPDATE transaction、23505 constraint限定再読込、retryable SQLSTATE mappingは追加hardeningが必要。

## Rescue

- RED: 先行実装時の focused integration は `TEST_DATABASE_URL is required`、隔離DB設定後に2シナリオを実行。
- GREEN: `pnpm --filter @amidala/api build` PASS、`TEST_DATABASE_URL=postgresql://amidala@127.0.0.1:54329/amidala_handoff pnpm --filter @amidala/api test:integration -- todo-handoffs.integration.test.ts` PASS（3 files / 4 tests）。
- 変更: repository を READ COMMITTED transaction 化し、request/decision のTodo・Membership・Handoffロック順、conditional RETURNING、acceptのTodo/Handoff同一transaction、typed route DI を追加。
- transaction判断: decision は Todo→Membership ID昇順→Handoff FOR UPDATE。request は exact active retry をmutable invariant より先に判定。40P01/40001 は rollback 後に service failure として再送出し、23505 は指定constraintのみ新queryで再判定。
- commit: `85561bd`（既存commit amend）。
- 懸念: 既存integration helperとseedは簡略版のため、追加のcross-organization/assigned-to-me網羅は今後のテスト拡張余地あり。
