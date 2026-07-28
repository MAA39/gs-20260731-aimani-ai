# Claude 作業移管 — Amidala v2

> [!IMPORTANT]
> この文書は2026-07-27時点の統合履歴である。現在状態の正本は `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/HANDOFF-CLAUDE-2026-07-28.md`。Claude Codeは先に新正本を読むこと。

- 作成日: 2026-07-27（Asia/Tokyo）
- 履歴資料の絶対パス: `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/HANDOFF-CLAUDE-2026-07-27.md`
- GitHub: <https://github.com/MAA39/amidala-v2>
- Todo Handoff review archive: <https://github.com/MAA39/amidala-v2/pull/1>
- 引き継ぎ時点の branch: `main`（最終SHAは本書末尾の完了記録を正本とする）
- 状態: Touchable MVPを`main`へ統合し、feature worktreeを撤去してから移管。Cloudflare deploy は未実施

## Claude への転送指示

この履歴資料から作業を再開しない。次の文章だけを新しいClaude Codeセッションへ渡す。

> `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/HANDOFF-CLAUDE-2026-07-28.md` を現在状態の正本として最初から最後まで読み、同文書の「Claude Codeへの最初の依頼」に従ってください。この2026-07-27文書は統合履歴としてのみ参照してください。

## 1. 最重要の意図

このプロダクトは、旧 Amidala の単純な移植ではない。Amidala と BYARD から良いドメイン境界・情報設計・UX を抽出し、新製品の核としてゼロから作る。

優先順位は次のとおり。

1. ユーザーが実際の画面を触り、価値と違和感を確認できること
2. ドメインの言葉が UI、関数、型、DB まで一貫していること
3. 後から機能を増やせる境界があること
4. 主要な越境と壊れやすい状態遷移だけをテストで守ること
5. 網羅性、形式的な完全性、テスト数、coverage は成果としないこと

金融システム級の硬さは求めない。レビューで重箱の隅をつつき続けず、ユーザーに触れる機能へ時間とトークンを使う。ただし、tenant 越境、責任移管のtransaction、認証主体の混同、内部エラーの画面漏洩など、体験やモデルを壊す境界は守る。

## 2. 絶対に守る作業境界

### 新規側だけを変更する

変更可能な新規プロダクト:

- repository: `/Users/maa/Projects/gs/000_参照用/amidala-v2`
- 引き継ぎ時のroot: `/Users/maa/Projects/gs/000_参照用/amidala-v2`
- 次の実装はrootを直接汚さず、`main`から新しいfeature worktreeを切る

以下は調査用であり、原則として変更しない。

- `/Users/maa/Projects/gs/000_参照用/amidala`
- `/Users/maa/Projects/gs/000_参照用/amidala-angular`
- `/Users/maa/Projects/gs/000_参照用/amidala-admin`
- `/Users/maa/Projects/gs/000_参照用/amidala-infra`
- `/Users/maa/Projects/gs/000_参照用/BYARD`
- `/Users/maa/Projects/gs/000_参照用/kakeai.next`
- `/Users/maa/Projects/gs/000_参照用/inquiry.kakeai.com`

### 旧ベースworktreeのユーザー変更を保護した記録

統合前のベースworktree `/Users/maa/Projects/gs/000_参照用/amidala-v2` には次のユーザー所有変更が残っていた。

```text
 M apps/web/src/features/todos/Page.tsx
 M apps/web/src/routes/__root.tsx
 D apps/web/src/routes/handoffs.tsx
 D apps/web/src/routes/todos.tsx
 M apps/web/src/styles.css
```

破棄せず、`archive/pre-todo-handoff-local-20260727` / `98e8a2a`（`chore: preserve pre-handoff local changes`）としてprivate remoteへ保存した。このarchive branchは復元用であり、`main`へmergeしない。明示依頼なしに削除もしない。

### 認証情報をリポジトリへ残さない

会話中には Linear / GitHub / Supabase / Cloudflare 等の資格情報が共有されたが、この文書や Git history には値を転載していない。必要な資格情報はユーザーの安全な運用資料または既存の設定から取得し、`.dev.vars`、Wrangler secret、GitHub secret として渡す。ログ、PR、Docs、commit message に値を出さない。

