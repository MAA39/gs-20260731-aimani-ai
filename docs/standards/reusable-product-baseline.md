# 再利用可能なプロダクト基準

基準日: 2026-07-26  
ステータス: Amidala v2 で検証する初版

## 目的

この文書は、今後の新規プロダクトを同じ叩き台から始めるための最小基準である。金融系のような最大限の統制を目標にせず、ブラウザで価値を触れるまでの速度と、後から拡張できる境界を両立する。

## 共通として再利用する判断

### プロダクト開発

- 最初の成功条件は、主要な一連の操作をブラウザで完了できること。
- テスト数やカバレッジを成果にしない。最重要動線、越境、壊れやすい状態遷移だけを守る。
- 空、待機、失敗、成功を仕様として画面に出す。
- UI の語彙はユーザーが認識する言葉に揃え、内部実装語を表示しない。
- 既存製品を移植するときは「そのまま継承」「再解釈」「不採用」に分類する。
- 各スライスの直前にサブエージェントで公式一次資料を調査し、現行versionのpracticesをbriefへ反映する。
- 調査は実装を遅らせる網羅研究にせず、今回使う/使わないprimitiveを決めたら画面実装へ進む。

### アーキテクチャ

- Web は画面と BFF の責務を持ち、DB へ直接接続しない。
- API は認証、認可、ユースケース、永続化を所有する。
- Router 依存は `routes`、ドメイン能力は `features` / `modules` に置く。
- DI コンテナは Composition Root に閉じ込め、ドメインコードへ持ち込まない。
- DDD / CQRS は境界を理解しやすくする分だけ使う。全面的な Event Sourcing は初期採用しない。
- 外部公開が必要になった Webhook は独立 Worker に分離できる契約を保つが、必要になるまで作らない。

### データ

- Account は人のグローバルな認証主体、Organization は所属先、Membership は両者の関係とする。
- 業務データは Organization でスコープする。
- FK、UNIQUE、CHECK と短いトランザクションを基本にする。
- RLS、監査基盤、outbox、Queue は必要性が実証されてから追加する。
- URL と API 入力を schema で検証し、画面状態は可能な限り URL に表す。

### デザイン

- 8px の余白リズムを基本にする。
- 色だけで状態を表さず、ラベルまたはアイコンを併用する。
- キーボードフォーカス、44px 前後の操作面、`prefers-reduced-motion` を最初から守る。
- headless component を使い、プロダクト固有の見た目は自分たちで所有する。
- Storybook や大規模デザインシステムを先に作らない。実画面で繰り返し現れた部品から抽出する。

## Amidala 固有であり、他製品では決め直す判断

- People をホームにし、人との関係から Todo と Handoff に入る情報設計
- `relationship rail` を使った責任の受け渡し表現
- Amidala の indigo を引き継ぐ色調
- Handoff の承認で Todo の担当者を変更する状態遷移
- Cloudflare の Web Worker / private API Worker 二層構成
- PostgreSQL 接続先の具体的なサービスとリージョン

## 初期品質予算

初期スライスで必須にするテストは次の四つだけとする。

1. DI Composition Root の smoke test
2. Handoff の happy path
3. 他 Organization からの操作拒否
4. Login → People → Todo → Handoff → Accept の Playwright E2E

追加テストは、実際に見つかった不具合または次のスライスのリスクを根拠に増やす。
