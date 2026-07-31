# アイマニAI PlanetScale運用Runbook

## 対象

このRunbookはアイマニAI公開デモ専用です。

- Database: `gs-20260731-aimani-ai`
- Region: AWS `ap-northeast-1`（Tokyo）
- Cluster: PS-5 Single Node
- Hyperdrive: `gs-20260731-aimani-ai-db`（query cache disabled）
- API Worker: `gs-20260731-aimani-ai-api`（外部非公開）
- Web Worker: `gs-20260731-aimani-ai-web`（公開）

Supabase、D1、既存DB、既存Hyperdrive、既存Better Auth secretは使用しません。

## 根拠

- [Cloudflare: PlanetScale Postgres integration](https://developers.cloudflare.com/hyperdrive/planetscale/)
- [Cloudflare: PlanetScale Postgres connection](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/planetscale-postgres/)
- [Cloudflare: Hyperdrive query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)
- [PlanetScale: Postgres connections](https://planetscale.com/docs/postgres/connecting)
- [PlanetScale: Postgres pricing](https://planetscale.com/docs/postgres/pricing)

既存の`pg` 8.22とDrizzleを維持します。Hyperdriveが接続プールを担当するため、PlanetScale serverless driverと専用PgBouncerは追加しません。認証・権限・Todo・Handoffはread-after-writeが重要であり、Hyperdriveはwrite時にread cacheを自動失効しないため、初期構成ではcacheを全面無効にします。

## 課金前確認

Cloudflare dashboardの作成確認画面を正とし、作成直前に次を人間へ提示します。

- Database nameが `gs-20260731-aimani-ai`
- AWS `ap-northeast-1`（Tokyo）
- PS-5 Single Node、HAなし
- development branchなし
- 画面に表示された月額・日額と追加storage料金

条件が一つでも違えば作成しません。PlanetScaleはDB作成後、利用がなくても削除まで課金されます。

## Secret保管

Keychain service名を固定します。

- migration URL: `gs-20260731-aimani-ai-migration-url`
- Better Auth secret: `gs-20260731-aimani-ai-better-auth-secret`

PlanetScale画面でdirect primary URLをCopyした後、値をterminalやprocess引数へ表示せずpromptへ貼ります。

```bash
security add-generic-password \
  -a postgres \
  -s gs-20260731-aimani-ai-migration-url \
  -U -w
printf '' | pbcopy
```

Better Auth secretもこの製品専用に新規生成します。

```bash
openssl rand -base64 32 | pbcopy
security add-generic-password \
  -a worker \
  -s gs-20260731-aimani-ai-better-auth-secret \
  -U -w
printf '' | pbcopy
```

## Migration

PlanetScaleのdirect connectionはport 5432、database `postgres`、`sslmode=verify-full`を使います。migration roleはschema変更用で、Hyperdriveのruntime credentialへ流用しません。

```bash
DATABASE_URL="$(security find-generic-password \
  -a postgres \
  -s gs-20260731-aimani-ai-migration-url \
  -w)" pnpm db:migrate
```

失敗した場合はWorkerをデプロイせず停止します。migrationの自動rollbackは行いません。

## Runtime roleとHyperdrive

専用DB内にruntime roleを作り、既存tableのread/writeだけを許可します。schema変更にはmigration roleを使います。

```bash
pnpm --filter @aimani-ai/api exec wrangler hyperdrive list
export AIMANI_HYPERDRIVE_ID='Cloudflare画面で確認した専用HyperdriveのUUID'
test -n "$AIMANI_HYPERDRIVE_ID"
pnpm --filter @aimani-ai/api exec wrangler hyperdrive update \
  "$AIMANI_HYPERDRIVE_ID" \
  --caching-disabled
pnpm --filter @aimani-ai/api exec wrangler hyperdrive get \
  "$AIMANI_HYPERDRIVE_ID"
```

確認したUUIDを `apps/api/wrangler.jsonc` のbinding `HYPERDRIVE`へ設定します。別Hyperdriveと名前が一致しないIDは設定しません。

## 公開demo seed

seed入口は次の全条件を検証してから接続します。

- confirmationが `gs-20260731-aimani-ai`
- hostnameが `*.horizon.psdb.cloud`
- direct port 5432
- database `/postgres`
- `sslmode=verify-full`

```bash
DATABASE_URL="$(security find-generic-password \
  -a postgres \
  -s gs-20260731-aimani-ai-migration-url \
  -w)" \
BETTER_AUTH_SECRET="$(security find-generic-password \
  -a worker \
  -s gs-20260731-aimani-ai-better-auth-secret \
  -w)" \
BETTER_AUTH_URL="$AIMANI_WEB_URL" \
PUBLIC_DEMO_SEED_CONFIRMATION='gs-20260731-aimani-ai' \
pnpm db:public:seed
```

このseedは冪等です。公開DBに対して`db:demo:reset`、drop、truncate、integration testは実行しません。

## Deploy

Webの正確なworkers.dev URLを確認し、APIの`BETTER_AUTH_URL`へ設定します。Better Auth secretは標準入力から登録します。

```bash
security find-generic-password \
  -a worker \
  -s gs-20260731-aimani-ai-better-auth-secret \
  -w | pnpm --filter @aimani-ai/api exec wrangler secret put BETTER_AUTH_SECRET

pnpm --filter @aimani-ai/api exec wrangler deploy --dry-run
pnpm --filter @aimani-ai/web exec wrangler deploy --dry-run
pnpm --filter @aimani-ai/api exec wrangler deploy
pnpm --filter @aimani-ai/web exec wrangler deploy
```

APIは先にデプロイし、`workers_dev: false`を維持します。Webだけが公開URLを持ち、APIはService Binding `API`から呼びます。

## Smoke test

共有デモ資格情報でログインし、Organizations、People、Todo作成・完了、Handoff依頼・受領・却下・取消、Today、Team Work、Process Labを確認します。Today、Team Work、Process Labはモバイル幅でも確認します。

## 停止・削除

1. Web/APIの公開導線を停止する。
2. `gs-20260731-aimani-ai-db` だけを削除する。
3. 必要なデモデータをexportする。
4. `gs-20260731-aimani-ai` だけを削除する。
5. Keychainの上記2項目を削除する。

他のWorker、Hyperdrive、PlanetScale、Supabase資産を削除しません。
