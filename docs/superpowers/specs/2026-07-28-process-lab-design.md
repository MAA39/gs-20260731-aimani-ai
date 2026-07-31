# Process Lab Design

- 日付: 2026-07-28（Asia/Tokyo）
- status: user-approved design
- repository: `/Users/maa/Projects/gs/000_参照用/aimani-ai-v2`
- route: `/$organizationId/process-lab`
- UI label: `工程ラボ`
- deploy: local only。Cloudflareへdeployしない

## 1. 目的

BYARDの工程管理UIで価値があった「工程をノードとして置き、前後関係を線で追い、担当・期限・進捗を同じ場所で判断する」体験をAimani AI v2で試す。

これは新製品の正式な工程管理機能ではなく、ユーザーが実画面を触って次を判断するためのexperimentである。

1. Todo一覧より、仕事の前後関係が見えるほうが状況を理解しやすいか
2. 担当者だけでなく「何を待っているか」が見えると次の行動を選びやすいか
3. ノードを動かし、依存関係をつなぐ操作がAimani AIの責任移管UXと両立するか

モックデータやclient-only fixtureは使わない。local PostgreSQLへ永続化された実データを、TanStack Start Web Worker → Server Function → Service Binding → Hono API Worker → PostgreSQLの実経路で操作する。

## 2. BYARDとWork Compilerから採用すること

### BYARD

参照元:

- `/Users/maa/Projects/gs/000_参照用/BYARD/backyard/src/components/workgroup/FlowOfWork.tsx`
- `/Users/maa/Projects/gs/000_参照用/BYARD/backyard/src/components/workgroup/WorkNode.tsx`
- `/Users/maa/Projects/gs/000_参照用/BYARD/backyard/src/components/workgroup/WorkDetail.tsx`
- `/Users/maa/Projects/gs/000_参照用/BYARD/backyard/docs/onboarding/20260204-0005-product-introduction.md`

採用する:

- Workをnode、依存関係をedgeとして同じcanvasへ置く
- node内に担当、期限、進捗を表示する
- node選択時だけ詳細を見せ、canvas全体を情報過多にしない
- semanticな工程とcanvas座標を分離し、node位置を永続化する
- 一覧ではなく、前工程と後工程を空間的に追えるようにする

採用しない:

- Recoilへ分散した状態
- 800行規模の神component
- client側だけの認可
- template編集、copy/paste、undo/redo、multi-select、Slack通知
- 既存BYARDの配色やMUIをそのまま移植すること

### Work Compiler

参照元:

- Codex thread: `019f4ab3-36a4-7f50-a77b-c32d4fb71edb`
- `/Users/maa/Projects/gs/gs-20260710-work-compiler` branch `feat/m2-thin-run`
- `docs/handoff/2026-07-27-claude-code-handoff.md`
- `apps/web/src/components/flow/FlowCanvas.tsx`
- `apps/web/src/components/flow/WorkNode.tsx`
- `apps/web/src/components/flow/DecisionNode.tsx`
- `apps/web/src/components/flow/flow-model.ts`
- `apps/web/src/components/flow/layout.ts`
- `apps/web/src/components/flow/layout-persistence.ts`
- `apps/web/src/components/case-workspace/NodeInspector.tsx`

Work CompilerではProductionに7 Node / 0 EdgeのFlowを保存できた。画面の見た目は成立しても、誰から誰へ渡るか、分岐、差し戻し、完了までの経路が追えず、業務フローUXとして不合格だった。

工程ラボでは次を最小invariantとする。

- 2個以上のstepを持つboardはedge 0件にできない
- isolated stepを許さず、全stepが弱連結である
- self-loop、duplicate edge、dangling edgeを許さない
- directed cycleを許さない
- edge両端は同じOrganization / boardに属する
- 前工程が未完了のstepは`waiting`を導出し、進行開始できない

## 3. スコープ

### 実装する

- Organizationごとに1つのdemo Process Board
- 5〜7件の実stepと、全stepを結ぶdependency
- desktopのinteractive canvas
- custom node
- node drag終了時の位置保存
- source handleからtarget handleへのdependency追加
- 選択edgeのdependency解除
- node選択時のdetail panel
- status変更: `not_started` / `in_progress` / `completed`
- predecessor未完了時のderived status `waiting`
- 選択nodeのupstream / downstream path強調
- mobileのdependency order縦表示
- Team Workからのcontextual link
- demo reset時の決定論的seed
- experiment全体の削除手順

