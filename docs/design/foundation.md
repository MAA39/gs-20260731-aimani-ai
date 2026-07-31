# Aimani AI v2 Design Foundation

基準日: 2026-07-26
ステータス: Touchable MVP 用。実画面レビューで更新する

## デザインの主題

対象は、マネージャーとメンバーが「誰と、何を進め、誰へ責任を渡したか」を理解するプロダクトである。

最初の画面の仕事は dashboard の数字を見せることではない。次に関わる人と、その人との間に残っている仕事を選べるようにすること。

## 方針

### Relationship first

People を単なる directory にしない。相手との関係、共有 Todo、次の action を同じ視線上に置く。

### Responsibility is visible

Todo の責任者を avatar だけで示さない。氏名、role、状態を表示し、Handoff 前後の変化を一本の流れとして見せる。

### Calm, not corporate-heavy

金融系 dashboard のような硬い table と警告の密度にしない。白い作業面、柔らかい indigo、十分な余白を使う。一方で、丸みと gradient を無秩序に増やして AI テンプレート風にしない。

## 視覚シグネチャ: Relationship rail

人物、Todo、Handoff を細い一本の rail で結ぶ。

```text
依頼中:          [現在担当（依頼者）] ── Todo ──▶ [引き継ぎ先]       requested
引き継ぎ済み:    [旧担当（依頼者）]   ── Todo ──▶ [現在担当]         accepted
見送り / 取消済み:[現在担当（依頼者）] ── Todo ──× [候補だった相手]   rejected / canceled
```

rail は decoration ではなく、責任がどこからどこへ動くかを表す。People card の次 action、Todo card の assignee、Handoff inbox の decision に同じ文法を使う。

責任nodeを実際に移動するのはacceptedだけである。rejected / canceledでは現在担当を依頼者のままにし、候補へのrailを切れた線と文言で表す。

## Color tokens

既存 Aimani AI の indigo と BYARD の状態表現を再解釈する。緑を brand color ではなく成功/接続の意味に限定する。

| token | value | 用途 |
|---|---:|---|
| `--ink` | `#26264A` | 見出し、主要本文 |
| `--ink-muted` | `#686A86` | 補助情報 |
| `--canvas` | `#F6F7FB` | app 背景。既存 Aimani AI を継承 |
| `--surface` | `#FFFFFF` | card / dialog |
| `--line` | `#E1E3EF` | border / rail inactive |
| `--brand` | `#6677E8` | primary action。既存 `#758BFD` を少し締める |
| `--brand-soft` | `#EEF0FF` | selected / focus background |
| `--connected` | `#3D9B78` | accepted / connected |
| `--attention` | `#D8962E` | pending / due soon |
| `--danger` | `#D34F66` | destructive / error。見送りはerrorとして扱わない |

状態は必ず text または icon を併用する。`green = good` だけで意味を伝えない。

## Typography

- Display / heading: `Manrope`, 既存 Aimani AI の親しみを継承。
- Body: `Noto Sans JP`, 日本語の可読性と文字幅を優先。
- Utility / data: `Manrope`, 数値・status label・date に限定。
- body 16px / 1.65、caption 13px / 1.5。既存 14px body は密度が高いため採用しない。
- 見出しは太さだけで階層を作り、過剰な大文字英語や letter spacing を使わない。

## Layout

Desktop:

```text
┌───────────────┬──────────────────────────────────────┐
│ org / nav     │ page title                 account   │
│ 240px         ├──────────────────────────────────────┤
│               │ context / next action               │
│ People        │                                      │
│ Todos         │ primary work surface                 │
│ Inbox         │ max 1120px, fluid                    │
└───────────────┴──────────────────────────────────────┘
```

Mobile:

```text
┌──────────────────────────┐
│ org              account │
├──────────────────────────┤
│ page / person context    │
│                          │
│ primary work surface     │
│                          │
├──────────────────────────┤
│ People  Todos  Inbox     │
└──────────────────────────┘
```

- 8px spacing rhythm。主要 gap は 8 / 12 / 16 / 24 / 32 / 48。
- surface radius 16px、control 10px、pill 999px。
- desktop は固定幅 1104px を廃止し、`minmax(0, 1120px)` を基準にする。
- mobile breakpoint は 800px を出発点にするが、component の崩れで決め直す。

## Components

最初から作る primitive:

- Button: primary / secondary / quiet / danger
- TextField / TextArea / FieldError
- PersonAvatar + RelationshipLabel
- StatusBadge
- Surface / EmptyState
- Dialog（Base UI）
- Menu（Base UI）
- Toast
- Skeleton

最初から作らないもの:

- 汎用 DataGrid
- 汎用 workflow canvas
- chart library wrapper
- 何でも入る Card component
- variant を大量に持つ design-system package

同じ構造が3画面で繰り返されてから共通化する。

## Motion

特徴的な motion は Handoff decision の一箇所に使う。Accept 後、rail の node が旧担当から新担当へ 180–240ms で移り、status copy が更新される。

- 通常 hover: 120–160ms
- Dialog: opacity + 4px translate、180ms
- `prefers-reduced-motion` では位置移動を止め、即時の色/文言更新だけにする。
- page load の連続 fade-in や常時 pulse は使わない。

## Copy vocabulary

