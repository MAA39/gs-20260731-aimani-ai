# アイマニAI Documentation

このディレクトリには、公開デモに至るまでの**設計・検証履歴**も含まれます。内部handoffやresearchは判断の根拠として削除せず、公開時点の運用に合わせて参照してください。

基準日: 2026-08-01
対象: アイマニAI と、同じ構成で立ち上げる今後のプロダクト

## この Docs の役割

このディレクトリは、会話で決まったこと、既存プロダクトから得た知見、各資料の確認日時点の技術調査を分けて保存する。現在の判断の正本は、現行ADR、ロードマップ、capabilityカタログである。古いplan、research、handoffは根拠と履歴であり、現在の指示ではない。

新しいプロダクトでは、まず「共通として再利用できる判断」をコピーし、プロダクト固有の部分だけを書き換える。既存 Aimani AI、BYARD の実装は根拠資料であり、そのまま移植する正本ではない。

## 最初に読む順番

1. [段階的進化ロードマップ](architecture/evolution-roadmap.md)
2. [将来 capability カタログ](architecture/deferred-capability-catalog.md)
3. [ADR-0002 段階的な製品・プラットフォーム進化](decisions/0002-staged-product-and-platform-evolution.md)
4. [公開デモ運用](product/public-demo.md)
5. [再利用可能なプロダクト基準](standards/reusable-product-baseline.md)
6. [実装前 Research Gate](standards/research-before-build.md)
7. [React 19 / TanStack 実装プラクティス](standards/react-tanstack-practices.md)
8. [Domain Language / 命名基準](standards/domain-language-and-naming.md)
9. [技術選定記録](decisions/0001-technology-selection-2026-07-26.md)
10. [Auth / PostgreSQL / DI Research Gate](research/2026-07-26-auth-postgres-di.md)
11. [既存プロダクト UX 監査](product/legacy-ux-audit.md)
12. [デザイン基盤](design/foundation.md)
13. [Aimani AI UX-first プラットフォーム設計](superpowers/specs/2026-07-26-aimani-ai-platform-design.md)

縦切りの詳細設計と実装履歴は `superpowers/specs/` と `superpowers/plans/` に残している。現在の作業順は古いplanではなく、上記ロードマップとADRを正本にする。

`HANDOFF-CLAUDE-*`は担当移管時点の履歴資料として残している。現在の作業再開にはロードマップを使い、当時の未完了事項や環境を確認する場合だけHandoffを参照する。

## ローカル起動

画面とUXを最短で確認するだけなら、DBを準備せず[公開デモ](product/public-demo.md)を使う。

ローカルではmock経路ではなく、Web Worker → auxiliary Hono API Worker → PostgreSQLの製品経路を確認する。そのため次の準備が必要になる。

```text
pnpm db:up
cp apps/api/.dev.vars.example apps/api/.dev.vars  # 初回だけ
pnpm db:demo:reset
pnpm dev
```

公開デモの案内は [公開デモ](product/public-demo.md)、公開・更新手順は [deployment](operations/deployment.md) を参照してください。

既存の `apps/api/.dev.vars` を利用している場合は、`DATABASE_URL` のデータベース名を `aimani_ai_demo` に変更する。資格情報はこのDocsへ追加しない。

### 開発用 Demo Actor Switch

ローカル開発時に田中 彩／森 ハルを切り替える場合は、初回のみ次の手順でignoredな環境ファイルを作成する。

```bash
cp apps/web/.env.development.local.example apps/web/.env.development.local
```

`apps/web/.env.development.local` の `VITE_DEMO_ACTOR_PASSWORD` に、開発用seedで使用するローカルseed passwordを設定する。この値はGitへコミットせず、Docsやexampleにも記載しない。設定後に `pnpm dev` を起動すると、development buildでのみActor Switchが表示される。

## 判断の優先順位

矛盾した場合は次の順に扱う。

1. 現在ユーザーが触って確認できる体験
2. 現行ADR、ロードマップ、capabilityカタログ
3. 各調査資料の確認日と、導入直前に再確認した公式一次情報
4. 既存 Aimani AI / BYARD の実装と Docs
5. 推測

既存コードと既存 Docs が食い違う場合は、両方を根拠として記録し、新規側では意図を明示して決め直す。

## 更新ルール

- 技術の採用・撤回は `decisions/` に理由と日付を残す。
- UX を既存製品から移植した場合は `product/legacy-ux-audit.md` の分類を更新する。
- 色、文字、余白、状態表現はまず実画面で検証し、再利用する判断になった時に同じPRまたは直後で `design/foundation.md` へ反映する。
- 共通基準と Aimani AI 固有判断を混ぜない。
- 変動領域、未知library、課金、不可逆な判断に該当する実装スライスだけResearch Gateを通し、公式知見をtask briefへ反映する。
- Docs の完全性より、触れるプロダクトとの一致を優先する。
- 過去に検討・実装した機能を「不要」で一括削除せず、導入トリガーと状態を `architecture/deferred-capability-catalog.md` に残す。
- build種別と製品モードを混同しない。DB/API版の再開前に明示的な `demo|product` modeへ移行する。
