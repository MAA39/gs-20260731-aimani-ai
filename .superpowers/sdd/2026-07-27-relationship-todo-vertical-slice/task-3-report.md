# Task 3 report: Person SharedTodo workspace

## 調査と判断

- React 公式「You Might Not Need an Effect」を確認し、外部システムとの同期でない UI 更新はイベントハンドラに置く方針を採用した。フォームは uncontrolled + `FormData`、成功後の reset は mutation の `onSuccess` に限定した。
  - https://react.dev/learn/you-might-not-need-an-effect
- TanStack Query 公式 mutation / invalidation を確認し、`useMutation` の `onSuccess` で対象 query key を `await invalidateQueries` してからフォームを reset する構成にした。楽観更新や重複する action state は置いていない。
  - https://tanstack.com/query/latest/docs/framework/react/guides/mutations
  - https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations
- 既存 Amidala / BYARD の調査結果に従い、Person Todo を汎用 dashboard ではなく People から選んだ相手との関係ワークスペースとして実装した。`[現在のメンバー] — Shared Todo — [相手]` の rail、作成者→現在の担当の rail、組織を失わない shell nav を共通化した。

## 実装範囲

- PersonCard 全体を型付き TanStack Router `Link` にし、`/$organizationId/people/$contextMembershipId/todos` へ遷移。
- Todo workspace route の loader で `ensureQueryData`、表示側で `useSuspenseQuery` を利用。
- title / description / assignee の uncontrolled composer、入力検証、mutation 中の disabled、API error / success 表示、awaited invalidation と reset。
- empty / pending / error / forbidden / not-found の recovery action。
- 390px を想定した縦積みレイアウト、44px touch target、fixed bottom nav の余白、既存 token / typography の再利用。

## 検証

実行結果（すべて成功）:

```text
pnpm --filter @amidala/web exec tsc --noEmit
pnpm --filter @amidala/web build
pnpm build
git diff --check
```

`vite build` により `apps/web/src/routeTree.gen.ts` も再生成された。
