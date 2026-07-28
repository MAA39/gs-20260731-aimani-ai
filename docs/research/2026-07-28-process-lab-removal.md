# 工程ラボの削除手順

## 目的

`工程ラボ` は BYARD の工程管理UIを Amidala の責任移動モデルへ取り込めるか確かめる実験機能である。実験結果が悪い場合に、既存の People / Todo / Handoff / Team Work を壊さず撤去できるよう、所有ファイルと統合点をここに固定する。

## 機能が所有するもの

- URL: `/$organizationId/process-lab`
- UI名: `工程ラボ`
- API: `/organizations/:organizationId/process-lab/**`
- DB集約: `ProcessBoard` / `ProcessStep` / `StepDependency` / `ProcessStepLayout`
- npm依存: `@xyflow/react@12.11.2`
- demo board: `process-lab-acme-product-launch`

## そのまま削除できるディレクトリとファイル

- `apps/api/src/features/process-lab/`
- `apps/web/src/features/process-lab/`
- `apps/web/src/routes/$organizationId/process-lab.tsx`
- `packages/contracts/src/process-lab.ts`
- `packages/db/src/schema/process-lab.ts`
- `docs/superpowers/specs/2026-07-28-process-lab-design.md`
- `docs/superpowers/plans/2026-07-28-process-lab.md`
- この文書

## 既存ファイルにある統合点

撤去時は次の参照も同じ変更で外す。

1. `packages/contracts/src/index.ts`
   - `./process-lab.js` のexport
2. `packages/db/src/schema/index.ts`
   - `./process-lab.js` のexport
3. `apps/api/src/composition/request-scope.ts`
   - `ProcessLabRepository` / `ProcessLabService` import
   - `RequestCradle` の2型
   - `processLabRepository` / `processLabService` の登録
4. `apps/api/src/app.ts`
   - `createProcessLabRoutes` importとmount
5. `apps/api/src/dev/seed-development-data.ts`
   - `process-lab-acme-product-launch` 以降のboard / step / layout / dependency seed
6. `apps/api/src/dev/demo-seed.integration.test.ts`
   - Process Lab seedの検証ケース
7. `apps/web/src/routes/__root.tsx`
   - `工程ラボ` のpage title判定
   - `process-lab` のorganization route判定
8. `apps/web/src/features/work/TeamWorkPage.tsx`
   - `工程のつながりを試す` の文脈リンク
9. `apps/web/src/styles.css`
   - `.process-lab-discovery` のスタイル
10. `apps/web/src/routeTree.gen.ts`
    - routeファイル削除後にVite/TanStack Routerで再生成する。手編集しない。
11. `apps/web/package.json` / `pnpm-lock.yaml`
    - 他機能が利用していなければ `pnpm --filter @amidala/web remove @xyflow/react` を実行する。

## PostgreSQL migration

まだ共有環境へ適用していない間は、実験ブランチと一緒に `packages/db/drizzle/0005_process_lab.sql` と対応snapshot / journal entryを取り除ける。

一度でも共有環境へ適用した後は、過去migrationを編集・削除しない。次の新しいforward migrationで、依存順に以下をdropする。

1. `process_lab_step_layout`
2. `process_lab_dependency`
3. `process_lab_step`
4. `process_lab_board`

組織、membership、Todo、Handoffのテーブルには触れない。

## 削除後の確認

```bash
rg -n "process-lab|ProcessLab|processLab|process_lab" apps packages
pnpm --filter @amidala/api test
pnpm --filter @amidala/web test
pnpm build
```

検索結果が0件で、テストとbuildが成功すればコード上の撤去は完了である。共有DBへ適用済みの場合は、新しいdrop migrationの適用結果も別途確認する。

## 技術選定の撤去判断

`@xyflow/react` を選んだ理由は、React 19と共存できるv12系で、custom node、Handle、接続検証、keyboard / ARIA、座標保存を一つの依存で満たすためである。ELK / Dagre / Cytoscapeは、6工程の実験に対して依存と抽象化が増えるため導入していない。

工程数が増えて手動配置では理解できなくなったと実利用で確認できた時だけ、自動layoutライブラリを再評価する。先回りで追加しない。
