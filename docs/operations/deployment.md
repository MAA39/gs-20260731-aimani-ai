# デプロイメント運用

公開URLはデプロイ完了後にこの文書へ追記します。未確定URLをREADMEやこの文書に先に書かない方針です。

## 専用資産名

- GitHub repository: `MAA39/gs-20260731-aimani-ai`
- Supabase project: `gs-20260731-aimani-ai`（専用PostgreSQL）
- Hyperdrive: `gs-20260731-aimani-ai-db`（caching disabled）
- Workers: `gs-20260731-aimani-ai-api` / `gs-20260731-aimani-ai-web`
- bindings: API / `HYPERDRIVE`
- ローカルデモDB: `aimani_ai_demo`（公開環境と共有しない）

公開環境では認証secret、DATABASE_URLなどをホスティング基盤のsecret storeへ登録し、リポジトリやDocsへ値を書き込みません。

## 作成順序

1. GitHub repositoryとbranch protectionを用意する
2. Supabase project `gs-20260731-aimani-ai`（専用PostgreSQL）を作成する
3. migrationを適用し、公開デモ用seedを投入する
4. Hyperdrive `gs-20260731-aimani-ai-db` を caching disabled で作成する
5. API secretsを登録し、`gs-20260731-aimani-ai-api` Workerをデプロイする
6. WebのService Bindingを設定し、`gs-20260731-aimani-ai-web` Workerをデプロイする
7. ログイン、Today、Todo、Handoff、Team Work、Process Labの導線を確認する
8. 実際の公開URLをこの文書とREADMEへ追記する

## ロールバック

直前に検証済みのcommitへデプロイを戻し、DB migrationの逆戻しは自動実行しません。アプリを先に互換性のあるcommitへ戻し、必要ならバックアップから専用DBを復元します。共有デモ環境はデータリセットで初期seedへ戻し、secret値は漏えいの疑いがあれば即時ローテーションします。
