# デプロイメント運用

公開URL: https://gs-20260731-aimani-ai-web.masa-nekoshinshi39.workers.dev

## 現在の公開方式

提出用公開デモはDBなしで動かします。TanStack Startのserver-only mock APIが固定fixtureを返し、Web Workerだけをデプロイします。API Worker、Hyperdrive、PlanetScale、Supabase、D1は現在の公開版では使用しません。

## 専用資産名

- GitHub repository: `MAA39/gs-20260731-aimani-ai`
- Worker: `gs-20260731-aimani-ai-web`
- DB/binding: なし
- ローカルデモDB: `aimani_ai_demo`（公開環境と共有しない）

公開環境では認証secretと接続credentialをCloudflare/PlanetScaleおよびmacOS Keychainへ保存し、リポジトリやDocsへ値を書き込みません。既存製品用Supabaseとその環境変数は使用しません。

## 作成順序

1. `pnpm --filter @aimani-ai/web test`
2. `pnpm --filter @aimani-ai/web build`
3. `pnpm --filter @aimani-ai/web exec wrangler deploy`
4. Organizations、People、Todo、Handoff、Today、Team Work、Process Labを確認する

将来DB版へ戻す場合だけ [PlanetScale運用Runbook](planet-scale-runbook.md) を参照します。

## ロールバック

直前に検証済みのcommitへデプロイを戻し、DB migrationの逆戻しは自動実行しません。停止時はWeb/APIの公開導線、専用Hyperdrive、専用PlanetScaleの順に扱い、他製品のWorkerやDBを変更しません。共有デモ環境は冪等seedで初期状態を補い、DB全体のdrop/resetはしません。
