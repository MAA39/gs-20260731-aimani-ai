# Task 5 検証レポート

Status: DONE_WITH_CONCERNS
Date: 2026-07-28

## 実測

- API DB-free tests: `pnpm --filter @amidala/api test -- --run` — 2 files / 13 tests PASS。
- Web tests: `pnpm --filter @amidala/web test` — 7 tests PASS。
- Build: `pnpm build` — turbo 3 tasks PASS。
- Diff check: `git diff --check` — exit 0。
- Demo reset: `pnpm db:demo:reset` — `amidala_demo` reset complete。
- Demo story integration: `TEST_DATABASE_URL=...amidala_demo pnpm --filter @amidala/api test:demo -- --run` — 1 file / 1 test PASS（demo専用config）。通常integration configから`src/dev/**`を除外。
- SSR curl: `/` は 307 redirect (`location: /organizations`)、legacy entry marker 0件。`/login` は 200 full document (`<!DOCTYPE html><html lang="ja">`)。

## Concern / pending

既存の in-app local tab を claim → reload し `dev.logs` (error/warn) が空であることは観測したが、DOM snapshot は `Browser Use rejected this action ... localhost URL blocked by Browser use URL policy` と拒否された。迂回は禁止し、fresh navigation/direct reload における browser console 全体の warning/error 0件は証明できないため、browser 確認を必須 pending とする。curl と production build の証跡は取得済み。
