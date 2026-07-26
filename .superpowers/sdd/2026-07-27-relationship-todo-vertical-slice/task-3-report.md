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

## レビュー後の修正

- 390px 幅で長い日本語の氏名が rail からはみ出さないよう、モバイル時のみ relationship rail / Todo card rail を縦積みに変更し、ラベルと責任の流れを保ったまま自然に折り返す CSS を追加した（デスクトップレイアウトは不変）。
- 空状態のフォーカスはPage所有の`RefObject`をComposerへ渡し、グローバルDOM検索なしでtitle inputへ移す。
- 修正後も Web tsc/build、monorepo build、`git diff --check` を再実行する。

レビュー追加修正: `document` のグローバル検索を廃止し、Page が所有する `RefObject` を Composer に渡して空状態 action から title input に focus する構造へ変更した。

最終レビュー修正: `useRef` を条件分岐より前へ移動し、loader 結果の status が変わっても Hooks の呼び出し順が一定になるようにした。

ブラウザ確認で、People route が親になった際に PeoplePage が `<Outlet />` を描画せず、Todo URL でも People 一覧を表示し続ける問題を発見した。People route を layout + `Outlet` に分離し、既存 loader / PeoplePage は `people/index.tsx` へ移動して、Todo 子 route が実際に描画される階層へ修正した。

ブラウザ fresh reload で、SSR (UTC) と client (JST) の Todo 作成日表示が異なり hydration mismatch になった。日本語プロダクトの基準タイムゾーン `Asia/Tokyo` を `Intl.DateTimeFormat` に明示して、SSR / client の出力を決定的にした。

## 最終ブラウザ検証

- 1280×900: ownerでloginし、Acme StudioのPeopleから佐藤花子のSharedTodo workspaceへ遷移。
- Todoを佐藤花子担当で作成し、一覧にtitle、未完了、作成者「田中 彩」、担当「佐藤 花子」が反映されることを確認。
- fresh tabのdirect SSRとPeopleからのclient navigationの両方で、headingとcomposerが描画された。
- 390×844: relationship railは縦積み、bottom nav表示、`scrollWidth === clientWidth`で横スクロールなし。
- fresh tabのbrowser console warning / errorは0件。
- focused integration 1/1、API unit 2/2、Web/monorepo build成功。独立レビューはCritical / Importantなしで承認。