| 内部語 | UI 表示 |
|---|---|
| User | アカウント（設定内のみ） |
| Organization | 組織 |
| Membership | メンバー / 組織での役割 |
| Relationship | 関係 |
| Todo | Todo |
| TodoHandoff（画面概念） | 引き継ぎ |
| requested | 引き継ぎを依頼中 |
| accepted | 引き継ぎ済み |
| rejected | 引き継ぎを見送り |
| canceled | 引き継ぎ依頼を取消済み |

Button は結果を表す。「送信」ではなく「引き継ぎを依頼」、「OK」ではなく「引き受ける」。toast も同じ動詞を使う。

「引き継ぎ」画面はそれ自体が意思決定のwork surfaceである。incoming cardに「引き受ける」「見送る」をinlineで置き、同じ判断を確認Dialogで繰り返さない。依頼入力だけは引き継ぎ先と意図を集中して確認するためDialogを使う。送った依頼には「依頼を取り消す」をquiet actionとして置く。

状態色はacceptedを`--connected`、requestedを`--attention`、rejected / canceledをneutralなmuted surfaceで表す。見送りをdangerやerrorとして罰する表現にしない。取消action自体のhover/errorには`--danger`を使ってよいが、取消済み状態はneutralにする。

## 状態別の画面ルール

- Empty: 何がないか + 最初の action を一つ出す。
- Pending: 最終 layout と同じ寸法の skeleton。global spinner で全画面を止めない。
- Validation error: field の近くに修正方法を出す。
- API error: 実行できなかった action と再試行を出す。
- Success: toast だけで終わらず、一覧・担当者・status の変化を画面本体へ反映する。
- Permission denied: 操作を隠すだけにせず、必要なら「この組織では閲覧できません」と現在 context を示す。

## Accessibility floor

- すべての操作を keyboard で到達・実行可能にする。
- focus ring は `2px var(--brand)` + offset 2px。
- icon-only button は accessible name と tooltip を持つ。
- avatar、色、position のみで人や状態を識別させない。
- dialog を閉じたら trigger に focus を戻す。
- 主要操作の target は最低 40px、mobile は 44px を目安にする。

## 初回デザインレビュー

各主要画面で desktop 1440px と mobile 390px の screenshot を撮り、次だけを確認する。

1. 3秒で次の action が分かるか。
2. 今どの組織・誰との文脈かが分かるか。
3. Todo の現在担当と Handoff の行き先が分かるか。
4. 空/待機/失敗時に次の操作があるか。
5. 既存 Aimani AI/BYARD の認知を活かしつつ、古い画面の密度を持ち込んでいないか。

重箱の隅の pixel review はこの段階では行わない。触った時に判断を妨げる問題を先に直す。

## 実画面レビュー記録

### Todo Handoff 検証（2026-07-27）

1280×720でaccepted HandoffがincomingからRecentへ即時移るrailと、Assigned Todoで森 ハルへ責任が移ることを確認した。390×844ではrequest Dialogのrecipient初期focus、未選択時submit disabled、Close `80×48.4` / submit `144×50.4`、`clientWidth=390` / `scrollWidth=375`を確認した。warn/error logsは空。reduced-motionは未エミュレートのためpending。実画面は[desktop](../assets/todo-handoff/accepted-recent-desktop.png) / [mobile](../assets/todo-handoff/request-or-incoming-mobile.png)に保存した。

2026-07-27 に Identity → People の最初の縦切りを実ブラウザで確認した。

- 1280×900: Login、組織選択、Acme Studio / Northstar Lab の People、組織切替を確認。
- 390×844: People card と bottom navigation を確認。`scrollWidth === clientWidth` で横スクロールなし。
- People navigation は現在の Organization ID を保持する。
- API failure と forbidden を別状態として表示し、service failure では再試行できる。
- React/browser console の warning / error は0件。

Login は Relationship rail の考え方を説明する面と認証面を分け、組織選択は Membership を選ぶ画面として実装した。People は dashboard 指標ではなく、Member と Relationship を最初に見せる。実データに Todo がまだない段階で件数を捏造せず「共有Todoはまだありません」と表示する。

実画面確認により、TanStack Start の document shell と stylesheet 登録が欠けると、ビルド成功でも無装飾のSSR画面になることが分かった。以後のプロダクトでも `HeadContent`、route assetとしてのstylesheet、`Scripts` をroot documentの完了条件に含める。

### Person SharedTodo workspace

2026-07-27 に People → Person SharedTodo → 作成 → 一覧反映を実ブラウザで確認した。

- Relationshipレコードが未設定でも成立するため、コードとUIの主語を`RelationshipTodo`ではなく`SharedTodo`へ統一した。
- 親`people` routeはOutlet専用、People一覧はexact index routeへ分離する。子routeを追加した時に親Pageで上書きしない。
- 1280×900でPerson context、composer、作成者→現在担当のrailを確認。作成後、一覧へ作成者「田中 彩」・担当「佐藤 花子」が反映された。
- 390×844でrailを縦積みにし、長い日本語名を省略せず、bottom navigationと共存。`scrollWidth === clientWidth`。
- SSRとbrowserの日時表示には`Asia/Tokyo`を明示し、runtime timezone差によるhydration mismatchを防ぐ。
- fresh tabのconsole warning / errorは0件。

以後もroute追加時はbuildだけでなく、親子routeを実際に遷移してOutletを確認する。日時をSSRする画面は表示timezoneを仕様として固定する。
