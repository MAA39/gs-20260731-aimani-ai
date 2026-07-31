# 既存 Aimani AI / BYARD UX 監査

調査日: 2026-07-26
方針: 既存リポジトリは読み取り専用。新規実装は `aimani-ai-v2` のみ

## 調査の問い

1. ユーザーは何を起点に仕事を理解していたか。
2. Account と Organization の関係は画面にどう現れていたか。
3. Todo/Handoff に転用すべき操作と状態は何か。
4. 見た目、コピー、アクセシビリティの何を残し、何を作り直すか。

## Aimani AI から得たもの

### People を起点にする情報設計

Aimani AI は `/l/people/:uuid` の相手ワークスペースに `1on1`、`todo`、`history`、`goals`、`message`、`profile` を並べている。仕事の種類ではなく「誰との関係か」を先に選ぶ設計であり、Aimani AI v2 の核として継承する。

根拠:

- `aimani-ai-angular/src/app/authorized-routing-module/top-page-routing-module/top-routing.ts:8-120`
- `aimani-ai-angular/src/app/authorized-routing-module/top-page-routing-module/top-tab-layout/top-tab-layout.component.html:19-45,87-120`

### 未完了を正式な状態として見せる

1on1 は NOW/NEXT/WAITING/NOT_YET、Schedule/Agenda の OK/NG、作成前 status card を持つ。空、未設定、反映中を隠さず、次に何をすればよいかへ変換している。この考え方を Todo/Handoff に移す。

根拠:

- `aimani-ai-angular/src/app/authorized-routing-module/top-page-routing-module/people/one-on-one/ooo-main/ooo-main.component.html:31-37,89-221`
- `aimani-ai-angular/src/app/authorized-routing-module/top-page-routing-module/people/one-on-one/ooo-detail/ooo-detail.component.html:1-12,28-85`
- `aimani-ai-angular/src/app/authorized-routing-module/top-page-routing-module/people/one-on-one/ooo-detail/ooo-status-card/ooo-status-card.component.html:1-98`

### Todo の見方と Handoff の原型

既存 Todo は検索、作成、List/Chart/Matrix、空状態を持つ。transfer 設定では相手、説明、Cancel、選択0件時 disabled、確定操作を明示する。初期 MVP は List に絞るが、責任移管を独立した確認操作にする点を継承する。

根拠:

- `aimani-ai-angular/src/app/authorized-routing-module/authorized-shared/components/todo-base/todo-base.component.html:5-123`

### デザイン資産

- primary `#758BFD`、accent `#FCE158`、warn `#F5413D`、本文 `#383874`
- Manrope + Noto Sans JP
- 8/12/20px を含む角丸、60/176px side navigation
- desktop 800px 以上、mobile 800px 未満

根拠:

- `aimani-ai-angular/src/assets/scss/_variables.scss:1-107`
- `aimani-ai-angular/src/assets/scss/_theme.scss:1-115`
- `aimani-ai-angular/src/app/authorized-routing-module/authorized-shared/components/side-nav-main/side-nav-main.component.scss:47-154`

## BYARD から得たもの

### Account / Member / Organization の分離

BYARD は Account を認証主体、Member を Organization 内の人物・権限として扱い、同じ Account の複数 Organization 所属を表現する。Aimani AI v2 ではこの境界を継承しつつ、Better Authの公式語彙に合わせて User / Membership と呼ぶ。Accountはcredentialの意味に予約する。

根拠:

- `BYARD/backyard/docs/legacy/org_user_data_model_review.md:5-103`
- `BYARD/backyard/amplify/backend/api/backyard/schema/schema.graphql:1-15,40-70,129-216`

### 組織 switcher と仕事の状態密度

BYARD は drawer の先頭に Organization switcher を置き、Stream/Work/Template/Member/Settings を並べる。Work は assignee、collaborator、期限、完了、機密、Todo 進捗をカード/ノードに集約する。

根拠:

- `BYARD/backyard/src/components/common/layout/Drawer.tsx:34-305`
- `BYARD/backyard/src/components/common/layout/OrganizationSelect.tsx:43-57`
- `BYARD/backyard/src/components/workgroup/WorkNode.tsx:307-327,399-518`

### そのまま持ち込まないもの

BYARD の permission は Docs の説明より実装が多層化し、Stream/Work/Todo の祖先 ID や中間 table も増えている。独立モデルの意図は継承するが、4層以上の権限、15以上の関係 table、画面上の曖昧な Stream/案件二重語彙は持ち込まない。

根拠:

- `BYARD/backyard/docs/design/domain_review.md:29-36,55-170`
- `BYARD/backyard/docs/design/byard_lessons_learned.md:23-30`
- `BYARD/backyard/amplify/backend/api/backyard/schema/schema.graphql:155-216,300-411,457-588`
- `BYARD/backyard/public/locales/ja.ts:7-11,93-146,860-864`

## 移植判断

| 対象 | 判断 | Aimani AI v2 での扱い |
|---|---|---|
| People → 相手 workspace | そのまま継承 | People を初期 home とし、相手詳細から Todo へ入る |
| 相手タブ | 再解釈 | 初期は Overview / Todos。1on1 / History / Goals は後続 slice |
| Todo transfer | 再解釈 | request → accept/reject の明示 Handoff にする |
| User と Organization | そのまま継承 | Membership で接続し、一人が複数組織へ所属可能 |
| Organization switcher | そのまま継承 | shell 上部に常設し、切替結果を明示する |
| BYARD の Work 状態密度 | 再解釈 | Todo card に担当、関係、期限、handoff 状態を優先表示 |
| 既存の固定 1104px layout | 不採用 | fluid content + max width。mobile では bottom navigation |
| 色だけの OK/NG/期限 | 不採用 | icon + text + color を併用 |
| MUI / Angular Material の見た目 | 不採用 | behavior は Base UI、見た目は独自 token で所有 |
| 既存の4層以上の権限 | 不採用 | owner / manager / member と resource ownership から開始 |
| Storybook を先に整備 | 不採用 | 実画面で再利用が発生してから追加 |

## 最初の画面仕様

### 1. Login / demo entry

- 迷わず触れる demo account を表示する。
- sign in と create account を一画面で過密にしない。
- error は原因と次の操作を input 近くに出す。

### 2. Organization switcher

- User と Organization が別であることを UI で自然に示す。
- 現在の Organization、Membership role、切替先を一つの menu にする。
- 切替後は People home へ移り、toast で現在地を伝える。

### 3. People relationship hub

- manager / report / peer の filter。
- person card に関係、role、未完了 Todo、次の action を表示。
- 空状態は「メンバーを追加」ではなく、demo では seed person を提示する。

### 4. Person workspace / Todos

- person header、relationship label、shared Todo list、Todo composer。
- Todo card は title、assignee、creator、handoff state を見せる。
- 一覧の横に重い dashboard を置かず、作成と状況理解を優先する。

### 5. Handoff inbox

- requester → current assignee → proposed recipient を一本の rail で表示。
- Accept と Reject を同格にせず、意図を確認できる copy を添える。
- Accept 後は Todo assignee が変わったことを同じ画面上で確認できる。

## 未検証事項

- Aimani AI の Storybook/Figma は対象 repository 内に見つからなかった。
- Angular の最終的な見た目は local 起動での目視確認が必要。
- `Byard_mp4` の録画は BYARD の画面根拠であり、Aimani AI の画面として扱わない。
- 初回 UI 実装後、legacy と新規を並べた screenshot critique を行う。