## 3. Git / GitHub の現在地

| 項目 | 値 |
|---|---|
| private repository | `MAA39/amidala-v2` |
| remote | `origin = https://github.com/MAA39/amidala-v2.git` |
| main | `289431a` |
| Todo Handoff review | PR #1。`impl/todo-handoff` → `feat/touchable-mvp` |
| Touchable MVP integration | PR #2。`feat/touchable-mvp` → `main` |
| archive branch | `archive/pre-todo-handoff-local-20260727` / `98e8a2a`。mergeしない |
| 引き継ぎ時のlocal | rootだけ、`main`、clean、`origin/main`と一致 |

ブランチの流れ:

```text
main（Touchable MVP統合済み）
  ├─ Identity → People
  ├─ Person SharedTodo
  └─ Todo Handoff
```

統合前に存在したfeature worktree（すべて完了後に撤去する）:

| path | branch | SHA | 用途 |
|---|---|---|---|
| `/Users/maa/Projects/gs/000_参照用/amidala-v2` | 統合後は`main` | 完了記録参照 | 唯一残すroot |
| `/Users/maa/Projects/gs/000_参照用/amidala-v2/.worktrees/identity-people` | `impl/identity-people` | `ccff02e` | 完了済み参照 |
| `/Users/maa/Projects/gs/000_参照用/amidala-v2/.worktrees/relationship-todo` | `impl/relationship-todo` | `9d260a9` | 完了済み参照 |
| `/Users/maa/Projects/gs/000_参照用/amidala-v2/.worktrees/todo-handoff` | `impl/todo-handoff` | この文書追加前は `61fb950` | 現在の安全な作業場所 |

PR #1はTodo Handoffのレビュー履歴、PR #2はTouchable MVP全体の`main`統合履歴として残す。次の作業をこれらのbranchへ継ぎ足さず、最新`main`から新しいbranch/worktreeを作る。

## 4. 調査資産の地図

### 横断調査の正本

`/Users/maa/Projects/gs/000_参照用/Docs` には Amidala / BYARD / TanStack Start / Next.js から抽出した横断調査がある。特に次を先に読む。

1. `/Users/maa/Projects/gs/000_参照用/Docs/09_next_conversation_handoff.md`
2. `/Users/maa/Projects/gs/000_参照用/Docs/19_todo_transfer_history_exhaustive_analysis.md`
3. `/Users/maa/Projects/gs/000_参照用/Docs/20_byard_responsibility_roles_exhaustive_analysis.md`
4. `/Users/maa/Projects/gs/000_参照用/Docs/22_customer_commitment_os_mvp_integration_boundary.md`
5. `/Users/maa/Projects/gs/000_参照用/Docs/23_tanstack_start_source_ledger.md`
6. `/Users/maa/Projects/gs/000_参照用/Docs/24_tanstack_start_engineering_standard.md`
7. `/Users/maa/Projects/gs/000_参照用/Docs/25_tanstack_start_nextjs_principles_matrix.md`
8. `/Users/maa/Projects/gs/000_参照用/Docs/26_tanstack_start_recipes.md`

### Amidala v2 固有Docsの読む順番

1. `docs/README.md`
2. `docs/standards/reusable-product-baseline.md`
3. `docs/standards/research-before-build.md`
4. `docs/standards/react-tanstack-practices.md`
5. `docs/standards/domain-language-and-naming.md`
6. `docs/decisions/0001-technology-selection-2026-07-26.md`
7. `docs/design/foundation.md`
8. `docs/product/legacy-ux-audit.md`
9. `docs/superpowers/specs/2026-07-26-amidala-v2-platform-design.md`
10. `docs/superpowers/specs/2026-07-27-todo-handoff-slice-design.md`
11. `docs/research/2026-07-27-todo-handoff-verification.md`

### 会話で参照した外部資料

- Next.js設計原則: <https://zenn.dev/akfm/books/nextjs-basic-principle>
- TanStack Router 1年運用事例: <https://speakerdeck.com/ytaisei/tanstack-routerwo-xin-gui-purodakutode1nian-jian-yun-yong-sitemitajie-guo>
- TanStack Start Server Functions file organization: <https://tanstack.com/start/latest/docs/framework/react/guide/server-functions>
- ローカル参考PDF: `/Users/maa/Downloads/docswell-Z8NMGQ.pdf`
- TSKaigi 2026「TanStack Start の createServerFn で作る、型が通る API」: <https://2026.tskaigi.org/talks/25>
- TSKaigi 2026「実践 TanStack Start：サーバーとクライアント境界の設計パターン」: <https://2026.tskaigi.org/talks/26>

