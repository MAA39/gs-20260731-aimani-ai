# Claude Code 作業移管 — Amidala v2 最終正本

- 更新日: 2026-07-28（Asia/Tokyo）
- 正本の絶対パス: `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/HANDOFF-CLAUDE-2026-07-28.md`
- repository: `/Users/maa/Projects/gs/000_参照用/amidala-v2`
- GitHub: <https://github.com/MAA39/amidala-v2>
- コード基準SHA: `18366d915ce9ce8cc6df36795c124cff56ea921b`（PR #7 merge後）
- deploy: Cloudflareへ未deploy。production DB mutationも未実施
- 移管方針: Codexは本書をmergeしてworkspaceをcleanにした後、機能開発を停止する

## Claude Codeへの最初の依頼

次を新しいClaude Codeセッションの最初の依頼として使う。

> `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/HANDOFF-CLAUDE-2026-07-28.md` を最初から最後まで読み、必読資料を指定順に読んでください。この文書を現在状態の正本としてください。まずread-onlyでrootが`main`、clean、単一worktree、`origin/main`と同じSHAであることを確認し、`archive/pre-todo-handoff-local-20260727`をmerge・削除しないと確認してください。次にローカルserverを起動または継続利用し、`http://localhost:5173/org_acme_studio/today`をdesktop 1280x720とmobile 390x844で実際に操作してください。田中→森のActor Switch、Handoff依頼、森の受信・承認、田中の完了通知、browser console/hydrationを最初に確認してください。現在のCRUD/Handoffだけでは価値が伝わるか判断しづらかったというユーザー評価を出発点に、一般的なCRUDを増やさず、Todayが「いま誰のボールか」を3分で理解できるかをユーザーと判断してください。既存Amidala/BYARDは読み取り専用です。変更は最新`main`から分離worktreeを切り、小さいPRでreview・mergeしてください。実装直前に利用技術の最新公式資料を調査し、ドメイン語で命名し、不要な`useEffect`を避け、触れるUXへ時間を使ってください。

## 1. ユーザーの期待値

この新製品は金融システム級の過剰なhardeningを目指さない。優先順位は次のとおり。

1. ユーザーが画面を触り、価値と違和感を短時間で判断できる
2. 「誰が次に動くか」「いま誰のボールか」が明確になる
3. UI、関数、型、DBを同じドメイン語で表す
4. 後から拡張できる境界を持つ
5. tenant越境、認証主体、責任移管transactionなど本質的境界だけをテストで守る

coverage、テスト数、形式的完全性、細部だけのレビューは成果ではない。レビューは積極的に使うが、非blockingな細部で止まり続けない。

ユーザーが既存画面を触った時点の率直な評価は次のとおりだった。

> CRUDやHandoffが動くことは分かるが、これで良い体験なのか、何を追加すれば面白く・使いやすくなるのか、現画面だけでは分からない。

この評価を受け、PR #7で責任状態を一画面へ集める`Today`を追加した。実装できたことと、プロダクト仮説が検証できたことを混同しない。次の最優先は人間による実画面評価である。

## 2. 変更してよい範囲

変更対象:

- `/Users/maa/Projects/gs/000_参照用/amidala-v2`

調査専用。原則変更しない:

- `/Users/maa/Projects/gs/000_参照用/amidala`
- `/Users/maa/Projects/gs/000_参照用/amidala-angular`
- `/Users/maa/Projects/gs/000_参照用/amidala-admin`
- `/Users/maa/Projects/gs/000_参照用/amidala-infra`
- `/Users/maa/Projects/gs/000_参照用/BYARD`
- `/Users/maa/Projects/gs/000_参照用/kakeai.next`
- `/Users/maa/Projects/gs/000_参照用/inquiry.kakeai.com`

保護対象:

- `origin/archive/pre-todo-handoff-local-20260727`
- 保存commit: `98e8a2a`（統合前のユーザー所有local差分）
- 復元用履歴であり、明示依頼なしに`main`へmerge・削除しない

資格情報はDocs、log、PR、commitへ記載しない。会話中に共有された各種tokenは本書へ転載していない。

## 3. Git / PRの現在地

