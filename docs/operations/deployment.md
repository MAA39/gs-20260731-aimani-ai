# デプロイメント運用

公開URLはTask 4のデプロイ完了後にこの文書へ追記します。未確定URLをREADMEやこの文書に先に書かない方針です。

## 専用資産名

- GitHub repository: `MAA39/gs-20260731-aimani-ai`
- application name: `gs-20260731-aimani-ai`
- 公開環境用データベース: `aimani-ai-public`（専用PostgreSQL）
- ローカルデモDB: `aimani_ai_demo`（公開環境と共有しない）

公開環境では認証secret、DATABASE_URLなどをホスティング基盤のsecret storeへ登録し、リポジトリやDocsへ値を書き込みません。

## 作成順序

1. GitHub repositoryとbranch protectionを用意する
2. 公開環境専用PostgreSQLと接続情報を作成する
3. migrationを適用し、公開デモ用seedを投入する
4. Web/APIの環境変数とsecretを登録する
5. CIのgreenを確認してWeb/APIをデプロイする
6. ログイン、Today、Todo、Handoff、Team Work、Process Labの導線を確認する
7. 実際の公開URLをこの文書とREADMEへ追記する

## ロールバック

直前に検証済みのcommitへデプロイを戻し、DB migrationの逆戻しは自動実行しません。アプリを先に互換性のあるcommitへ戻し、必要ならバックアップから専用DBを復元します。共有デモ環境はデータリセットで初期seedへ戻し、secret値は漏えいの疑いがあれば即時ローテーションします。