新しい技術判断は記憶だけで決めず、実装直前に2026-07-27以降の公式一次資料を再確認する。外部記事は発想の根拠、公式Docsと実コードは事実の根拠として分ける。

## 5. 採用アーキテクチャ

```text
Browser
  │ same-origin
  ▼
TanStack Start Web Worker
  ├─ SSR / typed Router / Query
  ├─ thin createServerFn
  └─ screen-specific BFF adapter
  │ Cloudflare Service Binding + Hono RPC
  ▼
private Hono API Worker
  ├─ Better Auth
  ├─ Membership-based authorization
  ├─ Awilix request scope
  ├─ application use cases
  └─ Drizzle repositories / short transactions
  │
  ▼
Cloudflare Hyperdrive（production予定）
  ▼
PostgreSQL
```

確定事項:

- monorepo: pnpm workspace + Turborepo
- Web/SSR/BFF: TanStack Start
- API: Hono private Worker
- Web → API: Cloudflare Service Binding。ブラウザからAPI Workerを直接公開しない
- RPC: Hono RPC。ただし巨大な型を作らずrouteを分割する
- auth: Better Auth
- DB: PostgreSQL。D1は採用しない
- production DB access: Hyperdriveを通す。接続先はpreview前に再評価可能
- ORM/migration: Drizzle
- DI: AwilixをAPI Composition Rootだけで使う
- UI: React 19、TanStack Router/Query/Form、Tailwind CSS v4、Base UI、Lucide
- full Event Sourcingは採用しない。DDD/CQRSは境界と語彙を明瞭にする分だけ使う
- 将来Webhookが必要になれば別Workerに分離できるが、必要になるまで作らない

## 6. Router / features / Server Function の配置原則

ユーザーとの会話で確定した中心ルール:

```text
apps/<appname>/src/
├── features/<domain>/
│   ├── api / query options
│   ├── hooks
│   ├── components
│   └── server/
│       ├── <entity>.functions.ts   # thin createServerFn wrapper
│       ├── <entity>-schema.ts      # input/output schema
│       └── <verb>-<entity>.server.ts # server-side logic
└── routes/<route>/
    ├── -components/
    │   ├── fallbacks/
    │   └── Page.tsx
    └── index.tsx                   # route declaration / validateSearch / loader
```

現在の実コードは機能規模に合わせ、`features/<domain>/*.functions.ts`、`*.server.ts`、schema/query/UIを同じfeature直下に置いている。判断軸は変わらない。

- Router依存は`routes`
- ドメイン能力とBFF adapterは`features`
- `createServerFn` wrapperは薄くする
- private API呼び出し、cookie転送、DTO検証、画面語へのerror変換は`.server.ts`
- route loaderは`queryClient.ensureQueryData`
- Pageは同じquery optionsを`useSuspenseQuery`で読む
- TanStack Queryは画面のserver state正本
- mutation後は関係するquery keyを正確にinvalidateし、完了をawaitする
- 状態同期のためだけに`useEffect`を足さない。ユーザー操作はevent handler、派生値はrender、外部system同期だけEffectを検討する

## 7. ドメインモデルの核

### Identity / Organization

- `User`: Organizationから独立したグローバルな認証主体
- `Account`: Better Auth credential。人や契約企業という意味では使わない
- `Organization`: workspace / tenant
- `Membership`: UserとOrganizationの関係、組織内profile、role、status
- `CurrentMembershipContext`: session Userと検証済みMembershipから作る認可文脈
- 業務上のactor IDはOrganization内ではUser IDではなくMembership IDを使う

この「UserはOrganizationから独立し、Membershipで所属する」がBYARD系から継承した重要判断であり、新製品の核である。

### Relationship / Todo

