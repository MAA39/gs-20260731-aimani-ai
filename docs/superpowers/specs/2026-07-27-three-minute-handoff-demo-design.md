# Three-minute Handoff Demo Design

- 日付: 2026-07-27
- 状態: 実装対象
- 対象: Amidala v2
- 目的: 「普通のTodo管理と何が違うのか」を3分の操作で判断できる状態にする

## 1. 結論

不足CRUDを順番に追加しない。次の一本だけを完成させる。

```text
田中 彩として「顧客インタビューの論点を整理する」を確認
  → 背景と期待を添えて森 ハルへ渡す
  → 開発用Actor Switchで森 ハルへ切り替える
  → 「今日のボール」で自分への依頼を確認する
  → 引き受ける
  → Todoと次の一手が森 ハルへ移ったことを同じ画面で確認する
```

これは本番の代理ログイン機能ではない。ローカルPoCでプロダクト仮説を短時間に検証するためのdemo experienceである。

## 2. 成功条件

fresh local databaseから、ユーザーが説明なしで次を完了できる。

1. 画面上で現在actorが田中 彩だと分かる
2. 「今日のボール」に、田中が現在持つ意味のあるTodoが1〜3件だけ表示される
3. Todoを森へ渡す際、「何を」「なぜ」「次に何を期待するか」が読める
4. development限定のActor Switchで森へ切り替えられる
5. 森の「あなたへの依頼」に先ほどのTodoが現れる
6. 森が引き受けると、incomingから消え、自分のボールへ移る
7. 田中へ戻ると、そのTodoが「森が進める」に移ったことが分かる
8. direct reloadでも同じ状態を表示する
9. desktop 1280×720とmobile 390×844で主要操作ができる
10. browser consoleにhydration warning/errorがない

## 3. 優先度とブロック

### P0: 判断を妨げるもの

- local appがintegration test databaseを参照し、fixtureが大量表示されている
- account表示が「ログイン中 / アカウント」で、actorを識別できない
- actor往復を行うUIがない
- `<div>`が`<html>`直下にあるというReact hydration warningが出る

P0が残る間は、Today画面を作ってもプロダクト価値を判断できない。

### P1: プロダクト仮説を表現するもの

- 「今日のボール」画面
- incoming / own / waiting-on-othersの3区分
- Handoff messageの表示語を「背景と期待」へ揃える
- accept後の状態変化を同じ画面で見せる

### P2: 価値確認後

- Cloudflare preview
- production PostgreSQL / Hyperdrive
- Todo edit/delete/search
- notification / Webhook

## 4. 採用アプローチ

### Development-only Actor Switch

`import.meta.env.DEV`でのみ表示する`DemoActorSwitcher`を作る。Better Authの`signOut()`、`signIn.email()`、`useSession()`を公式APIどおり使う。

- 表示対象: 田中 彩、森 ハル
- credential: 既存local seed accounts。passwordはignoredな`apps/web/.env.development.local`の`VITE_DEMO_ACTOR_PASSWORD`からdevelopment buildだけへ渡す
- `LoginForm.tsx`にあるpassword初期値とcredential表示は削除し、通常loginは空のpassword入力に戻す
- `DemoActorSwitcher`は`import.meta.env.DEV && import.meta.env.VITE_DEMO_ACTOR_PASSWORD`の両方が成立するときだけ表示する
- production buildはdemo passwordを設定せず作り、生成artifactにdemo email/passwordが存在しないことを検査する
- 動作: sign out → selected demo accountでsign in → current organizationのTodayへ遷移
- pending中は操作をdisabled
- 失敗時は固定日本語を表示し、内部messageを出さない
- 現在actorのname/emailをshellへ表示

Better Auth公式はReact clientの`useSession`をreactive session正本とし、`signOut`と`signIn.email`を公開している。

- <https://better-auth.com/docs/concepts/client>
- <https://better-auth.com/docs/basic-usage>

本番でのimpersonation、管理者代理操作、任意ユーザー切替は対象外。

### Todayは既存read modelをcompositionする

新しい汎用dashboard APIは作らない。route loaderが既存の次のquery optionsを並列に`ensureQueryData`し、Pageが同じqueryを`useSuspenseQuery`で読む。

- `assignedTodoWorkspaceQuery(organizationId)`
- `todoHandoffWorkspaceQuery(organizationId)`

TanStack Router/Query公式のloader prefetch + `useSuspenseQuery`をそのまま使い、独自cacheや`useEffect`同期を追加しない。

- <https://tanstack.com/router/latest/docs/integrations/query>

表示区分:

1. `あなたへの依頼`: incoming requested Handoff
2. `いま自分が持つボール`: open Assigned Todo
3. `相手の返答を待っている`: outgoing requested Handoff

既存Handoff mutationを再利用し、success時のquery invalidation対象へTodayが消費する既存query keyを含める。新しいToday固有cacheは作らない。

### Demo dataは専用databaseへ分離する

integration test databaseを画面用に使わない。local demoは`amidala_demo`、integrationは`amidala_handoff`を使う。

`db:demo:reset`は次の安全条件をすべて満たす場合だけ実行する。

- hostnameが`127.0.0.1`または`localhost`
- database名が`amidala_demo`
- production/preview bindingを使用しない

