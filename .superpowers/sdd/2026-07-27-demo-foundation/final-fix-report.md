# Task 5 final fix report

Date: 2026-07-28
Status: DONE_WITH_CONCERNS

## Changes

- Added `apps/api/vitest.demo.config.ts` with required exact local `amidala_demo` URL assertion and demo-seed-only inclusion.
- Added API `test:demo` script targeting the dedicated config.
- Excluded `src/dev/**` from the normal integration config so demo tests cannot contaminate the handoff suite.
- Updated Task 5 plan/report commands and evidence to use `test:demo`.

## Verification

- `pnpm db:demo:reset`: PASS.
- `TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo pnpm --filter @amidala/api test:demo -- --run`: 1 file / 1 test PASS.
- Normal integration config excludes `src/dev/**` (no demo collection).
- API build: PASS.
- `git diff --check`: PASS.

Browser fresh navigation/direct reload console全体確認はlocalhost URL policy拒否のためpending。