- `Relationship`: 同じOrganization内のMembership間の関係
- `Todo`: Organization内のwork item
- creatorとcurrent assigneeを分ける
- Peopleから関係のある相手を選び、共有Todoへ進む導線を重視する
- Assigned Todo workspaceは現在Membershipが担当するopen Todoだけを返す

### TodoHandoff

`TodoHandoff`は汎用workflowではない。現在担当者が別のMembershipへTodo責任の移管を依頼し、受諾・見送り・取消で終わる記録である。

公開use case:

- `RequestTodoHandoff`
- `AcceptTodoHandoff`
- `RejectTodoHandoff`
- `CancelTodoHandoff`
- `GetTodoHandoffWorkspace`
- `GetAssignedTodoWorkspace`

重要な不変条件:

- requesterはrequest時点のcurrent assignee
- recipientは同じOrganizationのactive Membership
- 同じTodoにopenなrequested Handoffは1件
- acceptだけがTodoのcurrent assigneeをrecipientへ変更する
- acceptによるHandoff終端化とTodo担当変更は同一transaction
- reject/cancelはTodo担当を変えない
- decisionの再送は既存終端状態を安全に扱う
- read modelはOrganizationだけでなく、current Membershipがrequesterまたはrecipientかというparty scopeを持つ
- recentはparty scope → resolvedAt降順 → limit 20をSQLで行う
- UIは上流の英語、snake_case、raw error messageを表示しない

## 8. 実装済みユーザージャーニー

実装済み:

1. email/passwordでlogin
2. 所属Organizationを選択
3. Peopleで組織内の相手を見る
4. Personとの共有Todoを作成・表示
5. 自分が担当するopen Todoを見る
6. 別Membershipへmessage付きHandoffをrequest
7. recipientがacceptまたはreject
8. requesterがrequested Handoffをcancel
9. accept後、Todoのcurrent assigneeとrecent historyへ反映
10. desktop/mobileともOrganization-scoped navigationを維持

主要route:

```text
/login
/organizations
/$organizationId/people
/$organizationId/people/$contextMembershipId/todos
/$organizationId/todos
/$organizationId/handoffs
```

global `/todos` と `/handoffs` のplaceholderは削除済み。Organizationが未選択なら`/organizations`へ導く。

## 9. デザイン / UX 方針

デザインは旧AmidalaとBYARDを参照したが、見た目のコピーではない。

- relationship-first。Peopleを入口に相手との文脈からTodo/Handoffへ進む
- indigoを軸にした落ち着いた画面だが、汎用admin templateにはしない
- 8px rhythm、十分な余白、44px前後の操作面
- 色だけでstatusを表さず、ラベルと必要なiconを併用
- headless primitiveはBase UI、見た目はプロダクトが所有
- desktop/mobileで同じ情報階層を守る
- pending/error/empty/successを画面仕様として扱う
- internal codeや英語runtime messageを画面へ出さない
- Storybookや巨大なcomponent catalogを先に作らない。実画面で反復したものだけ抽出する
- motionは意味のある遷移に限定し、`prefers-reduced-motion`を尊重する

確認済み画像:

- `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/assets/todo-handoff/accepted-recent-desktop.png`
- `/Users/maa/Projects/gs/000_参照用/amidala-v2/docs/assets/todo-handoff/request-or-incoming-mobile.png`

## 10. Todo Handoff branch の実装履歴

`07b85d6...61fb950` は21 commits、64 files、約2,492 additions / 121 deletions。主要な流れ:

1. API domain/application/repository、transaction、migrationを追加
2. PostgreSQL integration testでrequest/accept/reject/cancel/競合/越境を固定
3. TanStack Start BFF境界とHono RPC adapterを追加
4. desktop/mobileのHandoff workspace、request dialog、card actionsを追加
5. ブラウザ検証でstale Query UIを検出し、observed query + invalidateへ修正
6. recentのparty scope、filter/order/limit、Assigned open-onlyへ修正
7. accepted CTAのactor条件、`resolvedAt`表示へ修正
8. Handoff/Todo/PeopleのBFF errorを固定日本語へ変換し、上流message漏洩を遮断
9. presentation mapper testsをWeb test scriptへ接続

詳細commitは次で確認できる。

```bash
git log --oneline --reverse 07b85d6..HEAD
git diff --stat 07b85d6...HEAD
```