resetは`public` schemaを作り直し、全migrationとdeterministic demo seedを適用する。既存`db:seed`はupsert用途のまま保つ。

意味のあるseed story:

- 田中が現在担当: 「顧客インタビューの論点を整理する」
- 説明: 「次回の検証で確かめたい仮説を3つに絞る」
- 田中と森はAcme Studioのactive Membership
- 初期Handoffなし
- 他のTodoは最大2件。random/timestamp fixtureを作らない

## 5. Hydration修正

TanStack Start公式どおり、root route componentがdocument全体を返し、clientはTanStack Start既定entryが`document`をhydrateする構造に固定する。

```tsx
function RootComponent() {
  return (
    <RootDocument>
      <ApplicationShell />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  )
}
```

現コードの`RootDocument`はこの公式構造と一致している。一方、`apps/web/index.html`と`apps/web/src/main.tsx`には、`#root`へ`createRoot`する旧Vite SPA entryが残っている。TanStack Start既定entryは`hydrateRoot(document, <StartClient />)`を使うため、2つのclient entryを共存させない。

- `apps/web/index.html`と`apps/web/src/main.tsx`を削除する
- direct requestのSSR HTMLが`<!DOCTYPE html><html>`から始まり、`#root`を含まないことを確認する
- fresh navigation / direct reloadの両方でReact hydration warningとconsole errorが0件であることを確認する

導入済み`@tanstack/react-router@1.170.18`には`createRootRoute`の`shellComponent` optionがなく、現行公式例もroot componentから`html/head/body`を返す。この版には存在しないAPIを設計へ導入しない。

公式root route:

- <https://tanstack.com/start/latest/docs/framework/react/guide/routing>

## 6. 画面設計

### Shell

- primary navigation先頭を`今日のボール`にする
- account areaにavatar initial、actor name、emailを表示
- development時だけActor Switch buttonを表示
- People / 共有Todo / 自分のTodo / 引き継ぎは既存routeとして残す

### 今日のボール

header:

```text
Acme Studio
今日のボール
次に誰が動くかを、ここで揃えます。
```

優先順:

1. あなたへの依頼
2. いま自分が持つボール
3. 相手の返答を待っている

incomingがある場合は最初のcardを強調するが、色だけに依存しない。「確認が必要」labelを出す。accept/rejectは既存`HandoffRequestCard`を再利用する。

Assigned TodoのHandoff actionも既存`RequestTodoHandoffDialog`を再利用する。別componentへ同じmutationを複製しない。

empty stateは「0件」で終わらず、次の導線を一つだけ示す。

### Copy

- `引き継ぎ`は機能名として残す
- request field label: `背景と期待（任意）`
- incoming section: `あなたへの依頼`
- assigned section: `いま自分が持つボール`
- outgoing section: `相手の返答を待っている`
- accepted announcement: `森 ハルさんが次の担当になりました`

## 7. Stateとerror

- URL state: Organization IDとroute
- server state: TanStack Query
- local interaction state: dialog open、selected actor、pending、aria-live message
- mutationを`useEffect`から呼ばない
- actor switch成功後はQueryClientをclearして別actorのcache漏れを防ぐ
- actor switch中に失敗した場合はlogin pageへ逃がさず、その場で再試行できる
- 401はlogin、403はOrganization再選択、transport failureは固定日本語

## 8. PR境界

### PR1 — Demo foundation

- safe `db:demo:reset`
- deterministic demo seed
- local environment example/documentation
- hydration warningの再現と修正
- fresh demo DBで既存主要routeが表示できることを確認

### PR2 — Demo Actor Switch

- shellへ現在actor表示
- development限定Actor Switch
- QueryClient clear + Todayへの遷移
- 田中↔森の切替を実ブラウザ確認

### PR3 — Today experience

- `/$organizationId/today`
- loaderで既存2queryを並列prefetch
- incoming / assigned / outgoing composition
- navigationとcopy更新
- 田中request → 森accept → 田中確認を完走

各PRはClaude/Codex review、関連tests、typecheck、build、browser smokeを通してからmerge commit方式で`main`へ統合する。次PRは更新済み`main`から切る。

## 9. Test budget

テスト数を成果にしない。次だけを守る。

- reset guardがnon-local/non-demo DBを拒否するpure test
- deterministic seedの主要storyをPostgreSQLで1本確認
- Actor Switchのactor定義と固定日本語errorをpure test
- Today compositionの区分をpure function test
- existing Todo Handoff integration 6 tests
- final browser journey 1本

UI snapshotの大量作成、coverage gate、全branch testは行わない。

## 10. 対象外

- production impersonation
- arbitrary user selector
- user/organization CRUD
- Todo edit/delete/search
- notification、Webhook、Queue
- Cloudflare deploy
- generic dashboard builder
- Event Sourcing

## 11. 完了定義

- 3つのPRが`main`へmerge済み
- feature branch/worktreeが残っていない
- fresh `amidala_demo`で3分journeyを完走
- current actorと次のactorが全画面で明確
- accept前後の責任移動がTodayで理解できる
- desktop/mobileで操作可能
- browser console warning/error 0
- Web/API tests、PostgreSQL integration、typecheck、full buildがpass
- 本書、実装計画、検証記録、Claude引き継ぎ正本を更新
