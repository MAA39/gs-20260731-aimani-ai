# Task 2 report

## status

DONE

## 変更

- Handoff の共有 Zod 入力・response/result union と server-only Service Binding adapter を追加。
- request / accept / reject / cancel を個別の Server Function として公開。401 は `/login` redirect、403/404/409 は discriminated union、5xx・通信・response parse failure は `service_unavailable`。
- Handoff、assigned Todo、shared Todo、People の query key factory/query options を追加（全キー `as const`、module-global QueryClient なし）。
- People/Todo の既存 Hono client parameterized route 型衝突を adapter 内の transport cast に限定。

## boundary / error 表

| 公開関数 | 入力 | 成功 HTTP | 401 | 403/404/409 | その他 |
|---|---|---:|---|---|---|
| getTodoHandoffWorkspace | organizationId | 200 | redirect | forbidden/not_found/conflict | service_unavailable |
| getAssignedTodoWorkspace | organizationId | 200 | redirect | forbidden/not_found/conflict | service_unavailable |
| requestTodoHandoff | organizationId, todoId, recipientMembershipId, requestMessage? | 201/200 | redirect | forbidden/not_found/conflict | validation_error/service_unavailable |
| accept/reject/cancelTodoHandoff | organizationId, handoffId | 200 | redirect | forbidden/not_found/conflict | validation_error/service_unavailable |

## commands / output

- `pnpm --filter @aimani-ai/web exec tsc --noEmit` — pass
- `pnpm --filter @aimani-ai/web build` — pass (client/SSR/API bundles)
- `git diff --check` — pass

## commit

`feat: add Todo Handoff BFF boundary`

## 懸念

- Handoff query UI への接続は Task 3 範囲。既存 people adapter の Hono client 型衝突は server adapter 内 cast で封じた。

## Fix round 1

- People Service Binding 呼び出しを try/catch し、network rejection を `service_unavailable` に変換。
- assigned Todo adapter/function を Todos feature に集約し、Handoffs から重複公開を削除。
- `as any` を除去し、server-only 内の最小 local endpoint interface + `unknown` narrow に限定。
- Handoff input schema は Task 1 の shared path/body schemas を intersection で再利用。
- 検証: `pnpm --filter @aimani-ai/web exec tsc --noEmit`、`pnpm --filter @aimani-ai/web build`、`git diff --check` 全て成功。

## Fix round 2

- canonical assigned Todo adapter の HTTP 400 を `validation_error` として明示分類し、他 adapter と整合。