## 11. レビューで発見・修正した重要事項

Claude Opusと独立Codex reviewerを複数回使った。最終判定はいずれも`APPROVED`、blocking findingは0。

修正済み:

- 409をすべて「既に依頼済み」と誤表示していた問題
- Handoff BFFが上流の英語/snake_case messageを画面へ漏らす問題
- request dialogの`mutateAsync` throw時にretryable stateへ戻らない問題
- Handoff cardがtyped conflict guidanceを一般文言で上書きする問題
- Todo BFFが上流messageを画面へ漏らす問題
- People BFFが上流messageを画面へ漏らす問題
- recent HandoffがOrganization全体へ見えるparty scope漏れ
- limit前後のfilter順序、terminal timelineの日時、Assigned完了Todo混入
- mutation後にstale UIが残るQuery観測/invalidation問題
- hookの条件呼び出し、focus、mobile overflowなどのUI問題

CodeRabbitはPR walkthroughを生成し、inline blocking findingはなかった。最新増分は無料枠のrate limit表示だがcheck stateはsuccess。Gemini Code Assist consumer版はsunset通知のみで、レビューには使えていない。

## 12. 検証済み状態

最新head `61fb950`で確認:

```text
Web presentation tests: 7/7 PASS
Web TypeScript: PASS
full monorepo build: PASS
git diff --check: PASS（実装agent確認）
worktree: clean
```

前headを含む同一機能差分で確認:

```text
API unit tests: 2/2 PASS
PostgreSQL integration tests: 6/6 PASS
desktop browser 1280x720: PASS
mobile browser 390x844: PASS
SSR direct reload: PASS
browser console warning/error: 0
API Wrangler dry-run: PASS
Web Wrangler dry-run + Service Binding確認: PASS
```

直近の再実行コマンド:

```bash
cd /Users/maa/Projects/gs/000_参照用/amidala-v2
pnpm --filter @amidala/web test
pnpm --filter @amidala/web exec tsc --noEmit
pnpm build --force
```

PostgreSQL integration:

```bash
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff \
  pnpm --filter @amidala/api test:integration -- todo-handoffs.integration.test.ts --run
```

既知の非エラー警告:

```text
Turbo: no output files found for task @amidala/db#build
```

`packages/db`のTypeScript build自体は成功しており、`turbo.json`のoutputs指定に対応する生成物がないという設定上の警告である。次のCI整備時に扱えばよく、現状のユーザージャーニーを止めない。

## 13. ローカル実行

必要条件:

- Node/pnpmはrepositoryのpackageManager/lockfileに従う
- Docker Desktop等でPostgreSQLを起動できる
- `apps/api/.dev.vars` が存在する。Git管理しない

現在のローカル変数名:

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
```

値はDocsへコピーしない。統合時にworktree-localなignored `.dev.vars` は自動移動されないため、rootの `apps/api/.dev.vars` の存在を確認し、なければ安全な保管元から再作成する。

基本操作:

```bash
cd /Users/maa/Projects/gs/000_参照用/amidala-v2
pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

PostgreSQL composeはhost port `54329`、local user/password/databaseは開発専用の`amidala`。integration検証では分離DB`amidala_handoff`を使った。既存volume/DBをdropまたはrecreateする前には、対象がlocal disposable DBか確認する。

seed accountの表示用情報:

- `owner@amidala.local` — 田中 彩
- `sato@amidala.local` — 佐藤 花子
- `mori@amidala.local` — 森 ハル
- `suzuki@amidala.local` — 鈴木 健
- Organizations: Acme Studio / Northstar Lab

seed passwordは`apps/api/src/dev/seed.ts`を読んで確認する。Docsへ新たな本番資格情報を記載しない。

## 14. Cloudflare / PostgreSQL deploy の状態

まだ本番・previewへdeployしていない。production DB mutationも行っていない。

設定済みのコード上の形:

- API Worker: `amidala-api`
- APIは`workers_dev: false`, `preview_urls: false`
- Web Worker: `amidala-web`
- WebのService Binding: `API -> amidala-api`
- compatibility date: `2026-06-24`
- compatibility flag: `nodejs_compat`
- production DBは`HYPERDRIVE` binding、localは`DATABASE_URL`

deploy前に必要:

