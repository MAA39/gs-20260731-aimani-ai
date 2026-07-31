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
| SHOULD | Query mutationの`onSuccess`で対象query keyの`invalidateQueries`をawaitし、再取得完了後にformをresetする |
| MUST | Query keyだけを使うclient componentは、Server Function/queryFnをimportするmoduleではなくside-effect-free key moduleに依存する |
| SHOULD | form の pending/error は action state に置き、`aria-live` で結果を伝える |
| MUST | SSRされる日時はproduct timezoneを明示し、server/client runtimeのtimezoneへ依存しない |
| MUST | 子routeを持つfile routeは`Outlet`を描画するか、componentなしlayout + exact index routeへ分ける |
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

- `useActionState`: Query cacheを共有しない単発formのpendingと予期可能なerror。LoginやOrganization作成が候補。
- `useMutation`: Todo作成やHandoff decisionのように、成功後に複数画面のserver stateをinvalidateするcommand。
- `useOptimistic`: 失敗時に元へ戻せる軽い変更だけ。Handoff acceptance のような権限・競合を伴う更新は、まず server result + invalidate を使う。
- `memo`: profiler で再render cost が問題になった component だけ。
- `useMemo`: 大きな計算または参照同一性が実際に必要な箇所だけ。
- `useCallback`: memoized child や external subscription が参照同一性を要求する箇所だけ。
- `useSyncExternalStore`: browser APIや外部storeの購読。通常のserver stateには使わない。

## Aimani AI v2 の次スライス

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
- loaderで`ensureQueryData`、Pageで`useSuspenseQuery`、create formは`useMutation`を使う。
- success callbackで関連Queryの`invalidateQueries`をawaitし、再取得が終わるまでpendingを維持する。
- `useActionState`とQuery mutationを同じformの二重状態管理として併用しない。
- Todo作成は自動retry、offline永続化、楽観追加を行わない。
- optimistic updateはrollbackが明瞭な完了toggleから検討する。

### Handoff

- accept/reject は POST の Server Function/API command。
- pending中は二重実行を止め、結果をstatus labelと`aria-live`へ反映する。
- server側でrecipient、organization、current statusを再検証する。
- 成功後にTodo assigneeとInboxをinvalidateする。

## 現在の shell 監査

### Handoff 検証で再利用する実装基準

- Dialogは依頼入力に限定し、inline decisionは確認Dialogへ二重化しない。閉じる操作では元のtriggerへfocusを戻し、依頼成功後にtriggerが置換される場合は安定したTodo action/status wrapperへfocusを移す。
- Handoff mutation成功後はTodo assignee・Handoff inbox・Assigned Todoを所有するQuery keyへ明示的に`invalidateQueries`し、再取得完了後にformをresetする。競合結果は汎用500ではなく、verbごとのhandled 409 copyへ変換する。
- Organization IDはtyped pathに保持し、loader/API queryとnavigation Linkの両方で同じIDを利用する。SSR direct reloadでもrequestごとのQueryClientで同じOrganization境界を再現する。
- InboxはOrganization内のrequestedをrecipient Membership、terminalをrequester/recipient partyでscopeする。terminalは`resolvedAt DESC`で並べ、scope/filter後にSQLでlimitする。Assigned queryはopen Todoだけを返す。
- loaderでprefetchしたrouteもPageは同じqueryOptionsの`useSuspenseQuery`を読む。CTAはstatusだけでなくactorとcurrent assigneeを確認し、terminal日時は`resolvedAt`を表示する。
- 実ブラウザ確認では、focus/overflow/SSR/consoleを画面サイズ別に記録する。Todo Handoffではdesktop 1280×720、mobile 390×844で確認し、warn/error logsは空だった。reduced-motionだけは未エミュレートでpendingとする。
- Query keyのみが必要なmutation componentから`*-queries.ts`をimportすると、そのquery moduleがServer Function/server-only adapterを含む場合、TanStack Startのauthenticated SSRがTTFB前でstuckすることがある。keyは`*-query-key.ts`のようなside-effect-free leafへ分離し、direct SSRでToday/Todo/Handoffも確認する。実測は`docs/research/2026-07-28-team-work-overview-runtime-verification.md`。

- `useEffect`、derived state、不要なmemoはまだ存在しない。
- pathnameからpage titleを計算する実装はrender derivationであり妥当。
- PeopleとPerson SharedTodoはloader/action/pending/errorを持つ。Handoffだけが次sliceのplaceholder。
- People cardはOrganization/Context Membershipを保持するsemantic Link、Todo composerはuncontrolled form + `useMutation`になった。
- TanStack QueryはrequestごとのQueryClientで導入済み。loaderの`ensureQueryData`とPageの`useSuspenseQuery`を同じqueryOptionsで接続する。
- Person SharedTodo作成後はexact query keyをawait invalidateし、作成者・現在担当を一覧本体へ反映してからformをresetする。
- People親routeはOutlet専用、People一覧はexact index childとする。子route追加後はURLだけでなく実browser遷移を確認する。
- Todo作成日は`Asia/Tokyo`を明示し、SSR/client hydrationを決定的にする。
- StartのSSR entryとclient hydrationはbuild/local direct navigationで継続確認する。

## Cloudflare deploy toolchain

- API/Webとも`wrangler 4.114.0`を各workspaceへ明示する。transitive CLIへ依存しない。
- WebのTanStack Start生成`dist/server/wrangler.json`はWeb workspaceのWranglerでdry-runする。
- 4.102では生成configの`exports`がunknown field警告になり、4.114では警告なく通ることを2026-07-27に確認した。

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
