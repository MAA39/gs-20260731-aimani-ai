# React 19 / TanStack 実装プラクティス

調査日: 2026-07-26  
対象 version: React 19.1.1、TanStack Router 1.170.18、TanStack Start 1.168.32

## 中心原則

Effect は「React の外にある system と、画面表示を同期する」ために使う。render で計算できる値、クリックや submit が原因の処理、server data の取得には使わない。

## MUST / SHOULD / AVOID

| 区分 | 判断 |
|---|---|
| MUST | render を純粋に保ち、props/state から導ける値は render 中に計算する |
| MUST | click/submit が原因の更新は event handler、form action、Server Function で行う |
| MUST | route data は loader、共有する server state は TanStack Query で取得する |
| MUST | private data の認証・認可・validation は server handler 側で行う |
| MUST | SSR の QueryClient は request ごとに作り、hydrate/dehydrate 境界を明示する |
| SHOULD | critical data は loader で並行 prefetch し、不要な waterfall を避ける |
| SHOULD | route ごとに pending / error / not-found を設計する |
| SHOULD | filter/sort/page は typed URL search params に置き、render で導出する |
| SHOULD | mutation 後は所有する Query または Router を明示的に invalidate する |
| SHOULD | form の pending/error は action state に置き、`aria-live` で結果を伝える |
| AVOID | `useEffect(() => setState(derivedValue))` |
| AVOID | mount Effect から server data を fetch する |
| AVOID | 特定 event の後処理を Effect で監視する |
| AVOID | 根拠のない `memo` / `useMemo` / `useCallback` |
| AVOID | 全 search object を loader dependency にして不要な再取得を起こす |
| AVOID | browser/server で異なる日時・乱数・window値を初回 render に出す |

## Effect decision tree

```text
props/stateからrender中に計算できる?
  yes -> そのまま計算。高コストで計測済みの場合だけuseMemo
  no
  |
特定のclick/submitが原因?
  yes -> event handler / form action / Server Function
  no
  |
server dataを取得したい?
  yes -> route loader / TanStack Query
  no
  |
DOM widget、subscription、analytics表示など外部systemとの同期?
  yes -> useEffect。cleanupと必要ならAbortを実装
  no
  |
外部store/browser APIを購読する?
  yes -> useSyncExternalStore。SSRではgetServerSnapshotも定義
```

## React 19 primitive の使い分け

- `useActionState`: Login、Organization作成、Todo作成、Handoff decision の pending と予期可能な error。
- `useOptimistic`: 失敗時に元へ戻せる軽い変更だけ。Handoff acceptance のような権限・競合を伴う更新は、まず server result + invalidate を使う。
- `memo`: profiler で再render cost が問題になった component だけ。
- `useMemo`: 大きな計算または参照同一性が実際に必要な箇所だけ。
- `useCallback`: memoized child や external subscription が参照同一性を要求する箇所だけ。
- `useSyncExternalStore`: browser APIや外部storeの購読。通常のserver stateには使わない。

## Amidala v2 の次スライス

### Login / Organization

- route guard は遷移 UX。security boundary は Server Function / API handler。
- submit は form action + `useActionState`。
- session cookie と organization authorization は server-only。
- Organization ID は typed path/search から受け、Principal と照合する。

### People

- 最初の一覧は route loader でよい。
- 複数画面でPersonを共有し、再取得やmutationが増えた時にQueryを導入する。
- relationship filter は typed search params。Effectでlocal stateへ複製しない。
- person Link はintent prefetchを使う。

### Todo

- list/queryとcreate/update mutationを分ける。
- create formはaction state、成功後にlistをinvalidate。
- optimistic updateはrollbackが明瞭な完了toggleから検討する。

### Handoff

- accept/reject は POST の Server Function/API command。
- pending中は二重実行を止め、結果をstatus labelと`aria-live`へ反映する。
- server側でrecipient、organization、current statusを再検証する。
- 成功後にTodo assigneeとInboxをinvalidateする。

## 現在の shell 監査

- `useEffect`、derived state、不要なmemoはまだ存在しない。
- pathnameからpage titleを計算する実装はrender derivationであり妥当。
- People/Todo/Handoffは静的placeholderなので、次のsliceでloader/action/pending/errorを追加する。
- Organization switcher、account menu、People cardのbuttonはplaceholder。機能化する時にMenu/Link/actionの正しいsemanticへ置き換える。
- TanStack Queryはまだ入れない。route専有dataで始め、共有cache/mutationが必要になるTaskで導入する。
- StartのSSR entryとclient hydrationはbuild/local direct navigationで継続確認する。

## 公式根拠

- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [`useActionState`](https://react.dev/reference/react/useActionState)
- [`useOptimistic`](https://react.dev/reference/react/useOptimistic)
- [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
- [`memo`](https://react.dev/reference/react/memo)
- [`useMemo`](https://react.dev/reference/react/useMemo)
- [`useCallback`](https://react.dev/reference/react/useCallback)
- [TanStack Router data loading](https://tanstack.com/router/v1/docs/guide/data-loading)
- [TanStack Query integration](https://tanstack.com/router/latest/docs/integrations/query)
- [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Cloudflare Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
