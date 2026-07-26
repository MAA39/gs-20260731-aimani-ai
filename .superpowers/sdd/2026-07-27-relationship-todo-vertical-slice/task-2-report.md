# Task 2 report: TanStack Query BFF boundary

## Research

- TanStack Router Query integration公式ドキュメントを確認した。
  - SSRではリクエストごとに`QueryClient`を生成する。
  - `context.queryClient`をRouterへ渡し、`setupRouterSsrQueryIntegration`を接続する。
  - route loaderで`ensureQueryData`し、画面では`useSuspenseQuery`を読む構成が推奨されている。
- Server Functionは`.functions.ts`を薄いvalidator/wrapperにし、API adapterと認証境界を`.server.ts`へ閉じ込めた。
- Hono clientの型は、現在のAPI routeが`req.json()`を直接読むためPOST JSON入力を推論できない。POST transportだけをserver-only adapter内で局所的に型付けし、API側の既存validationを利用した。

## Changes

- `@tanstack/react-query`を`5.101.4`、`@tanstack/react-router-ssr-query`を`1.167.1`へ固定。
- RouterごとにQueryClientを生成し、query stale time 30秒、mutation retry無効を設定。
- Router型登録は`ReturnType<typeof getRouter>`で行い、`main.tsx`の起動時に`getRouter()`を呼ぶ。module-globalなQueryClient/Router instanceは作らない。
- `PersonTodoPath` / `CreateSharedTodoInput`をvalidatorで検証。
- `getSharedTodoWorkspaceFromApi` / `createSharedTodoFromApi`を追加。
  - cookieをAPI Workerへ転送。
  - 401は`/login`へredirect。
  - 403/404/400/その他失敗を画面で扱えるResult unionへ変換。
  - 200/201 bodyをcontract schemaで検証。
- `sharedTodoWorkspaceQuery`を安定したkeyで追加。
- API clientのroute型衝突によりPeople既存clientが型エラーになったため、Peopleのcollection呼び出しも同じserver adapter境界で局所型付けした。実行時のURLと挙動は変更していない。

## Verification

```text
pnpm --filter @amidala/web exec tsc --noEmit  # passed
pnpm --filter @amidala/web build              # passed
```

Build後の`dist/client/assets/todos-*.js`を確認し、`cloudflare:workers`、DB/Drizzle、Hono server implementation、Better Auth server code、`server-only`のTodo client chunkへの混入がないことを確認した。
