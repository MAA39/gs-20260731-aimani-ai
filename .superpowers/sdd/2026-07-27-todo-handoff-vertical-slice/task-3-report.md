# Task 3 report

status: DONE_WITH_CONCERNS

## 実装

- Base UI 1.6.0 を追加し、Todo Handoff依頼Dialog、候補状態/validation/conflict、close→invalidate→focusを実装。
- Assigned Todo と Handoff workspaceを組織スコープのtyped routeへ追加。incoming accept/reject、outgoing cancel、Tokyo固定日時、query invalidationを実装。
- Person SharedTodo/Assigned Todoの現在担当カードに安定したfocus wrapperとpending railを追加。既存tokens/relationship rail/390px responsive CSSを再利用。
- global `/todos`・`/handoffs` placeholderを削除し、生成route treeを更新。Organization navは未選択時Organizationsへ遷移。

## 検証

- `pnpm --filter @amidala/web exec tsc --noEmit` passed
- `pnpm --filter @amidala/web build` passed
- `git diff --check` passed
- commit: `aae9d23 feat: add touchable Todo Handoff workspace`

## 懸念

- ブラウザ実画面確認はTask 4境界のため未実施。
- Handoff mutationの409後コピーはmutation状態のinvalidate後に再描画される設計で、専用toastは未導入。

## Fix round 1

- 409 conflictをcard内resultMessage/role=statusへ表示し、success・forbidden・errorもevent handler後にannounce。
- Dialogのrecipientをcontrolled state化し、未選択/pending時submit disabled。close handlerでselection/errorをreset（Effectなし）。
- Person Todo pathnameではTodos linkのtyped targetを維持したままclass/aria-currentのみactive化。
- Person Todo pending表示に依頼メッセージを追加。
- Handoff railをstatus別にrequested=提案、accepted=責任移動/connected、rejected/canceled=変更なし/neutralへ明示。
- mutation progress/resultをcard aria-live領域へ表示。

検証: `pnpm --filter @amidala/web exec tsc --noEmit`、`pnpm --filter @amidala/web build`、`git diff --check` 全てpass。