1. PostgreSQL provider/region/backup/価格を2026-07-27時点で再確認
2. Hyperdrive configを作成
3. API WorkerへHyperdrive bindingとBetter Auth secretsを設定
4. Web/API service namesとbindingをpreviewで検証
5. migration適用先を明示し、local/preview/productionを取り違えない
6. GitHub Actionsまたは手動preview手順を最小構成で作る
7. browserからAPI Workerが直接公開されていないことを確認

ユーザーはPostgreSQLを希望し、D1は不採用。Supabase Postgres + Hyperdriveの既存運用知見はあるが、このrepoのproduction接続先として確定したわけではない。ADRではPlanetScale Postgres Tokyoを第一候補としているため、契約前に現在の選択肢を比較し直す。

## 15. 残課題と推奨順序

### Claudeへの最重要プロダクト判断

2026-07-27にユーザーがローカル画面を実際に見た時点の率直な評価は、次のとおり。

> 技術的には簡単なCRUD以上のものが動いているが、これが良いプロダクト体験なのか、未実装機能を足せば面白くなるのか、現画面からは判断できない。

現在は、認証、Organization境界、People、Todo作成・閲覧、Todo Handoffの依頼・承認・見送り・取消、transactionalな担当変更まで成立している。したがって「技術的に縦切りが成立する」ことは確認できた。一方で、ユーザーが「なぜ普通のタスク管理ではなくAmidalaを使うのか」を感じる体験にはまだ届いていない。

不足しているCRUDを一覧順に追加してはいけない。Todo編集・削除・検索を増やせば便利にはなるが、プロダクトが面白くなる保証はない。次は機能充足ではなく、次の物語を3分で理解・操作できるかを検証する。

```text
誰かとの約束が生まれる
  → 次に誰が動くか明確になる
  → 相手へ背景ごと渡す
  → 相手が引き受ける
  → チーム全体が「いま誰のボールか」を理解できる
```

この体験を成立させるための優先候補:

1. integration fixtureを除いた少数の意味あるdemo dataへ整理する
2. logout / actor switchを画面から行い、田中が依頼して森が受け取る往復を一人で体験できるようにする
3. People一覧より先に「今日、自分が動くもの」「受け取った依頼」「止まっている約束」を見せる
4. Handoffへ背景、期待する結果、期限または確認事項を短く添える
5. accept後に担当者名が変わるだけでなく、「次に誰が何をするか」が変化したことを一画面で強く示す

この優先順位も仮説である。Claude Codeは実装前に既存Amidala/BYARDのUXと競合体験を再調査し、ユーザーへ触れる小さな提案として具体化すること。一般的なCRUD backlogへ分解して消化しない。

### 2026-07-27 ローカル実機確認

Codexが`main`を`http://localhost:5173/`で起動し、既存の森ハルsessionで次を確認した。

- Organization選択、People一覧: 表示成功
- 佐藤花子との共有Todo画面とTodo作成form: 表示成功
- 森ハルのAssigned Todo一覧: 表示成功
- Handoffのincoming / recent / accepted / canceled表示: 表示成功
- Handoff依頼Dialog: 開閉成功。田中彩・佐藤花子の候補取得成功
- この確認ではDBを変えるsubmit/accept/reject/cancelは実行していない
- 過去のbrowser journeyとPostgreSQL integration testではrequest→accept等の状態遷移を確認済み

同時に次のUX阻害を確認した。

- local DBに`handoff-<timestamp>-<random>`形式のintegration fixtureが多数残り、Todo/Handoff一覧が価値を判断しにくいほど散らかっている
- React consoleに`<div>`が`<html>`直下にあるというhydration warningが1件出る。画面は描画されるが修正対象
- 現在のlogin表示は「ログイン中 / アカウント」だけで、誰として操作しているか・actorをどう切り替えるかが画面から理解しにくい

この実機確認を受け、Codexは以降のプロダクト実装を進めない。次の設計・実装主体はClaude Codeとする。

### 次に推奨する小さな作業

