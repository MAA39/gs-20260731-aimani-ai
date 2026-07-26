# Amidala v2 Touchable MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a working Login → People → Todo → Handoff → Accept/Reject experience in the browser as quickly as possible while preserving User/Organization separation and Awilix DI.

**Architecture:** TanStack Start is the public Web/BFF Worker and calls a private Hono API Worker through a Service Binding and Hono RPC. The API owns Better Auth, Awilix request scopes, Drizzle, and PostgreSQL; the initial product uses simple application authorization and basic DB constraints rather than production-hardening every boundary.

**Tech Stack:** pnpm, TypeScript, TanStack Start, TanStack Query/Form, Tailwind CSS, Base UI, Hono RPC, Better Auth, Awilix, Drizzle ORM, PostgreSQL, Cloudflare Workers/Hyperdrive, Vitest, Playwright.

**Canonical Docs:** Read `docs/README.md` first. Exact versions and rationale live in `docs/decisions/0001-technology-selection-2026-07-26.md`; UX evidence and visual rules live in `docs/product/legacy-ux-audit.md` and `docs/design/foundation.md`.

## Global Constraints

- Modify only `/Users/maa/Projects/gs/000_参照用/amidala-v2`.
- Before every task, dispatch a read-only research agent using `docs/standards/research-before-build.md`; update the task brief from current official practices before implementation.
- Optimize for a touchable browser experience; do not add coverage thresholds, exhaustive state tests, RLS, outbox, Queue, Webhook Worker, generic component frameworks, or speculative abstractions.
- Keep User independent from Organization and connect them through Membership. Reserve Better Auth `Account` for credentials.
- Use Awilix only in the API Composition Root; domain/application code remains container-independent.
- Web imports contracts/api-client only and never accesses PostgreSQL directly.
- API queries always include the Principal's `organizationId`.
- Follow the `relationship rail`, color, typography, copy, responsive, and accessibility rules in `docs/design/foundation.md`; do not substitute a generic dashboard template.
- Add only four tests initially: DI smoke, Handoff happy path, cross-tenant API rejection, and one browser E2E.
- Do not create external Cloudflare/PlanetScale resources until local Milestone 3 works and the user approves preview deployment.

---

### Task 1: Browser-visible monorepo skeleton

