# アイマニAI PlanetScale運用Runbook

> **現在は未有効:** 2026-07-31の提出用公開デモはDBなしのmock API方式を採用した。このRunbookは破棄資料ではなく、[ロードマップ Stage 3](../architecture/evolution-roadmap.md#stage-3--永続版をcloudflareへ公開する)で永続DBが必要になった場合の正本として使用する。実行直前に料金と公式仕様を再確認する。

## 作成前のActivation blocker

2026-08-01現在、このRunbookは草案であり、そのまま実行しない。外部資産を一つも作る前に、次をコード・test・設定templateへ反映してreviewする。

1. `import.meta.env.PROD`でmock/auth bypassを選ぶ分岐を、明示的な`demo|product` runtime modeへ置き換える。少なくとも`api-fetcher.server.ts`、`LoginForm.tsx`、`routes/__root.tsx`を対象にし、product modeでmock APIが呼ばれないtestを追加する。
2. `assertPublicDemoTarget`へexpected hostnameを受け取る仕組みを追加する。架空の専用hostを使い、完全一致は成功、同じproviderの別hostは失敗するnegative testを先に作る。
3. `db:public:migrate`のような専用入口を追加し、seedと同じprotocol、expected hostname、port、path、TLS、confirmation検査をDDLより前に通す。現在の`db:migrate`を外部DBへ直接使わない。
4. API Workerの`HYPERDRIVE`、Web WorkerのService Binding `API`、APIの`BETTER_AUTH_URL`を受け取るwrangler templateを用意し、未設定のproduct modeはfail closedにする。
5. PlanetScaleとCloudflareの料金、リージョン、credential/Hyperdrive作成画面、secret commandの挙動を公式資料で再確認する。
6. 人間が利用を承認したCloudflare account IDを確認し、Dashboardと`wrangler whoami`が同じIDを示すaccount gateを手順へ組み込む。

費用・責任者の承認前、または上記blockerが残る間はPlanetScale、Hyperdrive、API Workerを作成しない。

## DB作成後のGate

作成前blockerと費用承認が揃った後だけ、次を順に進める。

1. 専用PlanetScale DBを作り、実hostnameを得る。
2. expected hostnameへ実値を固定し、別PlanetScale hostを拒否するtestを再実行する。
3. guarded public migrationを実行する。
4. 最小権限runtime credentialとHyperdriveを作る。
5. binding/varsへ実IDとURLを反映し、API/Webのdry-runを通す。
6. private API、secret、Webの順でdeployし、外部非公開と主要journeyを確認する。

## 対象

このRunbookはアイマニAI公開デモ専用です。

- Database: `gs-20260731-aimani-ai`
- Region: AWS `ap-northeast-1`（Tokyo）
- Cluster: PS-5 Single Node
- Hyperdrive: `gs-20260731-aimani-ai-db`（query cache disabled）
- API Worker: `gs-20260731-aimani-ai-api`（外部非公開）
- Web Worker: `gs-20260731-aimani-ai-web`（公開）

Supabase、D1、既存DB、既存Hyperdrive、既存Better Auth secretは使用しません。

## Cloudflare account gate

同名資産を別Cloudflare accountへ作成・更新しないよう、最初の外部操作前と、Hyperdrive操作・deploy・削除の各直前に確認します。

1. 人間が今回の専用資産作成を承認したCloudflare account IDを、session内の`AIMANI_CLOUDFLARE_ACCOUNT_ID`へ設定する。値をこのDocsへ固定しない。
2. Cloudflare Dashboardで現在選択中のaccount IDが完全一致することを人間が確認する。
3. API/Web両workspaceで`wrangler whoami`を実行し、表示されたaccount IDが完全一致することを確認する。
4. 不一致、複数候補、未確認のいずれかなら停止する。

```bash
export AIMANI_CLOUDFLARE_ACCOUNT_ID='人間が承認したCloudflare account ID'
test -n "$AIMANI_CLOUDFLARE_ACCOUNT_ID"
pnpm --filter @aimani-ai/api exec wrangler whoami
pnpm --filter @aimani-ai/web exec wrangler whoami
```

`wrangler whoami`の表示確認は人間が行い、文字列の部分一致やaccount名だけで通過させません。

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

現在の`pnpm db:migrate`は接続URLの存在しか検査しないため、外部DBへ使いません。作成前blocker 3で、次の形の専用commandを実装してから使用します。

```bash
export AIMANI_EXPECTED_DATABASE_HOST='PlanetScale画面で確認した専用hostname'
test -n "$AIMANI_EXPECTED_DATABASE_HOST"

DATABASE_URL="$(security find-generic-password \
  -a postgres \
  -s gs-20260731-aimani-ai-migration-url \
  -w)" \
EXPECTED_DATABASE_HOST="$AIMANI_EXPECTED_DATABASE_HOST" \
PUBLIC_DEMO_MIGRATION_CONFIRMATION='gs-20260731-aimani-ai' \
pnpm db:public:migrate
```

`db:public:migrate`は2026-08-01現在まだ存在しない。このコードブロックは目標interfaceであり、実装・negative test・review前には実行しない。

失敗した場合はWorkerをデプロイせず停止します。migrationの自動rollbackは行いません。

## Runtime roleとHyperdrive

専用DB内にruntime roleを作り、既存tableのread/writeだけを許可します。schema変更にはmigration roleを使います。実行時点のPlanetScale公式手順で、`pg_read_all_data` / `pg_write_all_data`相当のDML権限を持ち、DDL権限を持たないcredentialであることを確認します。

1. PlanetScale Dashboardで専用runtime credentialを作る。migration URLを流用しない。
2. 表示された接続情報をCloudflare DashboardのHyperdrive「Create Configuration」へ直接入力し、`gs-20260731-aimani-ai-db`を作る。値をDocs、shell history、clipboard履歴へ残さない。
3. Cloudflare上で接続先hostnameが専用PlanetScale DBと完全一致することを確認する。
4. 作成後のIDをCLIで照合し、query cacheを無効にする。

直前に[Cloudflare account gate](#cloudflare-account-gate)を再実行します。

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

```jsonc
{
  "hyperdrive": [
    { "binding": "HYPERDRIVE", "id": "確認済みの専用Hyperdrive UUID" }
  ]
}
```

## 公開demo seed

seed入口は次の全条件を検証してから接続します。

- confirmationが `gs-20260731-aimani-ai`
- hostnameが作成後に固定した専用`*.horizon.psdb.cloud`と完全一致
- direct port 5432
- database `/postgres`
- `sslmode=verify-full`

現在のguardはhostname完全一致が未実装である。作成前blocker 2を解消し、別のPlanetScale hostnameを使ったnegative testが失敗するまでseedを実行しない。

```bash
export AIMANI_WEB_URL='https://gs-20260731-aimani-ai-web.masa-nekoshinshi39.workers.dev'
test "$AIMANI_WEB_URL" = 'https://gs-20260731-aimani-ai-web.masa-nekoshinshi39.workers.dev'
test -n "$AIMANI_EXPECTED_DATABASE_HOST"

DATABASE_URL="$(security find-generic-password \
  -a postgres \
  -s gs-20260731-aimani-ai-migration-url \
  -w)" \
BETTER_AUTH_SECRET="$(security find-generic-password \
  -a worker \
  -s gs-20260731-aimani-ai-better-auth-secret \
  -w)" \
BETTER_AUTH_URL="$AIMANI_WEB_URL" \
EXPECTED_DATABASE_HOST="$AIMANI_EXPECTED_DATABASE_HOST" \
PUBLIC_DEMO_SEED_CONFIRMATION='gs-20260731-aimani-ai' \
pnpm db:public:seed
```

このseedは冪等です。公開DBに対して`db:demo:reset`、drop、truncate、integration testは実行しません。

## Deploy

Webの正確なworkers.dev URLを確認し、APIの`BETTER_AUTH_URL`へ設定します。URLはsecretではないため、`apps/api/wrangler.jsonc`の`vars`へ明示します。Better Auth secretは標準入力から登録します。

```jsonc
// apps/api/wrangler.jsonc
{
  "workers_dev": false,
  "preview_urls": false,
  "vars": {
    "BETTER_AUTH_URL": "https://gs-20260731-aimani-ai-web.masa-nekoshinshi39.workers.dev"
  },
  "hyperdrive": [
    { "binding": "HYPERDRIVE", "id": "確認済みの専用Hyperdrive UUID" }
  ]
}

// apps/web/wrangler.jsonc
{
  "services": [
    { "binding": "API", "service": "gs-20260731-aimani-ai-api" }
  ]
}
```

API Workerに`routes`、custom domain、public preview URLがないことをCloudflare Dashboardと`wrangler`の両方で確認します。`workers_dev:false`だけを非公開確認の十分条件にしません。

`wrangler secret put`はsecret保存だけでなく新しいWorker versionの作成・deployを伴う。必ずbuildとAPI/Webのdry-runを先に行い、APIが外部非公開であることを確認してから実行する。

直前に[Cloudflare account gate](#cloudflare-account-gate)を再実行します。

```bash
pnpm --filter @aimani-ai/api exec wrangler deploy --dry-run
pnpm --filter @aimani-ai/web exec wrangler deploy --dry-run

# 初回はpublic routeを持たないAPI Workerだけを先にdeployする
pnpm --filter @aimani-ai/api exec wrangler deploy

# このcommand自体が新しいAPI Worker versionをdeployする
security find-generic-password \
  -a worker \
  -s gs-20260731-aimani-ai-better-auth-secret \
  -w | pnpm --filter @aimani-ai/api exec wrangler secret put BETTER_AUTH_SECRET

# APIのcurrent version、secret binding、外部非公開を確認してからWebをdeployする
pnpm --filter @aimani-ai/web exec wrangler deploy
```

APIは先にデプロイし、`workers_dev: false`と`preview_urls: false`を維持します。Webだけが公開URLを持ち、APIはService Binding `API`から呼びます。

## Smoke test

専用環境へseedしたtest accountでログインし、Organizations、People、Todo作成・完了、Handoff依頼・受領・却下・取消、Today、Team Work、Process Labを確認します。credentialはDocsへ書きません。Today、Team Work、Process Labはモバイル幅でも確認します。

## 停止・削除

削除前にも[Cloudflare account gate](#cloudflare-account-gate)を再実行し、Dashboardで各資産名とIDを一つずつ照合します。不一致・未確認なら削除しません。

1. Web/APIの公開導線を停止する。
2. `gs-20260731-aimani-ai-db` だけを削除する。
3. 必要なデモデータをexportする。
4. `gs-20260731-aimani-ai` だけを削除する。
5. Keychainの上記2項目を削除する。

他のWorker、Hyperdrive、PlanetScale、Supabase資産を削除しません。
