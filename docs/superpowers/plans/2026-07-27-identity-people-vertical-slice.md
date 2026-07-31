# Identity → People Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock People home with a local-PostgreSQL-backed Login → Organization chooser → People experience while preserving the public Web/BFF and private Hono API Worker boundary.

**Architecture:** Better Auth owns global User/credential/session tables in PostgreSQL. Application-owned Membership connects a User to an Organization, Hono validates that membership before every People query, and TanStack Start calls the private API through a thin server-only adapter over the existing Service Binding. Awilix creates and disposes the `pg.Client`, Drizzle repositories, and application services once per request.

**Tech Stack:** TypeScript 7.0.2, React 19.1.1, TanStack Start 1.168.32, TanStack Router 1.170.18, Hono 4.12.32, Better Auth 1.6.25, `auth` CLI 1.6.25, Drizzle ORM 0.45.2, Drizzle Kit 0.31.10, `pg` 8.22.0, `tsx` 4.23.1, Awilix 13.0.5, PostgreSQL 17, Cloudflare Workers.

## Global Constraints

- Modify only `/Users/maa/Projects/gs/000_参照用/aimani-ai-v2`; legacy Aimani AI/BYARD repositories remain read-only.
- `User` is the organization-independent person, Better Auth `Account` is a credential, and `Membership` is the only User↔Organization connection.
- Do not use Better Auth Organization Plugin, PostgreSQL RLS, audit/outbox/Queue, Todo/Handoff tables, coverage gates, or new Cloudflare resources.
- Web never accesses PostgreSQL. Browser-visible auth remains same-origin and all business data flows Web/BFF → Service Binding → private Hono API.
- Awilix imports remain under `apps/api/src/composition`; application/domain modules receive typed dependencies and never resolve the container.
- Every People query must derive User from the session and include the validated Membership's `organizationId`.
- React components do not fetch in `useEffect`; route loaders/server functions own data loading.
- Preserve `docs/design/foundation.md`, show explicit pending/error/empty states, and label demo/mock data honestly.
- Add only one test in this slice: the cross-tenant People API rejection. Keep the existing DI smoke test.
- Do not create external resources or deploy.

---

### Task 1: Local PostgreSQL and identity schema

