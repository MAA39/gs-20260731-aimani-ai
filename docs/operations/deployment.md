# デプロイメント運用

公開URLはデプロイ完了後にこの文書へ追記します。未確定URLをREADMEやこの文書に先に書かない方針です。

## 専用資産名

- GitHub repository: `MAA39/gs-20260731-aimani-ai`
- PlanetScale Postgres: `gs-20260731-aimani-ai`（Tokyo、PS-5 Single Node）
- Hyperdrive: `gs-20260731-aimani-ai-db`（caching disabled）
- Workers: `gs-20260731-aimani-ai-api` / `gs-20260731-aimani-ai-web`
- bindings: API / `HYPERDRIVE`
- ローカルデモDB: `aimani_ai_demo`（公開環境と共有しない）

公開環境では認証secretと接続credentialをCloudflare/PlanetScaleおよびmacOS Keychainへ保存し、リポジトリやDocsへ値を書き込みません。既存製品用Supabaseとその環境変数は使用しません。

## 作成順序

1. Cloudflare画面でPlanetScale Postgres `gs-20260731-aimani-ai` をTokyo、PS-5 Single Nodeで作成する
2. migration roleのdirect URLをKeychainへ保存し、Drizzle migrationを適用する
3. runtime roleとHyperdrive `gs-20260731-aimani-ai-db` を作成し、query cacheを無効化する
4. 接続先guardを通して公開デモ用seedを投入する
5. 専用Better Auth secretを登録し、`gs-20260731-aimani-ai-api` Workerをデプロイする
6. Service Binding `API` を持つ `gs-20260731-aimani-ai-web` Workerをデプロイする
7. ログイン、Today、Todo、Handoff、Team Work、Process Labをデスクトップとモバイル幅で確認する
8. 実際の公開URLをこの文書とREADMEへ追記する

具体的なコマンドと誤操作防止条件は [PlanetScale運用Runbook](planet-scale-runbook.md) を正本とします。

## ロールバック

直前に検証済みのcommitへデプロイを戻し、DB migrationの逆戻しは自動実行しません。停止時はWeb/APIの公開導線、専用Hyperdrive、専用PlanetScaleの順に扱い、他製品のWorkerやDBを変更しません。共有デモ環境は冪等seedで初期状態を補い、DB全体のdrop/resetはしません。