| PR | 内容 | 状態 / merge commit |
|---|---|---|
| [#1](https://github.com/MAA39/amidala-v2/pull/1) | Todo Handoff review | merged / `5b5b819` |
| [#2](https://github.com/MAA39/amidala-v2/pull/2) | Touchable MVP → main | merged / `d88213c` |
| [#3](https://github.com/MAA39/amidala-v2/pull/3) | 3分間Handoff demo仕様 | merged |
| [#4](https://github.com/MAA39/amidala-v2/pull/4) | 決定論的demo DB / hydration | merged |
| [#5](https://github.com/MAA39/amidala-v2/pull/5) | development-only Actor Switch | merged |
| [#6](https://github.com/MAA39/amidala-v2/pull/6) | stale Web build artifact除去 | merged / `344ae3d` |
| [#7](https://github.com/MAA39/amidala-v2/pull/7) | Today responsibility workspace | merged / `18366d9` |

PR #6ではTurbo cache hit時に既存`apps/web/dist`へ古いhashed assetが残り、過去のdemo credential bundleが復元される問題を修正した。root buildが明示的にWeb distをpruneしてからTurbo restoreする。

PR #7の独立reviewはCritical 0 / Important 0。CodeRabbit checkはsuccess。機能branch/worktreeはmerge後に削除済み。

この最終Docs PRのmerge commitは、本書のコード基準SHAより新しくなる。移管開始時は`git rev-parse HEAD`を正とする。

## 4. 実装済みの触れる体験

主要route:

```text
/login
/organizations
/$organizationId/today
/$organizationId/people
/$organizationId/people/$contextMembershipId/todos
/$organizationId/todos
/$organizationId/handoffs
```

実装済み:

- email/password login
- Organization選択
- Organization非依存`User`とOrganization所属`Membership`
- People一覧と相手との共有Todo
- 自分が担当するopen Todo
- message付きTodo Handoffの依頼
- recipientによるaccept / reject
- requesterによるcancel
- accept時のTodo担当変更とHandoff終端化を同一transactionで実行
- development-onlyの田中 彩 / 森 ハル Actor Switch
- 決定論的な専用`amidala_demo` DB reset
- `Today`責任ワークスペース

`Today`は既存read modelを合成し、追加API・追加DB・追加cacheを持たない。

- `あなたへの依頼`: 自分が受け取って判断すべきHandoff
- `いま自分が持つボール`: 自分がcurrent assigneeのopen Todo
- `相手の確認待ち`: 自分が依頼し、recipientの判断を待つHandoff
- `最近動いたボール`: 自分がpartyだった終端Handoff
- accept後は「責任が移りました」と次の担当者を表示
- Handoff入力は「背景と期待」として提示

## 5. 2026-07-28 ローカル実動線の証跡

証跡の詳細:

- `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/research/2026-07-28-today-runtime-verification.md`

ローカル`amidala_demo`をreset後、実画面と同じ経路で次を完走した。

```text
Browser相当HTTP
  → TanStack Start Web Worker
  → typed Server Function RPC
  → Cloudflare Service Binding
  → private Hono API Worker
  → local PostgreSQL
```

結果:

1. 田中・森のlogin: HTTP 200
2. 田中の初期Today SSR: 200。自分の担当Todoを確認
3. 田中から森へHandoff request Server Function: 200。typed result `ok`
4. 森のToday SSR: 200。依頼、Todo、背景と期待を確認
5. 森のaccept Server Function: 200。status `accepted`、assigneeが森へ変更
6. 森のToday SSR: 200。Todoが自分の担当へ移動
7. 田中のToday SSR: 200。「最近動いたボール」「責任が移りました」を確認
8. 田中のToday直リンク再読込SSR: 200。同じ状態を確認

これはRPC、認証cookie、API Worker、DB transaction、SSR projectionをまとめたruntime evidenceである。

## 6. 未証明のUI項目

Codex内ブラウザの既存local tabが接続失敗後の内部`data:` error pageになっており、URL policyにより`localhost`へ自動遷移できなかった。別ブラウザやstandalone Playwrightで迂回することはポリシー上行っていない。

したがって次は未証明であり、Claude Codeの最初の作業にする。

- desktop 1280x720でToday全体の視覚階層
- mobile 390x844のnavigation、card、dialog、横overflow
- 画面上のActor Switchを実際にclickした往復
- dialogから依頼し、card上でacceptする操作感
- browser console error / hydration warningの有無
- reduced-motion
- Today追加後に、3分で価値が伝わるかという人間のUX判断

HTTP runtimeが通ったことを、視覚・操作・価値仮説の検証済みとは扱わない。

## 7. ローカル起動と再現

```bash
cd /Users/maa/Projects/gs/000_参照用/amidala-v2
docker compose up -d postgres
pnpm db:demo:reset
pnpm dev
```

必要なignored設定:

- `/Users/maa/Projects/gs/000_参照用/amidala-v2/apps/api/.dev.vars`
  - `DATABASE_URL`はlocal host port `54329`の`amidala_demo`を向く
  - `BETTER_AUTH_SECRET`
  - `BETTER_AUTH_URL`
- `/Users/maa/Projects/gs/000_参照用/amidala-v2/apps/web/.env.development.local`
  - `VITE_DEMO_ACTOR_PASSWORD`

値は本書へ記載しない。現在のrootには両方存在し、Git管理外である。設定を変えた後は`pnpm dev`を再起動し、Workerへ読み直させる。

開始URL:

- <http://localhost:5173/org_acme_studio/today>

初期状態へ戻す時だけ`pnpm db:demo:reset`を使う。scriptはDB名が`amidala_demo`であることを検証する。既存・production DBを対象にしない。

移管時点ではlocal serverを停止せず、ユーザーがin-app browserを手動Reloadできる状態で残す。直前のruntime journey後なのでDBは「森が引き受け済み」の状態である。最初から触る場合はresetする。

## 8. 検証済みコマンド

PR #7 merge後の`main`でfresh実行済み:

```text
API tests: 13/13 PASS
Web tests: 12/12 PASS
full monorepo build: 3/3 PASS
production artifact demo marker scan: 0 matches
```

PR #7 branchでは追加で確認済み:

```text
PostgreSQL integration tests: 6/6 PASS
demo database safety test: 1/1 PASS
```

再実行:

```bash
pnpm --filter @amidala/api test
pnpm --filter @amidala/web test
pnpm build
! rg -n 'owner@amidala\.local|mori@amidala\.local|amidala-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist
```

## 9. アーキテクチャと配置

```text
Browser
  → TanStack Start Web Worker（SSR / Router / Query / thin BFF）
  → Cloudflare Service Binding
  → private Hono API Worker（auth / use case / repository）
  → Hyperdrive（production予定）
  → PostgreSQL
```

確定事項:

- pnpm workspace + Turborepo monorepo
- TanStack Start / Router / Query
- Hono private API Worker + Service Binding
- Better Auth core。Organization pluginは使わない
- PostgreSQL + Drizzle。D1は使わない
- productionはHyperdrive経由を想定。接続先providerは未確定
- AwilixはAPI composition rootだけ
- React 19、Tailwind CSS v4、Base UI、Lucide
- full Event Sourcingは使わない
- DDD/CQRSは語彙と境界を明確にする範囲だけ
- Webhookは将来別Workerに分離可能な境界だけ保ち、現時点では作らない

配置判断:

- Router依存は`apps/web/src/routes`
- ドメイン能力、UI断片、query、thin Server Function/BFFは`apps/web/src/features/<domain>`
- `createServerFn` wrapperは薄く保つ
- route loaderは`ensureQueryData`、Pageは同じquery optionsを読む
- server stateの正本はTanStack Query
- ユーザー操作はevent handler、派生値はrenderで表し、状態同期だけの`useEffect`を避ける
- APIはdomain → application use case → repository → Hono adapterの向きを守る

## 10. ドメインモデルの核

- `User`: Organizationから独立した認証主体
- `Account`: password / OAuth credential
- `Organization`: workspace / tenant
- `Membership`: UserとOrganizationの所属関係、組織内profileとrole
- `CurrentMembershipContext`: session Userと検証済みMembershipから作る認可文脈
- `Relationship`: 同一Organization内のMembership間関係
- `Todo`: creatorとcurrent assigneeを分けたwork item
- `TodoHandoff`: current assigneeが別Membershipへ責任移管を依頼した記録

Organization内の業務actorはUser IDでなくMembership IDを使う。「UserはOrganizationから独立し、Membershipで所属する」はBYARD系から継承した新製品の核である。

Todo Handoffの不変条件:

- requesterは依頼時のcurrent assignee
- recipientは同一Organizationのactive Membership
- 同じTodoにopenなrequested Handoffは1件
- acceptだけがcurrent assigneeをrecipientへ移す
- Handoff終端化と担当変更は同一transaction
- party scopeを越えた履歴を返さない
- UIへupstream raw errorやsnake_caseを漏らさない

## 11. デザイン / UX基準

- relationship-first。相手との文脈からTodo/Handoffへ進む
- Todayでは責任状態を優先度順に一画面へ集約する
- indigoを軸にするが、汎用admin templateにはしない
- 8px rhythm、十分な余白、44px前後の操作面
- statusは色だけに依存せず、語とiconを併用する
- Base UIはprimitiveだけ。見た目と語彙はプロダクトが所有する
- desktop/mobileで同じ情報階層を守る
- pending/error/empty/successを画面仕様として扱う
- Storybookや巨大design systemを先に作らない
- motionは意味のある遷移だけ。`prefers-reduced-motion`を尊重する

必読:

- `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/design/foundation.md`
- `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/product/legacy-ux-audit.md`
- `/Users/maa/Projects/gs/000_参照用/Docs/19_todo_transfer_history_exhaustive_analysis.md`
- `/Users/maa/Projects/gs/000_参照用/Docs/20_byard_responsibility_roles_exhaustive_analysis.md`

## 12. 技術・実装の必読資料

順番:

1. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/README.md`
2. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/standards/reusable-product-baseline.md`
3. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/standards/research-before-build.md`
4. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/standards/react-tanstack-practices.md`
5. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/standards/domain-language-and-naming.md`
6. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/decisions/0001-technology-selection-2026-07-26.md`
7. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/superpowers/specs/2026-07-26-amidala-v2-platform-design.md`
8. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/superpowers/specs/2026-07-27-three-minute-handoff-demo-design.md`
9. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/superpowers/plans/2026-07-28-today-workspace.md`
10. `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/research/2026-07-28-today-runtime-verification.md`

横断調査:

- `/Users/maa/Projects/gs/000_参照用/Docs/23_tanstack_start_source_ledger.md`
- `/Users/maa/Projects/gs/000_参照用/Docs/24_tanstack_start_engineering_standard.md`
- `/Users/maa/Projects/gs/000_参照用/Docs/25_tanstack_start_nextjs_principles_matrix.md`
- `/Users/maa/Projects/gs/000_参照用/Docs/26_tanstack_start_recipes.md`
- `/Users/maa/Downloads/docswell-Z8NMGQ.pdf`

新しい判断では2026-07-28時点の記録を盲信せず、実装直前に現在の公式一次資料を確認する。外部記事は発想の根拠、公式Docsと実コードは技術事実の根拠として扱う。

## 13. 非blockingな既知事項

- 通常契約にない極端に長い改行なしTodo名・人名はshared cardでoverflowし得る
- Today section keyに、契約必須IDが欠落した場合だけindex fallbackがある
- reduced-motionとToday追加後のresponsive visualは未確認
- CI / preview workflowは未作成
- production PostgreSQL / Hyperdrive resourceは未作成
- Cloudflare deployは未実施

これらを理由に、触れるUXの評価を後回しにしない。

## 14. 次にやること / やらないこと

最優先:

1. ユーザーがin-app browserをReloadする
2. Claude Codeがdesktop/mobileで田中→森の3分journeyを操作する
3. UXとして「いま誰のボールか」が伝わるか、ユーザーと判断する
4. 次の一つの価値仮説だけを提案する
5. 合意後、最新`main`から分離worktreeを切り、小PRで実装・review・mergeする

候補は仮説であり、実装確定ではない。

- Todayの情報優先度・空状態・CTA改善
- Handoff後の「次に何をするか」をさらに強く示す
- 背景、期待、期限・確認事項のうち、本当に必要な文脈だけを補う
- 通知を作る前に、Todayの気づきやすさを確認する

一般的なCRUD backlog、full ES、generic workflow、Queue/Webhook Worker、RLS、汎用policy engine、網羅テスト、大規模design systemは必要になるまで作らない。

## 15. 移管開始時チェックリスト

```text
[ ] この文書を最後まで読んだ
[ ] rootがmain / clean / origin/main一致 / 単一worktreeである
[ ] archive branchをmerge・削除しないと確認した
[ ] PR #1〜#7と最終Docs PRの状態を確認した
[ ] ignored local envの存在だけを確認し、値を表示していない
[ ] local serverとPostgreSQLの状態を確認した
[ ] desktop/mobile/browser consoleでTodayを操作した
[ ] HTTP runtime PASSと視覚UX未証明を混同していない
[ ] 次の作業を一つの触れるjourneyへ絞った
[ ] 現行公式Docsを調査してから実装する
[ ] 分離worktree、小PR、review、mergeで進める
[ ] Cloudflare deployはユーザーの明示依頼まで行わない
```

## 16. Codex停止条件

Codexは次を満たした後に停止し、以降をClaude Codeへ移管する。

```text
- PR #1〜#7がmainへ統合済み
- 3分間Handoff runtime journeyがlocalでPASS
- 本書とruntime証跡がDocs PRでmainへ統合済み
- Docs PRのreview/checkが完了
- Docs worktreeとbranchを削除済み
- git worktree listはroot 1件だけ
- rootはmain、clean、origin/mainと一致
- open PRは0件
- archive branchはremoteに保存されmainへ未merge
- local dev serverはユーザーがReloadできるよう稼働を維持
- Cloudflare deployは行っていない
```
