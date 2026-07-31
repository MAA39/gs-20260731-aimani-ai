# Claude Code 作業移管 — Aimani AI v2 最終正本

- 更新日: 2026-07-28（Asia/Tokyo）
- 正本の絶対パス: `<repo-root>/docs/HANDOFF-CLAUDE-2026-07-28.md`
- repository: `<repo-root>`
- GitHub: <https://github.com/MAA39/gs-20260731-aimani-ai>
- コード統合merge SHA: `4f446b4`（Team Work Overviewをlocal `main`へ統合。最終Docs commitはこの後）
- deploy: Cloudflareへ未deploy。production DB mutationも未実施
- 移管方針: Codexは本書をmergeしてworkspaceをcleanにした後、機能開発を停止する

## Claude Codeへの最初の依頼

次を新しいClaude Codeセッションの最初の依頼として使う。

> `<repo-root>/docs/HANDOFF-CLAUDE-2026-07-28.md` を最初から最後まで読み、必読資料を指定順に読んでください。この文書を現在状態の正本としてください。まずread-onlyでrootが`main`、clean、単一worktreeであることと、local `main`が`origin/main` (`ee9b567`)よりTeam Work OverviewとDocsのcommit分だけaheadであることを確認してください。ユーザーの明示指示によりこの差分はpushしていません。`archive/pre-todo-handoff-local-20260727`をmerge・削除しないでください。次に`http://localhost:5173/org_acme_studio/work`と`/today`をdesktop 1280x720 / mobile 390x844で操作し、田中groupの対応中→森の確認待ち→森groupへ責任移動→最近完了のjourneyを確認してください。「誰の作業が今どこでどうなっているか」が本当に素早く分かるかをユーザーと評価し、一般的なCRUDや管理ダッシュボードを増やさないでください。既存Aimani AI/BYARDは読み取り専用です。変更は必要とユーザーが合意した一つのjourneyに絞り、実装前に公式資料と現行コードを調査してください。

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

- `<repo-root>`

調査専用。原則変更しない:

- `<repo-root>/aimani-ai`
- `<repo-root>/aimani-ai-angular`
- `<repo-root>/aimani-ai-admin`
- `<repo-root>/aimani-ai-infra`
- `<repo-root>/BYARD`
- `<repo-root>/kakeai.next`
- `<repo-root>/inquiry.kakeai.com`

保護対象:

- `origin/archive/pre-todo-handoff-local-20260727`
- 保存commit: `98e8a2a`（統合前のユーザー所有local差分）
- 復元用履歴であり、明示依頼なしに`main`へmerge・削除しない

資格情報はDocs、log、PR、commitへ記載しない。会話中に共有された各種tokenは本書へ転載していない。

## 3. Git / PRの現在地