### 実装しない

- board / stepの汎用CRUD
- 複数board切替
- 自動レイアウト
- template / instance二重構造
- decision node、条件分岐、差し戻しloop
- Gantt、calendar、工数、通知
- optimistic collaboration、presence、WebSocket
- undo / redo、copy / paste、multi-select
- Cloudflare deploy

## 4. ライブラリ選定

### 採用: `@xyflow/react` 12.11.2

2026-07-28にnpm registryで確認したversionは`12.11.2`、peer dependencyはReact / ReactDOM `>=17`で、現行React 19を含む。

採用理由:

- BYARDとWork Compilerの両方でReact Flow系の実績がある
- custom node、drag、pan / zoom、handle接続、edge選択が本要件と一致する
- `isValidConnection`でclient側の即時validationができる
- `getOutgoers`を用いたcycle preventionの公式例がある
- node / edgeをcontrolled stateとして扱え、DB read modelと分離できる
- nodeとedgeのkeyboard focus / select / move、ARIA文言localizeを公式に支援する
- v12はSSR向けnode寸法 / handle指定を持ち、TanStack Startとの相性を説明できる
- MIT license

公式資料:

- <https://reactflow.dev/learn/customization/custom-nodes>
- <https://reactflow.dev/learn/customization/handles>
- <https://reactflow.dev/examples/interaction/validation>
- <https://reactflow.dev/examples/interaction/prevent-cycles>
- <https://reactflow.dev/examples/interaction/save-and-restore>
- <https://reactflow.dev/learn/advanced-use/accessibility>
- <https://reactflow.dev/learn/troubleshooting/migrate-to-v12>

### 今回は採用しない

- `@dagrejs/dagre`: 自動配置を導入すると、人が作った意味のある位置と永続positionの責任が曖昧になる。初期boardはseedで決定論的に配置し、以後は人のdragを正とする
- `elkjs`: Work Compilerでは`0.11.1`を初期自動配置に使った実績がある。port制約や動的な複雑layoutが必要になった時の候補だが、今回の5〜7 nodeには過剰
- `cytoscape`: graph解析には強いが、業務cardを直接操作するReact component中心のeditorにはReact Flowのほうが適合する
- React Flow UI / Pro components: 既存Aimani AIのvisual languageを維持し、追加のdesign systemや有償機能へ依存しない

追加dependencyは`@xyflow/react`だけとする。

## 5. ドメインモデル

正式なドメイン語は、実験接頭辞ではなく意味で命名する。

```ts
type ProcessBoard = {
  boardId: string;
  organizationId: string;
  name: string;
  revision: number;
  steps: ProcessStep[];
  dependencies: StepDependency[];
  layouts: ProcessStepLayout[];
};

type ProcessStep = {
  stepId: string;
  organizationId: string;
  boardId: string;
  title: string;
  description: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  assignee: MembershipSummary;
  dueDate: string | null;
  updatedAt: string;
};

type StepDependency = {
  dependencyId: string;
  organizationId: string;
  boardId: string;
  predecessorStepId: string;
  successorStepId: string;
};

type ProcessStepLayout = {
  stepId: string;
  organizationId: string;
  boardId: string;
  position: { x: number; y: number };
};
```

`waiting`は保存しない。未完了predecessorが1つでもある`not_started` stepに対してread modelで導出する。

DB tableは削除境界が見えるように接頭辞を付ける。

```text
process_lab_board
process_lab_step
process_lab_dependency
process_lab_step_layout
```

semanticな`ProcessStep`とcanvas固有の`ProcessStepLayout`は分離する。全tableへ`organization_id`を持たせ、foreign key / unique constraintもOrganization / board境界を含める。boardの各mutation成功時に`revision`をincrementする。

## 6. 操作とデータフロー

```text
ProcessLab route loader
  → processLabQueryOptions
  → typed Server Function
  → process-lab.server.ts
  → Service Binding
  → private Hono API
  → ProcessLab use case / repository
  → PostgreSQL
```

query keyだけをclient mutationから利用する場合はside-effect-free leafへ置き、Server Functionを含むquery moduleをclient componentからimportしない。

mutation:

1. `moveProcessStep`: drag stopで`ProcessStepLayout`を保存。連続保存はclientで直列化し、失敗を黙って破棄しない
2. `connectProcessSteps`: dependencyを追加。server側で全graph invariantを再検証
3. `disconnectProcessSteps`: dependency解除。解除後もboard全体が弱連結かを検証
4. `changeProcessStepStatus`: waiting stepの開始をserver側でも拒否

