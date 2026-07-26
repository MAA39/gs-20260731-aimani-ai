# Amidala v2 Documentation

基準日: 2026-07-26  
対象: Amidala v2 と、同じ構成で立ち上げる今後のプロダクト

## この Docs の役割

このディレクトリは、会話で決まったこと、既存プロダクトから得た知見、2026-07-26 時点の技術調査を分けて保存する正本である。

新しいプロダクトでは、まず「共通として再利用できる判断」をコピーし、プロダクト固有の部分だけを書き換える。既存 Amidala、BYARD の実装は根拠資料であり、そのまま移植する正本ではない。

## 最初に読む順番

1. [再利用可能なプロダクト基準](standards/reusable-product-baseline.md)
2. [実装前 Research Gate](standards/research-before-build.md)
3. [React 19 / TanStack 実装プラクティス](standards/react-tanstack-practices.md)
4. [技術選定記録](decisions/0001-technology-selection-2026-07-26.md)
5. [既存プロダクト UX 監査](product/legacy-ux-audit.md)
6. [デザイン基盤](design/foundation.md)
7. [Amidala v2 UX-first プラットフォーム設計](superpowers/specs/2026-07-26-amidala-v2-platform-design.md)
8. [Touchable MVP 実装計画](superpowers/plans/2026-07-26-platform-todo-handoff.md)

## 判断の優先順位

矛盾した場合は次の順に扱う。

1. 現在ユーザーが触って確認できる体験
2. この Docs の確定事項
3. 2026-07-26 時点の公式ドキュメント
4. 既存 Amidala / BYARD の実装と Docs
5. 推測

既存コードと既存 Docs が食い違う場合は、両方を根拠として記録し、新規側では意図を明示して決め直す。

## 更新ルール

- 技術の採用・撤回は `decisions/` に理由と日付を残す。
- UX を既存製品から移植した場合は `product/legacy-ux-audit.md` の分類を更新する。
- 色、文字、余白、状態表現の変更は `design/foundation.md` を先に更新する。
- 共通基準と Amidala 固有判断を混ぜない。
- 各実装スライスの前にResearch Gateを通し、公式知見をtask briefへ反映する。
- Docs の完全性より、触れるプロダクトとの一致を優先する。
