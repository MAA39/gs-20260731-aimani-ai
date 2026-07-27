# Identity → People 縦切り設計

日付: 2026-07-27  
ステータス: 採用。Claude Opusの反証レビュー、Cloudflare / Better Auth / Drizzle公式資料調査、旧Amidala / BYARD監査を反映

## 1. 目的

現在のモックPeople画面を、ローカルPostgreSQLの実データで動く次の導線に変える。

```text
Login
  -> Organization選択
  -> People一覧
  -> ユーザーが組織を切り替える
  -> 同じUserのまま別OrganizationのPeopleが表示される
```

成功条件は、ブラウザでログインし、複数組織のMembershipを選び、Peopleカードを実DBから読めること。Todo / Handoffの永続化は次のスライスに分ける。

## 2. 用語の正本

Better Authの公式語彙を反転させない。

| コード / DB | 意味 | Organizationとの関係 |
|---|---|---|
| `User` / `user` | 組織非依存の人・ログイン主体 | 直接つなげない |
| `Account` / `account` | password / OAuth credential | なし |
| `Session` / `session` | Userのログイン状態 | なし |
| `Organization` | workspace / tenant | Membership経由 |
| `Membership` | Userの組織内profile・role | `userId + organizationId` |
| `Relationship` | 同じ組織内のMembership間の関係 | `organizationId` 必須 |

BYARDの良い性質は「人と組織を分ける」ことであり、`Account`という名称自体ではない。

## 3. アーキテクチャ

```text
Browser
  -> TanStack Start Web/BFF Worker
       |- /api/auth/* same-origin proxy
       `- thin People Server Function
  -> Cloudflare Service Binding (API.fetch)
  -> private Hono API Worker
       |- Better Auth handler
       |- CurrentMembershipContext = session User + validated Membership
       |- listOrganizations / listPeople application services
       `- Drizzle + pg.Client
  -> local PostgreSQL 17
```

- Webはcookieの同一originと画面DTOの取得を担い、DBへ接続しない。
- APIは認証、Membership検証、tenant条件を担う。
- Better Authの`User`をそのままグローバル主体とし、Organization Pluginは使わない。
- API routeはAwilix containerを直接ドメインへ渡さず、application serviceだけをresolveする。
- `pg.Client`とDrizzle clientはrequest scopeで生成し、`finally`の`scope.dispose()`から`client.end()`する。Worker globalにDB接続を置かない。

## 4. データモデル

このスライスで作るtableは七つだけとする。

```text
user 1 --- N account
user 1 --- N session
verification

user 1 --- N membership N --- 1 organization
membership N --- N membership  (relationship)
```

Better Auth coreは公式adapterの既定table名 `user` / `account` / `session` / `verification`を使う。`usePlural`や`modelName`によるrenameは行わない。アプリ側も `organization` / `membership` / `relationship` の単数物理名に統一する。

`membership`:

- `id`
- `user_id`
- `organization_id`
- `display_name`
- `title`
- `role: owner | manager | member`
- `status: active | invited | suspended`
- `UNIQUE(user_id, organization_id)`

`relationship`:

- `id`
- `organization_id`
- `source_membership_id`
- `target_membership_id`
- `kind: manager_report | peer | supporter`
- `manager_report`はsource Membershipがmanager、target Membershipがdirect reportである有向関係
- source / targetの自己関係をCHECKで禁止
- source / targetは `(membership.id, membership.organization_id)` への複合FKで同一Organizationを保証
- `peer` / `supporter`の反転重複はapplication serviceで正規化し、`manager_report`の方向は保つ

Todo / Handoff table、RLS、audit、outboxは作らない。

## 5. 境界とデータフロー

applicationが依存するportは小さくする。

```ts
export interface MembershipRepository {
  listActiveMembershipsForUser(userId: string): Promise<OrganizationMembershipSummary[]>;
  findActive(userId: string, organizationId: string): Promise<MembershipRecord | null>;
}

export interface PeopleRepository {
  listForMembership(membership: MembershipRecord): Promise<MemberSummary[]>;
}
```

APIはrequest cookieからsession Userを復元し、pathの`organizationId`でactive Membershipを引く。People queryは検証済みMembershipを受け、必ずその`organizationId`をwhere条件に含める。Relationshipはleft joinとし、関係未設定のactive MembershipもPeopleに表示する。自分自身は除き、一人一カード、関係が複数あれば`manager_report` → `supporter` → `peer`の順で並べた配列で返す。

WebはPeople loaderからthin Server Functionを呼び、Server Functionはcookieをprivate APIへ転送するだけとする。React componentでfetch/useEffectしない。

## 6. UX

- Loginはemail/passwordとdemo credentialを同じ画面で示す。sign-up画面はこのスライスに追加しない。
- Login成功後、Membershipが1件でもOrganization chooserを一度表示し、UserとOrganizationが別物だと理解できるようにする。
- Organizationを選ぶと`/$organizationId/people`へ移動する。組織スイッチャーは常設する。
- People cardは名前、肩書き、関係kindを表示する。Relationship未設定は「関係を未設定」と明示する。open Todo件数はTodo table導入まで「まだTodoなし」とし、偽の数値を出さない。
- pending / invalid credential / no membership / empty peopleを文言と次アクションで表す。
- desktopは左nav、mobileはbottom nav。`docs/design/foundation.md`のtokenを保つ。

## 7. 品質予算

- 既存Composition Root smoke testは維持する。
- 他OrganizationのPeopleを読めないAPI integration testを1本追加する。これがこのスライスのTDD境界となる。
- 認証ライブラリ自体や細かいCSS分岐をテストしない。
- build、Wrangler dry-run、local migration / seed、実ブラウザのデスクトップ/モバイル確認を行う。

## 8. 対象外

- Organization作成 / invitation / email verification / password reset
- Todo / Handoff永続化
- Hyperdriveと本番PostgreSQL resource作成
- Queue / Webhook Worker / RLS / audit / full CQRS / ES
- 汎用component catalog、Storybook、coverage gate
