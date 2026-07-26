# Auth / PostgreSQL / DI Research Gate（2026-07-26）

## 目的

Task 2 の Login → Organization 選択 → People を実装する前に、Cloudflare Workers、PostgreSQL、Better Auth、Drizzle、Awilix の現行プラクティスを公式資料から確認した記録。Amidala v2 だけでなく、同じ構成を採る新製品の叩き台として扱う。

優先順位は、金融系の過剰な堅牢性ではなく、ブラウザで早く触れて確認できること。そのうえで、認証・テナント境界・秘密情報の置き場所だけは後から崩しにくい形にする。

## 採用する最小構成

```text
Browser
  -> public TanStack Start Web / BFF Worker
  -> Service Binding
  -> private Hono API Worker
       |- Better Auth handler
       |- request-scoped application services
       |- Drizzle + node-postgres
       `- Hyperdrive -> PostgreSQL
```

- DB binding と DB secret は API Worker だけが持つ。
- API Worker は `workers_dev: false` / `preview_urls: false` とし、Web Worker から Service Binding 経由でのみ呼ぶ。
- ブラウザから見た認証APIは Web/BFF の同一オリジンに置き、BFF が private API Worker の `/api/auth/*` へ転送する。
- DB driver は Cloudflare 推奨との相性を優先し、`pg` + `drizzle-orm/node-postgres` を採用する。
- PostgreSQL 接続は Hyperdrive を経由し、API request ごとに client を生成・終了する。Worker global に Pool や接続を保持しない。
- 初期は auth/session/permission/read-after-write の鮮度を優先し、Hyperdrive query cache に依存しない。

## 認証と組織モデル

Better Auth の core model と Organization model を混ぜない。

```text
User ----< Account
  |
  +------< Session
  |
  +------< Membership >------ Organization
```

- `user`: 人としてのアカウント主体。
- `account`: credential / OAuth provider。Organization を持たせない。
- `session`: User のログイン状態。
- `organization`: workspace / tenant。
- `membership`: `userId + organizationId + role`。User と Organization の所属を表す。
- People / Todo / Handoff などの業務データは `organizationId` を必須にし、query 時にも membership を検証する。

Organization plugin の team、複雑なRBAC、invitation flowはMVPに先行導入しない。最初は organization 一覧、選択、membership 確認だけに絞る。

## Better Auth / TanStack Start

### MUST

- `BETTER_AUTH_SECRET` は32文字以上の高エントロピー値を Worker secret として保持する。
- Better Auth の schema はCLIで生成し、Drizzle migrationとして適用する。Worker起動時にmigrationしない。
- cookieはHTTP-only / Secure（本番）/ SameSite=Laxを基本にし、tokenをlocalStorageへ保存しない。
- `trustedOrigins` は本番originとlocalhost開発originだけを明示する。CSRF/Origin checkを無効化しない。
- loader / server function / API handler のデータ境界で session と membership を検証する。`beforeLoad` はUX上のredirectであり、認可境界にはしない。
- session依存レスポンスをpublic cacheへ載せない。

### SHOULD

- Login成功後は Organization chooser へ進み、選択された `organizationId` を型検証して People loader へ渡す。
- Organization変更後は mutation 完了後に router を invalidate する。
- TanStack Start側でauth cookieを書き込む処理には、現行の `tanstackStartCookies` pluginを検討する。
- 同一originを基本とし、CORSは別origin開発が本当に必要な場合だけ限定origin + credentialsで設定する。

### AVOID

- `account.organizationId` や `user.organizationId` による単一組織への直結。
- 全origin許可とcredentialsの併用。
- SameSite=Noneの常用。
- GETによるmutation、CSRF checkの無効化。
- middleware一箇所だけで全テナント認可が済んだとみなすこと。

## Hyperdrive / Drizzle / PostgreSQL

### MUST

- API Workerにだけ `HYPERDRIVE` binding と `nodejs_compat` を設定する。
- repository は `organizationId` / principal 条件を必須にする。
- requestごとに `env.HYPERDRIVE.connectionString` から `pg.Client` とDrizzle clientを生成し、`finally`で終了する。
- migrationはCLIまたはCIから開発/本番DBへ適用する。
- transactionはDB操作だけに限定し、外部APIや長い計算を含めない。

### SHOULD

- Supabase Postgresをoriginにする場合、まずHyperdriveからdirect endpointへの接続を選ぶ。IPv4要件がある場合のみpoolerを検討する。
- local developmentは `localConnectionString` のローカルPostgres、またはDB mockを使う。remote production DBへの開発書き込みはしない。
- Hyperdrive connection limitはorigin DBの上限より保守的に設定する。

### AVOID

- HyperdriveなしでWorkerからPostgreSQLへ直接接続すること。
- MVPでVPC/Tunnelを追加すること。
- `@supabase/supabase-js` をDrizzle/SQL層の代替として使うこと。
- `postgres.js` を第一候補にすること。利用可能だが、今回のCloudflare推奨・prepared statement・pooler条件では `pg` の方が単純。

## Awilix と依存方向

Awilixは採用するが、API composition rootに閉じ込める。

```text
interfaces/http -> application -> domain
        |              |
        +-> infrastructure/db implements domain ports
```

- root container: stateless singletonだけ（logger、clock、固定configなど）。
- requestごとに `root.createScope()` を作り、`env`、`request`、`principal` を値として登録する。
- DB client、repository、use caseはSCOPEDとし、`finally`でscopeをdisposeする。
- domainはHono / Drizzle / Awilixをimportしない。
- CQRS-liteはcommand/queryのDTOと関数を分けるところまで。bus、event store、full ESは導入しない。

依存が2〜3個のままでrequest-scoped resourceも不要なら、Awilixを使わず型付きの `createServices(env, principal, request)` factoryに戻す。この逃げ道を残し、containerの存在自体を設計目標にしない。

## Webhookの将来分離

MVPではWebhook WorkerもQueue resourceも作らない。同期use caseから外部Webhookを直接呼ばず、将来 `OutboxPublisher` / `EventPublisher` portをCloudflare Queue producerで実装できる依存方向にする。必要になった時点で `apps/webhook-worker` をconsumerとして追加し、retry / DLQ / idempotencyをそこで扱う。

## Task 2 実装順

1. APIにDrizzle schema、DB factory、migration設定を追加する。
2. Better Auth core + Organization schemaを生成する。
3. Hono `/api/auth/*` とWeb/BFF proxyを接続する。
4. Login画面を作り、成功後Organization chooserへ遷移させる。
5. membershipを検証してPeopleを返すqueryを一本通す。
6. 最小検証: login/logout、未認証redirect、別Organizationアクセス拒否、Web→API→DB smoke。

この段階では招待、複雑なrole、Todo/Handoff永続化、Webhook、包括的coverageを足さない。

## 公式資料

- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
- [Cloudflare: Drizzle ORM with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/)
- [Cloudflare: Supabase integration](https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/)
- [Cloudflare Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Cloudflare Workers bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)
- [Cloudflare Queues configuration](https://developers.cloudflare.com/queues/configuration/configure-queues/)
- [Supabase: connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Better Auth: Hono integration](https://better-auth.com/docs/integrations/hono)
- [Better Auth: Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth: database](https://better-auth.com/docs/concepts/database)
- [Better Auth: cookies](https://better-auth.com/docs/concepts/cookies)
- [Better Auth: security](https://better-auth.com/docs/reference/security)
- [Better Auth: Organization](https://better-auth.com/docs/plugins/organization)
- [Better Auth 1.4 / TanStack Start cookies](https://better-auth.com/blog/1-4)
- [TanStack Start authentication](https://tanstack.com/start/latest/docs/framework/react/guide/authentication)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Hono RPC](https://hono.dev/docs/guides/rpc)
- [Awilix](https://www.npmjs.com/package/awilix)
