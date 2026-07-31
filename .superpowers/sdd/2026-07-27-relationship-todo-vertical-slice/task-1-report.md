# Task 1 report

## RED
`TEST_DATABASE_URL=... pnpm --filter @aimani-ai/api test:integration -- --run src/routes/todos.integration.test.ts` 初回は POST 404（期待どおり）。

## 変更概要
Todo schema/migration、contracts、application use cases、Drizzle repository、Hono routes、Awilix wiring、integration testを追加。relationship source/target indexesを追加。

## 設計判断
creatorはsession-derived membership、Organization IDを全queryへ付与。pairは双方向検索。

## self-review
POST/GETのpath・認可、自己context、assignee制約、Northstar cross-org拒否を検証。aliased membership joinで表示名/titleを返し、relationshipKindsはmanager_report方向・peer/supporter対称規則で取得。

## 追加調査と修正
初回のGET 500は、`findActiveMembershipForUser`がDB列名`id`の行を返し、applicationが`membershipId`を参照して`undefined`を次のRepository呼び出しへ渡していたことが原因だった。Repository境界で`CurrentMembershipContext`へ明示的にマッピングし、`findActiveMembershipForUser` / `findActiveMember` / `createSharedTodo` / `getSharedTodoWorkspace`というドメイン語彙のportへ揃えた。

Relationshipレコードを前提にしないため、application/use case/contractの名称も`CreateSharedTodo`、`GetSharedTodoWorkspace`、`SharedTodoWorkspace`へ修正した。空のTodo一覧でもOrganizationテーブルから名前を取得し、一覧のcreator/assigneeをMembershipの表示名・役職とともに返す。relationshipKindsはPeopleRepositoryと同じmanager_report方向、peer/supporter対称、検証・重複排除・順序付けを行う。

integration testは同一シナリオのまま、POSTのassignee/status、GETのworkspace・Todo表示名、cross-Organization拒否と件数不変、DB `finally` cleanupを検証するよう強化した。

## GREEN
以下を実測し、成功した。

```text
TEST_DATABASE_URL=postgresql://aimani-ai:aimani-ai@127.0.0.1:54329/aimani-ai \
  pnpm --filter @aimani-ai/api exec vitest --config vitest.integration.config.ts run src/routes/todos.integration.test.ts
Test Files  1 passed (1)
Tests       1 passed (1)

pnpm --filter @aimani-ai/api test
Test Files  1 passed (1)
Tests       2 passed (2)

pnpm build
Tasks: 3 successful, 3 total (@aimani-ai/api, @aimani-ai/db, @aimani-ai/web)
```