**Files:**
- Create: `compose.yaml`
- Create: `apps/api/.dev.vars.example`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema/auth.ts`, `packages/db/src/schema/organization.ts`, `packages/db/src/schema/index.ts`
- Create: `packages/db/src/client.ts`, `packages/db/src/migrate.ts`
- Create: `packages/db/drizzle/*.sql`
- Modify: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`

**Interfaces:**
- Produces: `createNodePgDatabase(connectionString): { client: pg.Client; db: NodePgDatabase<typeof schema> }`
- Produces: `closeNodePgDatabase(resource): Promise<void>`
- Produces: Drizzle tables `user`, `account`, `session`, `verification`, `organization`, `membership`, `relationship`
- Produces: scripts `pnpm db:up`, `pnpm db:migrate`, `pnpm db:down`

- [x] **Step 1: Pin packages and create the local database contract**

Registry verification on 2026-07-27 produced `better-auth 1.6.25`, `@better-auth/drizzle-adapter 1.6.25`, and `auth 1.6.25` with description `The CLI for Better Auth`; `better-auth@1.6.25` exports `./minimal`. Re-run these exact commands before install if the registry has changed: `pnpm view <package>@1.6.25 name version description` and `pnpm view better-auth@1.6.25 exports --json`. Add `drizzle-orm@0.45.2` and `pg@8.22.0` to `@aimani-ai/db`; add `drizzle-kit@0.31.10` and `@types/pg@8.20.0` as its dev dependencies. Add `tsx@4.23.1` and `@types/node@26.1.1` as root development tooling. Better Auth packages belong to `@aimani-ai/api` in Task 2, not the DB package. `@aimani-ai/contracts` already exists; add `zod@4.4.3` there in Task 1. Use PostgreSQL 17 in Compose and document only this local URL in `apps/api/.dev.vars.example`:

```text
DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani-ai
BETTER_AUTH_SECRET=local-development-secret-change-before-preview
BETTER_AUTH_URL=http://localhost:5173
```

Copy the example once with `cp apps/api/.dev.vars.example apps/api/.dev.vars`; keep `.dev.vars` ignored. Node scripts do not inherit Wrangler's `.dev.vars` loading. Define root scripts so migrations and seeds load the same file explicitly: `db:migrate` runs `node --env-file=apps/api/.dev.vars --import tsx packages/db/src/migrate.ts`, and Task 2's `db:seed` runs `node --env-file=apps/api/.dev.vars --import tsx apps/api/src/dev/seed.ts`. `packages/db/drizzle.config.ts` is executed by Drizzle Kit rather than Wrangler, so it must call Node's `loadEnvFile` for the repository-root `apps/api/.dev.vars` before reading `DATABASE_URL`. Keep this Node-only environment bootstrap out of every Worker import graph.

- [x] **Step 2: Define the seven-table schema**

Use the exact singular physical names `user`, `account`, `session`, `verification`, `organization`, `membership`, `relationship`. Do not configure `usePlural` or Better Auth model renames. `membership` has `UNIQUE(user_id, organization_id)`, enum-like CHECK constraints for role/status, and FKs with explicit delete behavior. Add `UNIQUE(id, organization_id)` to Membership and composite FKs from `(relationship.source_membership_id, relationship.organization_id)` and `(relationship.target_membership_id, relationship.organization_id)`. `relationship` also has `source_membership_id <> target_membership_id` and `UNIQUE(organization_id, source_membership_id, target_membership_id, kind)`.

Use these exact columns; timestamps are timezone-aware and all ID columns are text for Better Auth compatibility and consistent foreign keys:

```text
user(id PK, name, email UNIQUE, email_verified, image NULL, created_at, updated_at)
account(id PK, account_id, provider_id, user_id FK->user CASCADE, access_token NULL,
        refresh_token NULL, id_token NULL, access_token_expires_at NULL,
        refresh_token_expires_at NULL, scope NULL, password NULL, created_at, updated_at,
        UNIQUE(provider_id, account_id))
session(id PK, expires_at, token UNIQUE, created_at, updated_at,
        ip_address NULL, user_agent NULL, user_id FK->user CASCADE)
verification(id PK, identifier, value, expires_at, created_at, updated_at,
             INDEX(identifier))
organization(id PK, name, slug UNIQUE, created_at, updated_at)
membership(id PK, user_id FK->user CASCADE, organization_id FK->organization CASCADE,
           display_name, title NULL, role, status, created_at, updated_at,
           UNIQUE(user_id, organization_id), UNIQUE(id, organization_id))
relationship(id PK, organization_id FK->organization CASCADE,
             source_membership_id, target_membership_id, kind, created_at, updated_at,
             composite FKs to membership(id, organization_id), source <> target,
             UNIQUE(organization_id, source_membership_id, target_membership_id, kind))
```

The slice has no Relationship write endpoint. Exact duplicate prevention is in DDL; reverse-pair normalization for future symmetric Relationship writes belongs to that later use case, not this seed/read slice.

- [x] **Step 3: Generate and inspect migrations**

Run:

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm --filter @aimani-ai/db exec drizzle-kit generate
pnpm db:up
pnpm db:migrate
```

Expected: PostgreSQL 17 starts and all seven tables exist without runtime migration in a Worker.

- [x] **Step 4: Verify and commit**

Run `pnpm --filter @aimani-ai/db build`, `pnpm db:migrate`, and a read-only SQL query confirming the seven exact table names. Commit `feat: add local identity database`.

---

### Task 2: Request-scoped database, Better Auth, and organization session API

**Files:**
- Create: `apps/api/src/auth/create-auth.ts`
- Create: `apps/api/src/config/env.ts`, `apps/api/src/errors/api-error.ts`
- Create: `apps/api/src/dev/seed.ts`
- Create: `apps/api/src/application/list-organizations.ts`
- Create: `apps/api/src/domain/identity.ts`
- Create: `apps/api/src/infrastructure/db/membership-repository.ts`
- Create: `apps/api/src/routes/auth.ts`, `apps/api/src/routes/organizations.ts`
- Modify: `apps/api/src/composition/root-container.ts`, `apps/api/src/composition/request-scope.ts`, `apps/api/src/app.ts`, `apps/api/src/worker.ts`, `apps/api/wrangler.jsonc`, `apps/api/package.json`
- Modify: root `package.json`
- Modify: `apps/web/src/server.ts`
- Delete: `apps/web/src/routes/api.health.ts`

**Interfaces:**
- Produces: `createAuth(db, env): ReturnType<typeof betterAuth>` using `better-auth/minimal` and `@better-auth/drizzle-adapter`
- Produces: `GET /api/auth/*`, `POST /api/auth/*`
- Produces: `GET /organizations` returning `{ organizationMemberships: OrganizationMembershipSummary[] }`, where `OrganizationMembershipSummary = { organizationId: string; name: string; slug: string; membershipId: string; role: 'owner' | 'manager' | 'member'; displayName: string }`
- Produces: `CurrentMembershipContext = { userId: string; membershipId: string; organizationId: string; role: MembershipRole }`
- Produces: `ApiBindings = { DATABASE_URL?: string; HYPERDRIVE?: Hyperdrive; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string }`
- Produces: `ApiErrorBody = { error: { code: 'unauthorized' | 'forbidden' | 'validation_error' | 'service_unavailable'; message: string } }`

- [x] **Step 1: Register request-scoped DB resources**

Replace `Record<string, unknown>` / `env: unknown` with typed `ApiBindings`. `resolveDatabaseUrl` uses `HYPERDRIVE.connectionString` in preview and `DATABASE_URL` only for local development. Missing configuration raises a typed configuration error mapped to 503 `service_unavailable`. Connect `pg.Client` inside the scoped factory, wrap it with Drizzle, and register a disposer that calls `client.end()` on success and failure. Register repositories and application services as scoped. Keep Clock/IdGenerator stateless in the root.

- [x] **Step 2: Mount Better Auth in Hono**

Use the official Hono shape:

```ts
app.on(['GET', 'POST'], '/api/auth/*', (c) => c.get('scope').resolve('auth').handler(c.req.raw));
```

Use email/password only, trusted localhost origin, HTTP-only SameSite=Lax cookie defaults, and no Organization Plugin.

Add exact API dependencies `better-auth@1.6.25`, `@better-auth/drizzle-adapter@1.6.25`, `@aimani-ai/db@workspace:*`, and `zod@4.4.3`. Use the default singular table mapping and pass the explicit Drizzle schema object to the adapter. Core columns are maintained explicitly at the pinned version; no runtime/Worker migration is allowed.

- [x] **Step 3: Add session and organization application flow**

Resolve the session with `auth.api.getSession({ headers })`. `/organizations` returns only active Memberships for the session User. Return 401 for no session and never accept a User ID from browser input.

`/api/auth/*` passes through Better Auth's native status/body because the Better Auth React client consumes that contract. Application routes `/organizations` and `/organizations/:organizationId/people` use `ApiErrorBody`: route validators map to 400, missing session to 401, missing Membership to 403. A shared Hono `onError` maps configuration/DB failures to generic 503 without leaking connection details; unexpected programmer errors remain 500 and are logged.

- [x] **Step 4: Seed the touchable identity graph**

Run the seed as a Node script in `@aimani-ai/api`, after `createAuth` exists; `packages/db` must not import the API package. Call `auth.api.signUpEmail` directly against the local DB, then upsert these fixtures by email/slug:

```text
email / password / display name
owner@aimani-ai.local  / aimani-ai-demo-2026 / 田中 彩
sato@aimani-ai.local   / aimani-ai-demo-2026 / 佐藤 花子
suzuki@aimani-ai.local / aimani-ai-demo-2026 / 鈴木 健
mori@aimani-ai.local   / aimani-ai-demo-2026 / 森 ハル

acme-studio: owner + sato + mori; owner/sato = manager_report, mori = relationship未設定
northstar-lab: owner + suzuki, peer
```

The fixed password is local/demo-only and must not be copied to preview secrets. If a User already exists, call `auth.api.signInEmail` with the fixed password before reusing it. If that fails or the credential Account is missing, stop with an actionable local-seed-collision message rather than silently changing a password or deleting sessions. Add root `pnpm db:seed` pointing to the API seed script.

- [x] **Step 5: Make the Web proxy canonical**

Keep exactly one Web Worker proxy path in `apps/web/src/server.ts` for `/api/health` and `/api/auth/*`; delete `routes/api.health.ts`. Construct the Service Binding request from the original request so method, body, cookie, origin, and content type are preserved. Rebuild the response and append every value from `response.headers.getSetCookie()` rather than collapsing multiple cookies. Preserve 400/401/403 response status and `ApiErrorBody` JSON.

- [x] **Step 6: Verify and commit**

Run `pnpm db:seed`, API typecheck/test/build, `pnpm build`, and Wrangler dry-run. Start the existing single `pnpm dev` entrypoint and use `http://localhost:5173/api/auth/*` through the Web proxy with a curl cookie jar; do not expose or call a separate public API Worker port. Sign in and read `/organizations` through the same Web/BFF path. Confirm missing DB configuration returns the defined 503 JSON. Commit `feat: add organization-aware authentication API`.

---

### Task 3: Tenant-safe People API and BFF adapter

**Files:**
- Create: `packages/contracts/src/people.ts`, `packages/contracts/src/index.ts`, `packages/contracts/tsconfig.json`
- Create: `packages/api-client/src/index.ts`, `packages/api-client/tsconfig.json`
- Create: `apps/api/src/application/list-people.ts`
- Create: `apps/api/src/infrastructure/db/people-repository.ts`
- Create: `apps/api/src/routes/people.ts`
- Create: `apps/api/src/routes/people.integration.test.ts`
- Create: `apps/api/vitest.integration.config.ts`
- Create: `apps/web/src/features/people/people-schema.ts`
- Create: `apps/web/src/features/people/people.server.ts`
- Create: `apps/web/src/features/people/people.functions.ts`
- Modify: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/app.ts`, `apps/api/src/composition/request-scope.ts`
- Modify: `packages/api-client/package.json`, `packages/contracts/package.json`, `apps/web/package.json`
- Create: `apps/api/src/app-type.ts`

**Interfaces:**
- Produces: `MemberSummary = { membershipId: string; name: string; title: string | null; relationshipKinds: Array<'manager_report' | 'supporter' | 'peer'> }`
- Produces: `GET /organizations/:organizationId/people`
- Produces: `getPeople({ data: { organizationId } }): Promise<{ people: MemberSummary[] }>`
- Produces: `createApiClient(fetcher): ReturnType<typeof hc<AppType>>`, where `@aimani-ai/api-client` has a type-only workspace dependency on `@aimani-ai/api` and Web imports only the client package

- [x] **Step 1: Write the failing cross-tenant test**

Add a separate `test:integration` script and Vitest config that includes only `src/**/*.integration.test.ts`; keep the default test command DB-free. The integration config must fail immediately with `TEST_DATABASE_URL is required` before importing the app when the variable is absent. Start the local DB, migrate, and seed, then run with `TEST_DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani-ai`.

In the test, sign in `sato@aimani-ai.local` / `aimani-ai-demo-2026` through the existing Hono Better Auth route and extract all `Set-Cookie` values. Request Organization ID `org_northstar_lab`'s People endpoint with that cookie; do not substitute its slug `northstar-lab`. Assert status `403`, body equals `{ error: { code: 'forbidden', message: 'This organization is not available to this user.' } }`, and body has no `people` property. The test imports the existing `createApp`; before the People route is implemented it compiles and fails with actual 404 rather than setup/type errors.

- [x] **Step 2: Verify RED**

Run `TEST_DATABASE_URL=postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani-ai pnpm --filter @aimani-ai/api test:integration -- --run` and record the expected missing route/service failure. The default DB-free test remains green.

- [x] **Step 3: Implement the tenant-safe query**

Validate `organizationId`, derive `userId` from session, find the active Membership, reject absence with 403, then query active Memberships in the same Organization excluding the Current Membership. Left join Relationships on both Membership IDs and `organization_id`, so users without a Relationship remain visible. `manager_report` means source=manager and target=direct report. Return one card per Membership, sort names deterministically, and sort relationship kinds `manager_report`, `supporter`, `peer`. Never accept `membershipId` as identity input.

Compose Hono route modules with `.route()` and export `AppType = ReturnType<typeof createApp>` from `apps/api/src/app-type.ts`. Add `"./app-type": { "types": "./src/app-type.ts" }` to `@aimani-ai/api` exports. `@aimani-ai/api-client` adds a type-only workspace dependency on `@aimani-ai/api`, uses a no-emit tsconfig, exports its source from `package.json`, and constructs `hc<AppType>('http://api.internal', { fetch: fetcher })`; the supplied fetcher delegates to `env.API.fetch` and is never the public network fetch. The API package does not depend on api-client, so no package cycle is introduced.

- [x] **Step 4: Add the thin Start Server Function**

`people.functions.ts` contains only `createServerFn`, Zod validation, and a call to `people.server.ts`. `people.server.ts` reads request cookie headers and calls the typed API client with `param: { organizationId }` and the cookie headers; the client's custom fetch delegates to `env.API.fetch`. Map 401 to login redirect, preserve 403 as a typed forbidden result, and map 400/503 to `ApiErrorBody`. No React component imports `cloudflare:workers`, Hono, or Better Auth.

- [x] **Step 5: Verify GREEN and commit**

Run the focused API test, API typecheck/build, and monorepo build. Commit `feat: add tenant-safe People API`.

---

### Task 4: Touchable Login, Organization chooser, and People screens

**Files:**
- Create: `apps/web/src/features/auth/auth-client.ts`, `apps/web/src/features/auth/LoginForm.tsx`
- Create: `apps/web/src/features/organizations/OrganizationChooser.tsx`
- Create: `apps/web/src/features/organizations/OrganizationSwitcher.tsx`
- Create: `apps/web/src/features/people/PersonCard.tsx`, `apps/web/src/features/people/Page.tsx`
- Create: `apps/web/src/routes/login.tsx`, `apps/web/src/routes/organizations.tsx`
- Create: `apps/web/src/routes/$organizationId/people.tsx`
- Modify: `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/index.tsx`, `apps/web/src/styles.css`

**Interfaces:**
- Consumes: same-origin Better Auth client, `GET /organizations`, `getPeople`
- Produces: browser flow `/login` → `/organizations` → `/$organizationId/people`

- [x] **Step 1: Build Login without effect-driven fetching**

Add `better-auth@1.6.25` to Web and use its React client for email/password sign-in. Show demo credentials, pending text, inline invalid-credential recovery, and navigate to `/organizations` only after success. Do not store tokens in localStorage.

- [x] **Step 2: Build Organization chooser**

Load organizations at the route/server boundary. A 401 redirects to `/login`. Zero Memberships show a dedicated state explaining that an administrator must add the User; do not redirect-loop. Show organization name and Membership role. Choosing one navigates to `/$organizationId/people`; it does not mutate User or Session rows.

- [x] **Step 3: Replace the mock People home**

Validate the `organizationId` route param and verify it appears in the session User's organization options. A direct link to an unavailable Organization renders the forbidden state with a link back to `/organizations`. Use the route loader/server function for People data. Render name, title, all relationship labels or「関係を未設定」, honest no-Todo copy, pending/error/empty states, desktop left navigation, and mobile bottom navigation. Keep a functional OrganizationSwitcher in the authenticated shell/People header so the User can change Organizations without signing out. Preserve Relationship-first typography/tokens instead of a metric dashboard.

- [x] **Step 4: Verify in the browser**

Run `pnpm dev`; sign in as the seeded owner, open both Organizations, verify each People set, then test 1280px desktop and 390px mobile without horizontal overflow. Confirm no React console errors.

- [x] **Step 5: Final verification and commit**

Run API tests, all package typechecks, `pnpm build`, and both Web/API Wrangler dry-runs. Update the parent MVP plan checkboxes and commit `feat: add touchable identity and People flow`.
