# ADR-0002: プロダクト価値とプラットフォーム能力を段階的に有効化する

日付: 2026-08-01
ステータス: 採用
対象: アイマニAI、および同構成を参照する次のプロダクト

## コンテキスト

アイマニAIでは、TanStack Start、private Hono API Worker、Better Auth、Awilix、Drizzle、PostgreSQL、Hyperdriveを使う製品アーキテクチャを設計し、その大部分をローカル実装した。一方、短期間で外部から触れるデモを出す目的に対し、クラウドDBの契約、認証、複数Workerの公開、運用安全性を同時に完了しようとして時間を使った。

その後、公開デモはTanStack Start Web Workerとserver-only mock APIだけで提供した。これにより主要UXは触れるようになったが、元の技術を「不要だった」と扱うと、将来の永続化・実ユーザー・複数組織・Webhookや、次製品で再利用できる調査知見まで失う。

また、現在のコードは`import.meta.env.PROD`を「公開デモではmockを使う」という意味にも使っており、build種別とproduct modeが混在している。

## 決定

1. 現在の公開デモは、DBなし・ログインなし・Web Worker単独のまま維持する。
2. PostgreSQL、Drizzle、Better Auth、Hono API Worker、Service Binding、Hyperdrive、Awilix、複数組織、Process Lab永続化、調査・Docs・レビュー・テスト資産は**不採用にしない**。導入トリガー待ちのcapabilityとして保存する。
3. capabilityを無関係に一括導入しない。利用者価値を一つ増やすために依存する最小capability bundleを、一つのvertical sliceとして有効化する。
4. 現在の実行経路と将来到達点は、[段階的進化ロードマップ](../architecture/evolution-roadmap.md)で分けて管理する。
5. 各capabilityの目的、状態、トリガー、前提、最小検証、参照資料は[将来 capability カタログ](../architecture/deferred-capability-catalog.md)で管理する。
6. DB/API版へ戻す前に、`PROD`判定をやめ、`demo|product`を表す明示的runtime modeとComposition Rootでadapterを選ぶ。product modeの設定不足時はmockへfallbackせず停止する。
7. 調査・Docs・レビュー・テストには実施トリガーと時間上限を設け、触れるvertical sliceを先にする。coverage率は完了条件にしない。

## 導入順

標準順序は次とする。

1. DBなしの3分デモで、Today / Handoff / Team Workの価値を確認する。
2. 閲覧者ごとのstateを分離し、受領判断からToday / Team Workへの反映まで完結する3分Handoffを作る。Demo Actorはその実現手段の一候補とする。
3. local PostgreSQL / Drizzle / application use case / Better Authの縦切りを確認する。
4. 専用PostgreSQL、role分離、seed guard、Hyperdriveを準備する。
5. アイマニAIではprivate Hono API WorkerとService Bindingを公開経路で有効化する。次製品で分離理由も既存実装もない場合は、単一TanStack Start Workerから始めてよい。
6. 実利用で必要になった時だけ複数組織、Hono RPC、Webhook、Process Lab正式化を進める。

既に実装済みのコードがある場合も、この順序は「書く順」ではなく「公開経路で有効化し、検証する順」として扱う。

## 文書の所有関係

- ADRは決定時点の記録として原則不変とし、後続判断へのリンクだけを追記する。
- ロードマップは現在Stage、Stageの順序、到達条件を所有する。
- capabilityカタログは各項目の実装状態、導入トリガー、参照資料を所有する。
- spec、plan、research、handoffは詳細と履歴を所有し、現在地の正本にはしない。

## 結果

### 良い結果

- 現在の触れるデモを壊さず、過去の実装と調査を将来利用できる。
- 技術選定を「採用/不採用」の二択ではなく、価値に応じた導入時期として判断できる。
- 次製品は同じ調査を繰り返さず、必要なStageだけを選べる。
- 外部DBやCloudflare資産を、費用・責任者・削除方法が決まる前に作らずに済む。

### 受け入れるコスト

- mock経路と製品経路の二つを、明確なmodeと境界で保守する必要がある。
- 実装済みでも未有効なコードがあり、README/ADRで現在地を示し続ける必要がある。
- 外部仕様は調査時点から変わるため、導入直前の再確認が必要になる。

## 再評価トリガー

- 公開デモが継続利用され、データ消失が価値検証を妨げる。
- 実ユーザー、個人データ、複数組織、Webhookの要件が確定する。
- 未有効コードの保守コストが、将来再利用価値を明確に上回る。
- 単一TanStack Start Workerだけで本番要件を十分満たし、API Worker分離の理由が消える。
- PlanetScale以外のPostgreSQL providerが、導入時点で費用・リージョン・運用上明確に優れる。

## 関連判断

- [ADR-0001 技術選定](0001-technology-selection-2026-07-26.md)
- [再利用可能なプロダクト基準](../standards/reusable-product-baseline.md)
- [公開デモ運用](../product/public-demo.md)
- [デプロイメント運用](../operations/deployment.md)