| PR | 内容 | 状態 / merge commit |
|---|---|---|
| [#1](https://github.com/MAA39/gs-20260731-aimani-ai/pull/1) | Todo Handoff review | merged / `5b5b819` |
| [#2](https://github.com/MAA39/gs-20260731-aimani-ai/pull/2) | Touchable MVP → main | merged / `d88213c` |
| [#3](https://github.com/MAA39/gs-20260731-aimani-ai/pull/3) | 3分間Handoff demo仕様 | merged |
| [#4](https://github.com/MAA39/gs-20260731-aimani-ai/pull/4) | 決定論的demo DB / hydration | merged |
| [#5](https://github.com/MAA39/gs-20260731-aimani-ai/pull/5) | development-only Actor Switch | merged |
| [#6](https://github.com/MAA39/gs-20260731-aimani-ai/pull/6) | stale Web build artifact除去 | merged / `344ae3d` |
| [#7](https://github.com/MAA39/gs-20260731-aimani-ai/pull/7) | Today responsibility workspace | merged / `18366d9` |
| [#8](https://github.com/MAA39/gs-20260731-aimani-ai/pull/8) | 本書とlocal runtime証跡 | merged / `b4adc51` |
| [#9](https://github.com/MAA39/gs-20260731-aimani-ai/pull/9) | Work lifecycle visibility設計 | merged / `8461e8a` |
| [#10](https://github.com/MAA39/gs-20260731-aimani-ai/pull/10) | Todo Completion | merged / `7244f7f` |
| [#11](https://github.com/MAA39/gs-20260731-aimani-ai/pull/11) | Handoff Next Action | merged / `ee9b567` |
| local only | Team Work Overview | reviewed / runtime PASS / push・PRなし |

PR #6ではTurbo cache hit時に既存`apps/web/dist`へ古いhashed assetが残り、過去のdemo credential bundleが復元される問題を修正した。root buildが明示的にWeb distをpruneしてからTurbo restoreする。

PR #7の独立reviewはCritical 0 / Important 0。CodeRabbit checkはsuccess。機能branch/worktreeはmerge後に削除済み。

PR #8のDocs差分は独立Codex reviewerがrepo、GitHub、local runtime、DB状態、絶対パス、資格情報patternと照合した。旧7/27文書が自分自身を正本と呼ぶ矛盾をImportantとして検出し、7/28正本への転送だけに修正後、再reviewで`APPROVED`となった。ローカルClaude CLIにも同じread-only reviewを依頼したが、数分間出力がなく打ち切った。無応答を承認とは扱っていない。

Team Work Overviewとこの最終Docsはユーザー指示によりlocal mergeだけ行った。Team Work統合mergeは`4f446b4`。移管開始時は`git rev-parse HEAD`を正とし、`origin/main`との差を勝手にpushしない。

## 4. 実装済みの触れる体験

主要route:

```text
/login
/organizations
/$organizationId/today
/$organizationId/work
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
- 決定論的な専用`aimani_ai_demo` DB reset
- `Today`責任ワークスペース
- current assigneeによるTodo Completion
- Handoff accept時の受領者の`次の一手`
- Organization全体のread-only `TeamWorkOverview`（UI: `チームのボール`）

`Today`は既存read modelを合成し、追加API・追加DB・追加cacheを持たない。

- `あなたへの依頼`: 自分が受け取って判断すべきHandoff
- `いま自分が持つボール`: 自分がcurrent assigneeのopen Todo
- `相手の確認待ち`: 自分が依頼し、recipientの判断を待つHandoff
- `最近動いたボール`: 自分がpartyだった終端Handoff
- accept後は「責任が移りました」と次の担当者を表示
- Handoff入力は「背景と期待」として提示

## 5. 2026-07-28 ローカル実動線の証跡

証跡の詳細:

- `<repo-root>/docs/research/2026-07-28-today-runtime-verification.md`

ローカル`aimani_ai_demo`をreset後、実画面と同じ経路で次を完走した。

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

## 6. Todo完了のUI実測

controller実測（2026-07-28、`task-5-browser-results.md`）では、Todo完了journeyの責任状態とviewport境界を確認済みである。desktop 1280x720 / mobile 390x844とも横overflowなし、完了確認Dialogはviewport内、cancel後にtriggerへfocus復帰。田中のToday / AssignedからTodoが消え、live-region「Todoを完了しました。」を表示。森のshared workspaceには「完了」として残り、完了TodoにHandoff依頼actionは出ない。pending Handoff作成後は完了actionが非表示でdirect reload後も維持され、browser console error / warningは0件。

これは指定controllerによるruntime evidenceであり、3分で価値が伝わるかという人間のUX判断とは区別する。

HTTP runtimeが通ったことを、視覚・操作・価値仮説の検証済みとは扱わない。

## 6.1 Team Work OverviewのUI実測

詳細証跡:

- `<repo-root>/docs/research/2026-07-28-team-work-overview-runtime-verification.md`

local `aimani_ai_demo`をreset後、田中から森へHandoff依頼、森が次の一手付きでaccept、森がTodo完了までを実ブラウザで完走した。

- 初期: 田中group / `対応中`
- Handoff requested: 田中groupのまま / `森 ハルさんの確認待ち`
- accepted: 森groupへ移動 / `対応中`
- completed: open groupから消え、`最近完了`へ移動
- Northstar path: 403でAcme Todo非表示
- desktop 1280x720 / mobile 390x844: 横overflowなし
- mobile bottom nav: 5項目、各56px高、nowrap
- console warning / error: 0件

実装はchart/Kanban/tableではなく、既存TodoCardと責任railを担当者ごとに縦積みするread-only画面である。操作はToday/自分のTodoに置き、Organization俯瞰画面にmutationを重複させていない。

runtimeで、Query keyだけが必要なclient componentからServer Functionを含むquery moduleをimportすると、authenticated SSRがTTFB前でstuckする問題を検出した。`team-work-query-key.ts`へside-effect-free leaf分離し、cold restart後にWork/Today/Todo/HandoffがすべてHTTP 200 / 34〜56msへ復帰した。このルールは他製品でも再利用する。

## 7. ローカル起動と再現

```bash
cd <repo-root>
docker compose up -d postgres
pnpm db:demo:reset
pnpm dev
```

必要なignored設定:

- `<repo-root>/apps/api/.dev.vars`
  - `DATABASE_URL`はlocal host port `54329`の`aimani_ai_demo`を向く
  - `BETTER_AUTH_SECRET`
  - `BETTER_AUTH_URL`
- `<repo-root>/apps/web/.env.development.local`
  - `VITE_DEMO_ACTOR_PASSWORD`

値は本書へ記載しない。現在のrootには両方存在し、Git管理外である。設定を変えた後は`pnpm dev`を再起動し、Workerへ読み直させる。

開始URL:

- <http://localhost:5173/org_acme_studio/today>

初期状態へ戻す時だけ`pnpm db:demo:reset`を使う。scriptはDB名が`aimani_ai_demo`であることを検証する。既存・production DBを対象にしない。

移管時点ではlocal serverをroot `main`から起動し、ユーザーがin-app browserをReloadできる状態で残す。`aimani_ai_demo`は最終journey後にresetし、田中の初期Todoがopenな状態に戻す。

## 8. 検証済みコマンド

Todo完了branch（`bd47a9c`）で最終review修正後にcontrollerがfresh実行した結果:

```text
API tests: 13/13 PASS
Web tests: 14/14 PASS
PostgreSQL integration tests: 10/10 PASS
demo seed test: 1/1 PASS（demo DB reset後、TEST_DATABASE_URLを明示）
full monorepo build: 3/3 PASS
production artifact demo marker scan: 0 matches
git diff --check: PASS
```

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
pnpm --filter @aimani-ai/api test
pnpm --filter @aimani-ai/web test
pnpm build
! rg -n 'owner@aimani-ai\.local|mori@aimani-ai\.local|aimani-ai-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist
```

### Handoff next action Task 5 fresh verification（2026-07-28）

worktree `handoff-next-action` の HEAD `ff48046` で、機密値を表示せず次を再実行した。

```text
API unit: 13/13 PASS（約1.1s）
Web tests: 14/14 PASS（約0.64s）
PostgreSQL integration（127.0.0.1:54329/aimani_ai_handoff）: 18/18 PASS（約4.55s）
demo seed（127.0.0.1:54329/aimani_ai_demo）: 1/1 PASS（aimani_ai_demo reset後、約0.67s）
full monorepo build: 3/3 package tasks PASS（約10.1s）
production artifact marker scan（apps/web/dist）: 0 matches
git diff --check: PASS
```

demo seedはcontrollerのbrowser journey後に一度だけ既存のaccepted状態を検出したため、`pnpm db:demo:reset`でローカル`aimani_ai_demo`を初期化して再実行した。browser Step 2はcontrollerの`task-5-browser-results.md`を正とし再実行していない。次の一手のaccept、Today/Handoff recent投影、direct reload保持、desktop 1280x720 / mobile 390x844のoverflowなし、console warning/error 0が記録されている。空のnextAction acceptはintegration suiteで確認済み。

独立review、PR #11、merge commit `ee9b567`、worktree cleanupまで完了済み。Cloudflare deployは未実施。

### Team Work Overview fresh verification（2026-07-28）

local branch `feat/team-work-overview`の実装とDocsを確認し、`4f446b4`でlocal `main`へ統合した。

```text
API unit: 13/13 PASS
Web tests: 17/17 PASS
PostgreSQL integration: 24/24 PASS
demo seed: 1/1 PASS（aimani_ai_demo reset後）
full monorepo build: 3/3 PASS
production artifact demo marker scan: 0 matches
production artifact local env file scan: 0 files（cache bypass rebuild後）
git diff --check: PASS
```

独立reviewでAPIはCritical / Important 0、BFF/presenterは0、UIは「再試行がcached failureを再取得しない」Important 1件を検出し、`refetch()`へ修正後にtests/buildを再実行した。runtimeではquery key importからServer Function graphがclient SSRへ逆流するstuckを検出し、side-effect-free key moduleに分離した。

最終差分reviewはコードのCritical / Important 0。Docsで旧fixture名・存在しないstatus・DB query並列実行という実装不一致をImportant 1件として検出し、実装どおりの`suzuki@aimani-ai.local`、synthetic `suspended` Membership、単一`pg.Client`上の順次`await`へ修正した。再reviewはCritical 0 / Important 0、APPROVED。

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
- query keyだけを使うclient componentはside-effect-free `*-query-key.ts`へ依存し、Server Function/queryFnを含むmoduleをimportしない
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
- `nextAction`: Handoff受領者がaccept時に宣言する次の一手。依頼者の`requestMessage`と混ぜない
- `TeamWorkOverview`: Organization内のactive current assigneeごとにopen Todoを束ね、最近完了を最大20件返すCQRS read model

Organization内の業務actorはUser IDでなくMembership IDを使う。「UserはOrganizationから独立し、Membershipで所属する」はBYARD系から継承した新製品の核である。

Todo Handoffの不変条件:

- requesterは依頼時のcurrent assignee
- recipientは同一Organizationのactive Membership
- 同じTodoにopenなrequested Handoffは1件
- acceptだけがcurrent assigneeをrecipientへ移す
- Handoff終端化と担当変更は同一transaction
- party scopeを越えた履歴を返さない
- UIへupstream raw errorやsnake_caseを漏らさない

Team Work Overviewの不変条件:

- active Membershipは同じOrganizationのactive assigneeが持つopen Todoを閲覧できる
- requested Handoff中もacceptまでTodoはcurrent assignee groupに置く
- openは`updatedAt desc, todoId desc`、memberは最新open Todo順
- completedはDBで`updatedAt desc, todoId desc`にし、最大20件
- suspended assigneeのopen Todoは現在の担当俯瞰から除外し、棚卸し/再割当は別sliceとする

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

- `<repo-root>/docs/design/foundation.md`
- `<repo-root>/docs/product/legacy-ux-audit.md`
- `<repo-root>/Docs/19_todo_transfer_history_exhaustive_analysis.md`
- `<repo-root>/Docs/20_byard_responsibility_roles_exhaustive_analysis.md`

## 12. 技術・実装の必読資料

順番:

1. `<repo-root>/docs/README.md`
2. `<repo-root>/docs/standards/reusable-product-baseline.md`
3. `<repo-root>/docs/standards/research-before-build.md`
4. `<repo-root>/docs/standards/react-tanstack-practices.md`
5. `<repo-root>/docs/standards/domain-language-and-naming.md`
6. `<repo-root>/docs/decisions/0001-technology-selection-2026-07-26.md`
7. `<repo-root>/docs/superpowers/specs/2026-07-26-aimani-ai-v2-platform-design.md`
8. `<repo-root>/docs/superpowers/specs/2026-07-27-three-minute-handoff-demo-design.md`
9. `<repo-root>/docs/superpowers/plans/2026-07-28-today-workspace.md`
10. `<repo-root>/docs/research/2026-07-28-today-runtime-verification.md`
11. `<repo-root>/docs/superpowers/specs/2026-07-28-work-lifecycle-visibility-design.md`
12. `<repo-root>/docs/superpowers/plans/2026-07-28-team-work-overview.md`
13. `<repo-root>/docs/research/2026-07-28-team-work-overview-runtime-verification.md`

横断調査:

- `<repo-root>/Docs/23_tanstack_start_source_ledger.md`
- `<repo-root>/Docs/24_tanstack_start_engineering_standard.md`
- `<repo-root>/Docs/25_tanstack_start_nextjs_principles_matrix.md`
- `<repo-root>/Docs/26_tanstack_start_recipes.md`
- `<repo-root>/Downloads/docswell-Z8NMGQ.pdf`

新しい判断では2026-07-28時点の記録を盲信せず、実装直前に現在の公式一次資料を確認する。外部記事は発想の根拠、公式Docsと実コードは技術事実の根拠として扱う。

## 13. 非blockingな既知事項

- 通常契約にない極端に長い改行なしTodo名・人名はshared cardでoverflowし得る
- Today section keyに、契約必須IDが欠落した場合だけindex fallbackがある
- Team Workはsuspended assigneeが残したopen Todoを表示しない。棚卸し・再割当は未実装
- Team Workのfilter/search、稼働率、工程status、期限は意図的に未実装
- reduced-motionの専用エミュレートは未確認
- CI / preview workflowは未作成
- production PostgreSQL / Hyperdrive resourceは未作成
- Cloudflare deployは未実施

これらを理由に、触れるUXの評価を後回しにしない。

## 14. 次にやること / やらないこと

最優先:

1. ユーザーが`/org_acme_studio/work`をReloadする
2. Claude Codeがdesktop/mobileで田中→森の責任移動と完了を操作する
3. `Today`と`チームのボール`の役割が分かれ、誰の作業がどこにあるかを素早く読めるかをユーザーと判断する
4. 現画面で分からない一つの問いだけを特定する
5. 実装はユーザー合意後に行い、push/deployは明示指示があるまでしない

候補は仮説であり、実装確定ではない。

- 完了済みカードが最近20件で十分か、古い実績を見たいか
- 確認待ちの理由と次の一手がTeam Work上でどこまで必要か
- suspended assigneeの残Todoを誰が棚卸し、再割当するか

一般的なCRUD backlog、full ES、generic workflow、Queue/Webhook Worker、RLS、汎用policy engine、網羅テスト、大規模design systemは必要になるまで作らない。

## 15. 移管開始時チェックリスト

```text
[ ] この文書を最後まで読んだ
[ ] rootがmain / clean / 単一worktreeで、local mainがorigin/mainより意図したcommit分だけaheadである
[ ] archive branchをmerge・削除しないと確認した
[ ] PR #1〜#11とlocal-only Team Work差分の状態を確認した
[ ] ignored local envの存在だけを確認し、値を表示していない
[ ] local serverとPostgreSQLの状態を確認した
[ ] desktop/mobile/browser consoleでTodayとTeam Workを操作した
[ ] HTTP runtime PASSと視覚UX未証明を混同していない
[ ] 次の作業を一つの触れるjourneyへ絞った
[ ] 現行公式Docsを調査してから実装する
[ ] 分離worktree、小PR、review、mergeで進める
[ ] Cloudflare deployはユーザーの明示依頼まで行わない
```

## 16. Codex停止条件

Codexは次を満たした後に停止し、以降をClaude Codeへ移管する。

```text
- PR #1〜#11がmainへ統合済み
- Todo Completion / Handoff Next Action / Team Work Overview runtime journeyがlocalでPASS
- Team Work実装、本書、runtime証跡がlocal mainへ統合済み
- 複数の独立reviewとfresh checksが完了
- Team Work worktreeとlocal branchを削除済み
- git worktree listはroot 1件だけ
- rootはmain、clean、origin/mainよりlocal-only Team Work/Docs commit分ahead（ユーザー指示により未push）
- open PRは0件
- archive branchはremoteに保存されmainへ未merge
- local dev serverはユーザーがReloadできるよう稼働を維持
- Cloudflare deployは行っていない
```