1. demo dataを整理し、田中→森の一つの物語だけを触れる状態にする
2. actor switchを含む3分の体験案をユーザーへ提示する
3. 合意後、最新`main`から新しいfeature branch/worktreeを作る
4. browserで価値を確認してから、必要なCRUDまたはUIだけを追加する
5. 価値が確認できたら、最小のCloudflare preview + PostgreSQL/Hyperdriveを作る
6. PlaywrightでLogin → People → Todo → Handoff → Acceptの1本だけを自動化する

### UX優先で次候補

- logout / actor切替を画面からできるようにし、DB session rowの手動差替えを不要にする
- Todo detailまたはHandoff後のcontext確認を触れる形にする
- notificationではなく、まずHandoff inboxの気づきやすさを実画面で確認する
- TodoComposerのbrowser↔Web Worker transport自体がthrowした場合も固定日本語に統一する
- reduced-motionを実ブラウザで確認する

### 必要になるまで作らない

- full Event Sourcing
- generic workflow engine
- outbox / Queue / Webhook Worker
- PostgreSQL RLS
- 汎用policy engine
- 網羅的なunit/component tests
- coverage gate / mutation testing
- SSO / SCIM / MFA
- 大規模design system / Storybook
- 強い監査基盤

Webhookは将来あり得るが、現時点では「分離可能な契約を保つ」まででよい。

## 16. 既知の懸念

blockingではない。

- `people.server.ts`のdefault unavailable文言取得に`peopleFailureMessage(503)`を使っている。将来status別文言を増やす場合はdefault用APIを分けると明瞭
- root `turbo.json`に`test` taskがなく、Web mapper testsは`pnpm --filter @amidala/web test`で個別実行する。CI導入時に統合する
- TodoComposerはBFFが返すerrorは日本語化済みだが、browser↔Web Worker transport自体のruntime errorをそのまま描画する可能性がある
- reduced-motionは未エミュレート
- browserでrecipient loginしたとは記録できない。検証時はlocal disposable DBのBetter Auth session rowをMoriへ更新した。logout/actor switch UXが必要
- 最後のquery/read-model修正後に全browser journeyを再実行してはいない。reviewerは構造修正のため不要と判断したが、次のUI作業開始時に触って確認するとよい
- CI/preview workflowは未作成
- production PostgreSQL/Hyperdrive resourceは未作成

## 17. 作業スタイル

ユーザーからの継続指示:

- 実装前に、やろうとしている技術を現行公式Docsで調査する
- 必要ならClaudeの別モデル/agentやCodex subagentと壁打ちする
- シニアエンジニア、t-wada、海外の実践者ならどう命名・分割するかを考える
- TDDはテスト数を増やす儀式ではなく、重要な振る舞いを一つずつ確定するために使う
- Domainの言葉で関数、型、DB column、testを命名する
- Reactでは不要な`useEffect`を避ける
- URL state、server state、local interaction stateを混同しない
- AIが迷わないように配置ルールとDocsを更新する
- reviewは積極的に使うが、非blockingな細部で無限に止まらない
- 変更を完成と呼ぶ前に、実行した検証の生の結果を確認する

## 18. 作業再開時のチェックリスト

```text
[ ] この文書を最後まで読んだ
[ ] docs/README.mdと必読Docsを読んだ
[ ] git status / branch / HEAD / remoteを確認した
[ ] archive branchをmerge・削除しないと確認した
[ ] 統合済みPR #1/#2のreview履歴を確認した
[ ] 現行公式Docsで次の技術を調査した
[ ] 次の作業を一つの触れるjourneyへ絞った
[ ] domain languageとtest listを先に書いた
[ ] cleanなbranch/worktreeで作業する
[ ] browserでユーザー体験を確認する
[ ] Docsと検証記録を同じcommit/PRへ残す
```

## 19. 移管完了条件

### Codexが実行する確定済み順序

この順序を入れ替えない。特に、引き継ぎ文書をcommit・pushする前にworktreeを削除してはいけない。

