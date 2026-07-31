# アイマニAI

アイマニAI（Aimani AI）は、チームの仕事について「誰の作業がどこで止まっているかを見て、引き継ぐ」ためのワークスペースです。担当者・作業・引き継ぎの状態を同じ画面で確認し、次にボールを持つ人へ責任を移せます。

## できること

- Today: 自分への依頼、手元の作業、確認待ち、最近動いたボールを確認
- Todo: 作業を作成・担当し、完了または引き継ぎを依頼
- Handoff: 依頼者と受領者を明示し、受け入れ時に「次の一手」を残す
- Team Work: 組織全体の担当者・状態・次の行動を俯瞰
- People: 人と関係性を起点に共有された作業を確認
- Process Lab: 工程をノードと依存関係で試す、後で削除できる試験機能

## アーキテクチャ

```text
TanStack Start Web Worker --Service Binding/RPC--> Hono API Worker --Hyperdrive--> 専用PlanetScale Postgres
             ↘ shared contracts / API client
```

WebのServer Functionが認証cookieをAPIへ転送し、APIのapplication/domain層とPostgreSQLを通して組織境界・責任移管を検証します。データモデルとAPI契約は `packages/contracts`、DBスキーマは `packages/db` にあります。

## ローカルで起動

必要環境: Node.js 24、pnpm 11.17.0、Docker（PostgreSQL用）。

```bash
pnpm install
pnpm db:up
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm db:demo:reset
pnpm dev
```

ブラウザで `http://localhost:5173` を開きます。デモDBを最初の状態へ戻すときは `pnpm db:demo:reset` を実行してください。

## 公開デモ

公開デモは共有デモ専用環境です。seedのownerアカウントを使います。

```text
メールアドレス: owner@aimani-ai.local
パスワード: aimani-ai-demo-2026
```

この資格情報とデータは機密ではなく、共有デモを触るための固定値です。個人情報や本番データを入力せず、デモ環境はリセットされる前提で利用してください。本番運用の認証情報として再利用しないでください。

Process Lab は仮説検証のための試験機能であり、後で削除できる扱いです。公開URLはデプロイ完了後に deployment docs へ追記します。

## 開発者向け検証

```bash
pnpm --filter @aimani-ai/api test
pnpm --filter @aimani-ai/web test
pnpm --filter @aimani-ai/db test
pnpm build
```

CIでも同じAPI単体テスト、Webテスト、buildを実行します。DB統合テストは専用DBを準備できる環境で別途実行してください。

## ライセンス

MIT License（[LICENSE](LICENSE)）