成功後はexact Process Lab query keyをinvalidateする。React Flowの一時stateは`ProcessCanvas key={board.revision}`でserver read modelへ再同期し、新しい`useEffect`は追加しない。

## 7. UI / UX

### 既存Aimani AIを踏襲する

- App shell、top bar、side / bottom navigation
- `--canvas`、`--surface`、`--line`、`--brand`、`--attention`、`--connected`
- Manrope見出し + Noto Sans JP本文
- 既存TodoCardと同じradius、border、情報密度
- focus ring、44px以上の操作面、plain Japanese copy

### この画面固有のsignature

選択nodeを中心に、upstreamとdownstreamのedge / nodeだけをbrand色で強調し、それ以外を薄くする「責任の経路」を採用する。装飾ではなく、選択工程が何を待ち、次にどこへ渡るかを一目で示すための視覚表現である。

```text
┌────────────────── canvas ──────────────────┬─ detail ─┐
│ [要件整理] ───▶ [レビュー] ───▶ [実装]    │ 実装      │
│                     │             │         │ 担当 森   │
│                     └──▶ [確認] ──┘         │ 待ち 1件  │
│                                             │ 状態変更  │
└─────────────────────────────────────────────┴───────────┘
```

desktop:

- canvasを主役にし、detail panelは選択時だけ右側へ表示
- nodeはtitle、status、assignee、due dateだけを表示
- dependency追加中はvalid targetを明示
- invalid connectionは保存せず、理由をcanvas上部のlive regionへ表示
- edge 0 / isolated状態を空白で隠さず、破損状態として明示する

mobile:

- pan / zoom canvasを縮小表示しない
- topological orderで縦に並べ、predecessorを「待っている工程」として表示
- status変更とdetail閲覧は可能
- dependency編集とnode dragはdesktop専用であることを明記

## 8. エラーと空状態

- boardなし: 「工程ラボはまだ準備されていません。demo dataを初期化してください」
- service unavailable: fixed Japanese guidanceとretry
- invalid dependency: self / duplicate / cycle / disconnectedの理由をdomain error codeから固定文へ変換
- stale revision: 最新boardを再取得し、「別の変更を取り込みました」と表示
- Organization越境: APIで403 / 404を既存規約どおり返し、他Organizationの存在を開示しない

## 9. テスト方針

価値と本質的境界だけを守る。

1. pure graph test
   - 2 node / 0 edgeを拒否
   - isolated / self / duplicate / dangling / cycleを拒否
   - upstream / downstream pathとwaiting導出
2. PostgreSQL integration
   - real DBからnode / edge / membershipを取得
   - Organization越境を拒否
   - position、dependency、statusを保存
   - invalid mutation後にDBが変わらない
3. Web test
   - API result / domain errorのpresentation
   - React Flow mappingがnode / edgeを欠落させない
4. 実ブラウザ
   - desktopでnode drag → reload保持
   - edge追加 / 解除 → reload保持
   - waiting stepの開始拒否 → predecessor完了後に開始可能
   - mobile縦表示
   - direct SSR、console error 0、horizontal overflow 0

網羅coverage、snapshot乱立、React Flow内部のmock testは行わない。

## 10. 凝集と削除方法

主な配置:

```text
apps/web/src/features/process-lab/
apps/web/src/routes/$organizationId/process-lab.tsx
apps/api/src/features/process-lab/
packages/contracts/src/process-lab.ts
packages/db/src/schema/process-lab.ts
```

experiment外の変更は次だけに限定する。

- root navigation / Team Workのcontextual link 1箇所
- API composition / route mount 1箇所
- contract / DB barrel export 1箇所ずつ
- demo reset / seed registration 1箇所
- migration 1件
- `@xyflow/react` dependency

`docs/research/2026-07-28-process-lab-removal.md`へ、削除対象file、export、route、migration reversalを列挙する。正式採用時は`process-lab`の名前を残さず、別specでドメインへ昇格する。

## 11. 成功条件

ユーザーがlocal画面を触り、次を説明なしで言えることを成功とする。

- いま選んだ工程が何を待っているか
- この工程が終わると、次にどこへ進むか
- 誰が持っていて、期限と進捗がどうなっているか
- 接続変更と配置変更がreload後も残ること

実装が動くことと、工程管理が正式機能として価値を持つことは分ける。画面を触ったユーザーの評価を次の設計判断の正本とする。