1. Todo Handoff worktreeで全テストとbuildを実行する
2. 本書と`docs/README.md`を`impl/todo-handoff`へcommit・pushする
3. PR #1をReady for reviewへ変更する
4. PR #1を`feat/touchable-mvp`へmerge commit方式でmergeする。squash/rebaseは使わない
5. `feat/touchable-mvp`の統合結果で検証する
6. PR #2を作り、`feat/touchable-mvp`を`main`へmerge commit方式でmergeする。squash/rebaseは使わない
7. rootを`main`へ切り替え、`origin/main`へfast-forwardする
8. 本書へ実際のPR状態、main SHA、検証結果を追記して`main`へcommit・pushする
9. `identity-people`、`relationship-todo`、`todo-handoff`がすべて`main`のancestorであることを`git merge-base --is-ancestor`で確認する
10. 3つのfeature worktreeをrootの外側から削除し、`git worktree prune`する
11. 統合済みlocal feature branchを通常の`git branch -d`で削除する。force deleteは使わない
12. rootが`main`、clean、`origin/main`と同じSHA、worktree 1件であることを確認する

Identity → People (`ccff02e`) と Person SharedTodo (`9d260a9`) は、統合前の調査時点ですでに`feat/touchable-mvp`のancestorだった。remote feature branchがなくても内容は統合先commitに保全されている。削除直前にもancestor確認を再実行する。

次をすべて満たした時点でCodex側の作業を終了する。

```text
- Todo Handoffがfeat/touchable-mvpへ統合済み
- Touchable MVPがmainへ統合済み
- 引き継ぎ文書の最終版がorigin/mainへpush済み
- identity-people / relationship-todo / todo-handoff worktreeを撤去済み
- git worktree listはroot 1件だけ
- rootはmain、git status clean、HEADはorigin/mainと一致
- archive/pre-todo-handoff-local-20260727はremoteに保存済みかつ未merge
```

## 20. Codex完了記録

完了日時: 2026-07-27（Asia/Tokyo）

### 統合結果

| 対象 | 結果 |
|---|---|
| Todo Handoff PR #1 | `MERGED`。`impl/todo-handoff` → `feat/touchable-mvp`。merge commit `5b5b819e3501ebc1be913b4887b09c6a985b4e14` |
| Touchable MVP PR #2 | `MERGED`。`feat/touchable-mvp` → `main`。merge commit `d88213c368ab17febb5b88c8106793ea4e11ddf6` |
| ユーザー旧local差分 | `archive/pre-todo-handoff-local-20260727` / `98e8a2a`としてprivate remoteへ保存。`main`へ未merge |
| feature remote branch | `impl/todo-handoff`、`feat/touchable-mvp`を統合後に削除 |
| feature local branch | `impl/identity-people`、`impl/relationship-todo`、`impl/todo-handoff`、`feat/touchable-mvp`を通常の`git branch -d`で削除 |

### 統合後のfresh検証

`feat/touchable-mvp`へPR #1をmergeした結果をrootで検証した。

```text
pnpm install --frozen-lockfile: PASS
Web presentation tests: 7/7 PASS
API unit tests: 2/2 PASS
PostgreSQL integration tests: 6/6 PASS
Web TypeScript: PASS
full monorepo build: PASS
git diff --check: PASS
git status: clean
```

既知の警告は`@amidala/db#build`のTurbo outputs未設定だけで、buildは成功している。

### Claude監査

- Claude Opusによる実装reviewは最終`APPROVED`
- 引き継ぎ文書のOpus監査再実行はAnthropic側`529 Overloaded`で完了しなかった
- Claude Sonnetが文書を実repo/Git状態と照合し、dirty記述、archive保存、絶対パス、commit-before-remove、Ready化、merge commit方式、ancestor確認の不足を指摘
- 指摘をすべて本書と実行手順へ反映した
- 最終2指摘だった「PR #1 Ready化」と「PR #1/#2をmerge commit方式に固定」も実施済み

### 最終workspace状態

```text
root: /Users/maa/Projects/gs/000_参照用/amidala-v2
branch: main
main integration SHA: d88213c368ab17febb5b88c8106793ea4e11ddf6
worktrees: root 1件だけ
feature worktrees: すべて撤去済み
apps/api/.dev.vars: rootへlocal-only/permission 600で移設済み、Git管理外
archive branch: origin/archive/pre-todo-handoff-local-20260727 に保存
```

この完了記録自体を追加する最終Docs commitが`origin/main`へpushされた後は、`git rev-parse HEAD`と`git rev-parse origin/main`が一致することを確認する。以後はClaudeが本書を入口に、最新`main`から新しいfeature worktreeを作って再開する。
