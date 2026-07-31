# 実装前 Research Gate

基準日: 2026-07-26
適用範囲: Aimani AI v2 と、この Docs を叩き台にする全プロダクト

## 目的

モデルの記憶や、過去に一般的だった書き方だけで実装を始めない。各スライスの直前に、使う技術の現行公式資料、固定 version、対象 runtime を確認し、得たプラクティスを実装 brief へ反映する。

この gate は調査やテストを目的化するものではない。古い API、不要な抽象、すでに非推奨の pattern を避け、ユーザーが触れるプロダクトへ最短で到達するために行う。

## 1スライスの進め方

```text
ユーザー体験と実装対象を1つに絞る
  -> 調査エージェントが公式一次資料を確認
  -> 実装で使う / 使わない / 後回しを短く決める
  -> task briefへ反映
  -> 実装
  -> build + 対象体験の手動確認
  -> 必要最小限のテスト
  -> 発見した知見をDocsへ戻す
```

## Research brief の必須項目

実装前に、サブエージェントへ次を渡す。

1. 今回ユーザーが画面で完了する操作
2. 変更対象の package / runtime / version
3. 調べる API と、避けたい既知 pattern
4. 参照する公式 source の優先順位
5. 現行コードを読み取り監査する範囲
6. 返してほしい形式: `MUST / SHOULD / AVOID / 今回使う / 今回使わない`

## 情報源の優先順位

1. 対象 version の公式 documentation
2. 公式 repository、release、migration guide、security advisory
3. runtime/provider の公式 documentation
4. 標準仕様、一次論文
5. 信頼できる二次資料
6. 推論

二次資料と推論は、公式の事実と区別して記録する。最新 version を使うこと自体を目的にせず、採用 version と runtime の組み合わせで実際に build/dev が成立するかを確認する。

## 実装へ進める条件

- 今回の目的に対して、どの primitive / API を使うか決まっている。
- よくある古い pattern と、今回それを避ける方法が分かっている。
- server/client、request/tenant、public/private の境界が分かっている。
- package version と runtime compatibility が確認できている。
- 未確定事項が、画面を触るための blocker か後回しにできるか分類されている。

## テストとの関係

Research Gate は test case を大量に増やす gate ではない。

- 調査で判明した最重要リスクだけ、既存の品質予算内でテストする。
- UI の細かな分岐は、まず実ブラウザで確認する。
- version/runtime compatibility は build、local dev、dry-run で確認する。
- バグが一度起きた箇所は、再発防止の小さなテストを追加する。

## Docs への戻し方

- 他製品でも使える: `docs/standards/`
- 技術選定の変更: `docs/decisions/`
- Aimani AI固有の画面/ドメイン: `docs/product/` または platform spec
- 一時的な調査で、実装判断を変えない: task report のみに残す

## 禁止する進め方

- package 名だけ決め、公式の現行 API を確認せず実装する。
- sample code を version/runtime を見ずに貼る。
- `useEffect`、global store、DI、cache、Queue などを「一般に便利」という理由だけで入れる。
- 調査の不安を、網羅的 test や抽象 layer の追加で埋める。
- 調査だけを続け、ブラウザで触れる slice を完成させない。

