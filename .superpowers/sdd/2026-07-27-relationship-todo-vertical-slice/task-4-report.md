# Task 4 report: SharedTodo journey verification

## Fresh environment

- Disposable PostgreSQL cluster recreated, migrated, and seeded on `127.0.0.1:54329`.
- Local machine provides PostgreSQL 14.17; canonical Compose/production contract remains PostgreSQL 17.
- One `pnpm dev` entrypoint served Web and private API binding.

## Browser evidence

- owner: Acme → Sato → create Todo assigned to Sato → list shows creator `田中 彩` and assignee `佐藤 花子`.
- direct URL reload preserved the Todo.
- Northstar / Suzuki did not contain the Acme Todo.
- Sato session saw the same symmetric pair Todo from the owner context.
- Sato direct Northstar access rendered forbidden recovery and no composer.
- 390×844: Sato created a self-assigned Todo; list showed creator/assignee `佐藤 花子`.
- mobile `scrollWidth === clientWidth`; assignee controls 44px+, submit 50px+, bottom navigation 59px+.
- fresh browser tabs reported zero warning/error logs.

## Command evidence

```text
API unit: 1 file / 2 tests passed
API integration: 2 files / 2 tests passed
Web TypeScript: passed
pnpm build --force: 3 tasks successful, 0 cached
API wrangler 4.114.0 dry-run: passed
Web wrangler 4.114.0 dry-run: passed, generated config warning removed
git diff --check: passed
```

## Reusable corrections

- A path route with children must render `Outlet`; keep the People list in an exact index child.
- SSR date formatting must specify `Asia/Tokyo` rather than inheriting runtime timezone.
- Pin deployment CLI per workspace; a transitive Wrangler version produced a false generated-config warning.