**Files:**
- Create: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/wrangler.jsonc`
- Create: `apps/web/src/router.tsx`, `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/index.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/api/package.json`, `apps/api/wrangler.jsonc`, `apps/api/src/app.ts`, `apps/api/src/worker.ts`
- Create: `packages/contracts/package.json`, `packages/api-client/package.json`

**Produces:** `pnpm dev` opens an Amidala v2 shell and the API `/health` returns `{ "ok": true }`.

- [x] Audit the shell against current React 19, TanStack Start, and Cloudflare practices; record the rules in `docs/standards/react-tanstack-practices.md`.
- [x] Pin the exact versions in ADR-0001 and install the workspace; TypeScript 7 / Worker build compatibility is verified.
- [x] Configure TanStack Start with the Cloudflare Vite plugin and Tailwind CSS.
- [x] Build the documented app shell: desktop left navigation and mobile bottom navigation for `People`, `Todos`, and `引き継ぎ`.
- [x] Add the home thesis「関係性から仕事を進める」and a People-first next action rather than a metric dashboard.
- [x] Implement the design tokens and typography from `docs/design/foundation.md`; add visible keyboard focus and reduced-motion defaults.
- [x] Add Hono `/health` and Web Worker Service Binding `API`.
- [x] Run `pnpm dev` and verify the desktop shell at 1280px and mobile bottom navigation at 390px in the in-app browser without horizontal overflow.
- [x] Run `pnpm build` and commit `feat: add touchable Amidala v2 shell`.

### Task 2: Local PostgreSQL, Drizzle, and Awilix Composition Root

**Files:**
- Create: `compose.yaml`
- Create: `packages/db/src/schema.ts`, `packages/db/src/client.ts`, `packages/db/drizzle.config.ts`
- Create: `apps/api/src/composition/root-container.ts`, `apps/api/src/composition/request-scope.ts`
- Create: `apps/api/src/composition/composition-root.test.ts`

**Produces:** API requests resolve a request-scoped DB/repository graph through Awilix and close the DB Client afterward.

**Status (2026-07-27):** DB・認証に先行し、Awilixのroot container、request scope、正常/例外時disposeの基盤は[DI専用計画](./2026-07-26-api-request-scoped-di.md)で実装・検証済み。以下はPostgreSQL / Drizzle / repositoryとの接続だけを残件とする。

DB / Auth / Peopleは水平分割せず、[Identity → People縦切り計画](./2026-07-27-identity-people-vertical-slice.md)でブラウザまで一本通す。この実装中はTask 2〜4の重複項目を別々に着手しない。

- [x] Research current Drizzle/PostgreSQL/Hyperdrive/Awilix Workers practices and record the decisions in `docs/research/2026-07-26-auth-postgres-di.md`.
- [x] Add local PostgreSQL 17 with one documented `DATABASE_URL` in `.dev.vars.example`.
- [x] Add only the identity slice tables first: Better Auth core tables, organizations, memberships, relationships. Add todos/handoffs in their own slice.
- [x] Use FK, UNIQUE, CHECK, and `organization_id`; do not add RLS or audit tables.
- [x] Configure an Awilix root with a stateless Clock and create/dispose one child scope per request.
- [x] Add IdGenerator to the root and register DB/repositories in the request scope after PostgreSQL is introduced.
- [x] Add one smoke test that resolves the main use-case factory and confirms disposal closes its fake DB Client.
- [x] Run the migration, `/health`, and the DI smoke test.
- [x] Commit the PostgreSQL and request-scoped DI slice.

### Task 3: Login and organization context

**Files:**
- Create: `apps/api/src/auth/create-auth.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/session.ts`
- Create: `packages/modules/identity/src/index.ts`
- Create: `apps/web/src/server.ts`, `apps/web/src/routes/login.tsx`, `apps/web/src/routes/_authed.tsx`
- Create: `apps/web/src/features/auth/LoginForm.tsx`
- Create: `apps/web/src/routes/_authed/organizations.tsx`

**Produces:** A user can sign up/sign in, create or select an Organization, and enter the authenticated app.

- [x] Research current Better Auth/Hono/Workers cookie, CSRF, session, and React 19 form practices and add them to this task brief.
- [x] Configure Better Auth core with email/password and the canonical User/Account model names; do not add Organization Plugin.
- [ ] Proxy `/api/auth/*` through the Web Worker so cookies remain same-origin.
- [ ] Add `createOrganization` that inserts Organization and owner Membership without modifying User or credential Account.
- [x] Seed a second demo User and Membership for relationship/Handoff testing.
- [x] Build Login and Organization selection screens with pending/error states.
- [x] Manually verify one User can belong to two Organizations.
- [x] Commit the global accounts and Organization login slice.

### Task 4: People and Relationship experience

**Files:**
- Create: `packages/modules/relationship/src/index.ts`
- Create: `apps/api/src/routes/relationships.ts`
- Create: `packages/contracts/src/relationship.ts`
- Create: `apps/web/src/routes/_authed/$organizationId/people/index.tsx`
- Create: `apps/web/src/routes/_authed/$organizationId/people/$membershipId.tsx`
- Create: `apps/web/src/features/people/PersonCard.tsx`

**Produces:** People shows organization members and their relationship to the signed-in user; a person detail page becomes the entry to their shared work.

**Status (2026-07-27):** [Identity → People縦切り](./2026-07-27-identity-people-vertical-slice.md)と[Person SharedTodo縦切り](./2026-07-27-relationship-todo-vertical-slice.md)で実装・実ブラウザ検証済み。open Todo countは実データの一覧が成立した後の判断として、このsliceでは意図的に表示していない。

- [x] Research current Router loader/search/prefetch and accessible People-list patterns; add the selected primitives to this task brief.
- [x] Seed manager/report and peer Relationships for demo users.
- [x] Add `GET /organizations/:id/people` and person detail queries scoped by Principal organization.
- [ ] Build a card list showing name, role, relationship kind, and open Todo count.
- [x] Build a person header and empty Todo state with a prominent「Todoを作る」button.
- [x] Verify the screen manually with owner and demo member sessions.
- [x] Commit the relationship-centered People screens.

### Task 5: Todo creation and list

**Files:**
- Create: `packages/contracts/src/todo.ts`
- Create: `apps/api/src/domain/todo.ts`, `apps/api/src/application/create-todo.ts`, `apps/api/src/application/list-shared-todos.ts`
- Create: `apps/api/src/infrastructure/db/todo-repository.ts`
- Create: `apps/api/src/routes/todos.ts`
- Create: `apps/web/src/features/todos/TodoComposer.tsx`, `apps/web/src/features/todos/TodoCard.tsx`
- Create: `apps/web/src/routes/$organizationId/people/$contextMembershipId/todos.tsx`

**Produces:** A user can create a SharedTodo in a Person context and immediately see its creator and current assignee on the same screen. A Relationship row is not required.

**Status (2026-07-27):** [Person SharedTodo縦切り](./2026-07-27-relationship-todo-vertical-slice.md)でAPI/BFF/UIを実装。fresh DBでowner/member、Acme/Northstar分離、1280×900/390×844、direct SSR、Cloudflare dry-runを検証済み。

- [x] Research current TanStack Query, React form, invalidation, and optimistic UI practices; record the selected primitives.
- [x] Define small Zod contracts for title, optional description, context Membership, and assignee.
- [x] Add create/list API routes that derive creator and organization from Principal.
- [x] Keep only submitting feedback local, await exact Query invalidation, and refetch after success without optimistic insertion.
- [x] Build useful empty, pending, validation-error, forbidden/not-found, and saved states.
- [x] Manually create Todos as both demo users and confirm separation by Organization.
- [x] Commit the Person SharedTodo flow.

### Task 6: Handoff interaction

**Files:**
- Create: `apps/api/src/domain/handoff.ts`, `apps/api/src/application/request-handoff.ts`, `apps/api/src/application/decide-handoff.ts`
- Create: `apps/api/src/application/handoff.test.ts`
- Create: `apps/api/src/infrastructure/db/handoff-repository.ts`
- Create: `apps/api/src/routes/handoffs.ts`, `apps/api/src/routes/cross-tenant.integration.test.ts`
- Create: `apps/web/src/features/handoffs/HandoffDialog.tsx`
- Create: `apps/web/src/routes/_authed/$organizationId/inbox.tsx`

**Produces:** The assignee can request a Handoff; the recipient can accept/reject it; acceptance updates the visible Todo assignee.

- [x] Research current transaction, command idempotency, concurrent decision, action-state, and accessible Dialog practices; add the selected primitives to this task brief.
- [x] Implement requested/accepted/rejected state and the single acceptance transaction.
- [ ] Give Handoff an explicit `organization_id`, composite FKs to Todo/from/to Membership, and one requested Handoff per Todo.
- [x] Add one focused unit test for request → recipient accept → assignee changed.
- [x] Add one API integration test proving a session from another Organization cannot decide the Handoff.
- [x] Build a Base UI Dialog for choosing the recipient and an Inbox card with Accept/Reject actions.
- [x] Show a lightweight timeline using the Handoff row; do not add a generic audit/event system.
- [ ] Run the two tests and manually complete both accept and reject flows in the browser (Task 4: Browser unavailable; NEEDS_CONTEXT).
- [x] Commit `feat: add interactive Todo handoff`.

Task 4 local verification completed API/build/dry-run checks against disposable `amidala_handoff`; real browser journeys and screenshot capture remain pending until an In-App Browser is available.

### Task 7: One user-journey E2E and preview handoff

**Files:**
- Create: `e2e/todo-handoff.spec.ts`, `playwright.config.ts`
- Create: `.github/workflows/ci.yml`
- Create: `docs/runbooks/local-demo.md`, `docs/runbooks/cloudflare-preview.md`
- Modify: Web/API `wrangler.jsonc`

**Produces:** One command verifies the main UX locally, and the project is ready for explicit approval to provision/deploy preview resources.

- [ ] Research current Cloudflare preview, Hyperdrive, Workers CI, and Playwright practices before writing deployment/CI configuration.
- [ ] Write one Playwright journey: login as owner → open person → create Todo → request Handoff → login as recipient → accept → see new assignee.
- [ ] Run only build, typecheck, the four focused tests, and that E2E in CI; do not add coverage gates.
- [ ] Document a five-minute local demo with demo credentials and expected screens.
- [ ] Run `pnpm build`, focused tests, and `pnpm test:e2e`.
- [ ] Present the local product for user review.
- [ ] After explicit approval only, create PlanetScale Postgres Tokyo, cache-disabled Hyperdrive, private API Worker, and public preview Web Worker.
- [ ] Commit `test: add primary Todo handoff journey` before any external deployment commit.

## Completion Gate

The MVP is complete when the user can touch the preview and judge the People → Todo → Handoff experience. Passing every theoretical edge case is not a completion requirement. Feedback from that hands-on review determines the next slice and which hardening work is actually valuable.
