# Demo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ローカルで毎回同じ田中→森のTodo storyを再現でき、TanStack Startの二重entryによるhydration警告がないデモ基盤を作る。

**Architecture:** 既存の通常seedはupsert用途のまま関数化し、`db:demo:reset`だけが厳格にlocalhostの`amidala_demo`を選び、schema再作成・migration・seedを順に実行する。WebはTanStack Start既定のdocument hydrationだけを使い、旧Vite SPA entryを除去する。

**Tech Stack:** TypeScript 7、TanStack Start 1.168、React 19、Vitest 4、PostgreSQL 17、Drizzle ORM 0.45、Better Auth 1.6、pnpm 11

## Global Constraints

- 変更対象は新規repository `/Users/maa/Projects/gs/000_参照用/amidala-v2` のみ。旧Amidala / BYARDは変更しない。
- local demo databaseは`amidala_demo`、integration databaseは`amidala_handoff`。通常database`amidala`をresetしない。
- reset許可hostは`127.0.0.1`と`localhost`だけ。Hyperdriveやremote PostgreSQLを使わない。
- demo storyは田中が担当する「顧客インタビューの論点を整理する」、説明「次回の検証で確かめたい仮説を3つに絞る」、森context、初期Handoff 0件、Todo最大3件。
- full Event Sourcing、CRUD追加、Cloudflare deploy、通知はこのPRに入れない。
- React state同期のための`useEffect`を追加しない。
- 各taskはRED→GREEN→commitとし、PR全体でbuild、DB-free test、PostgreSQL story check、SSR responseを確認する。

---

### Task 1: TanStack Startのclient entryを一本化する

**Files:**
- Delete: `apps/web/index.html`
- Delete: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: `apps/web/src/routes/__root.tsx`の`RootDocument`、TanStack Start plugin既定client entry。
- Produces: `/`を含む全routeがTanStack Start SSR handlerへ到達し、`document`全体を一度だけhydrateするruntime。

- [ ] **Step 1: 現在の失敗を再現する**

Run:

```bash
pnpm --filter @amidala/web dev
curl -sS http://localhost:5173/ | rg '<div id="root"|/src/main.tsx'
```

Expected: `apps/web/index.html`由来の`<div id="root">`と`/src/main.tsx`が見つかり、root pathだけがStart SSRを迂回する。

- [ ] **Step 2: 旧SPA entryを削除する**

`apps/web/index.html`と`apps/web/src/main.tsx`を削除する。`apps/web/src/routes/__root.tsx`の`html/head/body`は現行TanStack Startの正しいdocument shellなので変更しない。

- [ ] **Step 3: SSR entryへ一本化されたことを確認する**

Run:

```bash
curl -sS -D /tmp/amidala-root-headers.txt -o /tmp/amidala-root-body.html http://localhost:5173/
rg '^(HTTP/|location:)' /tmp/amidala-root-headers.txt
if rg -q '<div id="root"|/src/main.tsx' /tmp/amidala-root-body.html; then exit 1; fi
curl -sS http://localhost:5173/login | rg '<!DOCTYPE html><html lang="ja">'
```

Expected: `/`はStart側のredirect/SSR responseで、legacy entry文字列は0件。`/login`は完全なHTML documentを返す。

- [ ] **Step 4: Web buildを確認する**

Run: `pnpm --filter @amidala/web build`

Expected: exit 0。

- [ ] **Step 5: Commit**

```bash
git add apps/web/index.html apps/web/src/main.tsx
git commit -m "fix: use the TanStack Start document entry"
```

### Task 2: demo database targetを純粋関数でguardする

**Files:**
- Create: `apps/api/src/dev/demo-database-url.ts`
- Create: `apps/api/src/dev/demo-database-url.test.ts`

**Interfaces:**
- Consumes: local `DATABASE_URL: string`。
- Produces: `deriveLocalDemoDatabaseUrl(source: string): string`、`assertLocalDemoDatabaseUrl(target: string): URL`、`DEMO_DATABASE_NAME = 'amidala_demo'`。

- [ ] **Step 1: guardのfailing testを書く**

```ts
import { describe, expect, it } from 'vitest'
import { assertLocalDemoDatabaseUrl, deriveLocalDemoDatabaseUrl } from './demo-database-url'

describe('assertLocalDemoDatabaseUrl', () => {
  it.each([
    'postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo',
    'postgresql://amidala:amidala@localhost:54329/amidala_demo',
  ])('accepts only the local demo database: %s', (value) => {
    expect(assertLocalDemoDatabaseUrl(value).pathname).toBe('/amidala_demo')
  })

  it.each([
    'postgresql://amidala:amidala@127.0.0.1:54329/amidala',
    'postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff',
    'postgresql://user:pass@example.com:5432/amidala_demo',
    'not-a-url',
  ])('rejects an unsafe target: %s', (value) => {
    expect(() => assertLocalDemoDatabaseUrl(value)).toThrow(/local demo database/i)
  })
})

describe('deriveLocalDemoDatabaseUrl', () => {
  it('keeps local connection details and replaces only the database name', () => {
    expect(deriveLocalDemoDatabaseUrl('postgresql://amidala:amidala@127.0.0.1:54329/amidala'))
      .toBe('postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo')
  })

  it('does not derive a target from a remote connection', () => {
    expect(() => deriveLocalDemoDatabaseUrl('postgresql://user:pass@example.com/db'))
      .toThrow(/local demo database/i)
  })
})
```

- [ ] **Step 2: testが存在しないmoduleで落ちることを確認する**

Run: `pnpm --filter @amidala/api test -- demo-database-url.test.ts --run`

Expected: FAIL with module not found。

- [ ] **Step 3: 最小実装を書く**

```ts
export const DEMO_DATABASE_NAME = 'amidala_demo'
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

export function assertLocalDemoDatabaseUrl(target: string): URL {
  let url: URL
  try { url = new URL(target) }
  catch { throw new Error('Refusing reset: target must be the local demo database.') }
  if (!LOCAL_HOSTS.has(url.hostname) || decodeURIComponent(url.pathname.slice(1)) !== DEMO_DATABASE_NAME) {
    throw new Error('Refusing reset: target must be the local demo database.')
  }
  return url
}

export function deriveLocalDemoDatabaseUrl(source: string): string {
  let url: URL
  try { url = new URL(source) }
  catch { throw new Error('Refusing reset: source must be a local PostgreSQL URL.') }
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error('Refusing reset: source must be a local demo database.')
  url.pathname = `/${DEMO_DATABASE_NAME}`
  url.search = ''
  url.hash = ''
  return assertLocalDemoDatabaseUrl(url.toString()).toString().replace(/\/$/, '')
}
```

実装時にはNode URLのserialization結果に合わせてtest expectationを固定し、username/passwordをlogしない。

- [ ] **Step 4: guard testを通す**

Run: `pnpm --filter @amidala/api test -- demo-database-url.test.ts --run`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dev/demo-database-url.ts apps/api/src/dev/demo-database-url.test.ts
git commit -m "test: guard the local demo database"
```

### Task 3: migrationとseedを再利用可能にする

**Files:**
- Create: `packages/db/src/migrations.ts`
- Modify: `packages/db/src/migrate.ts`
- Modify: `packages/db/package.json`
- Create: `apps/api/src/dev/seed-development-data.ts`
- Modify: `apps/api/src/dev/seed.ts`

**Interfaces:**
- Consumes: `DATABASE_URL`、Drizzle migration SQL、Better Auth signup/signin、既存Organization/Membership/Relationship schema。
- Produces: `migrateDatabase(connectionString: string): Promise<void>`、`seedDevelopmentData(databaseUrl: string): Promise<void>`、固定ID `todo-demo-customer-interview`のopen Todo。

- [ ] **Step 1: migration helperを抽出する**

`packages/db/src/migrations.ts`へ次を作る。

```ts
import { resolve } from 'node:path'
import { Client } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

export async function migrateDatabase(connectionString: string): Promise<void> {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), 'packages/db/drizzle') })
  } finally {
    await client.end()
  }
}
```

`packages/db/src/migrate.ts`はenv load後に`migrateDatabase(process.env.DATABASE_URL ?? '')`を呼ぶCLI wrapperだけにする。`packages/db/package.json`のexportsへ`"./migrations":"./src/migrations.ts"`を加える。

- [ ] **Step 2: seed本体を関数へ抽出する**

現`apps/api/src/dev/seed.ts`の`main`本体を`seed-development-data.ts`の`seedDevelopmentData(databaseUrl)`へ移す。`seed.ts`は`resolveDatabaseUrl(process.env as ApiBindings)`を渡すCLI wrapperだけにする。

既存4 User、2 Organization、Membership、Relationshipのupsert挙動は保持する。ログや戻り値へpasswordを出さない。

- [ ] **Step 3: deterministic domain storyをseedする**

Organization/Membership upsert後、次をupsertする。

```ts
const DEMO_STORY_TIME = new Date('2026-07-27T00:00:00.000Z')
await database.insert(schema.todo).values({
  id: 'todo-demo-customer-interview',
  organizationId: 'org_acme_studio',
  contextMembershipId: 'acme-studio-mori',
  creatorMembershipId: 'acme-studio-owner',
  assigneeMembershipId: 'acme-studio-owner',
  title: '顧客インタビューの論点を整理する',
  description: '次回の検証で確かめたい仮説を3つに絞る',
  status: 'open',
  createdAt: DEMO_STORY_TIME,
  updatedAt: DEMO_STORY_TIME,
}).onConflictDoUpdate({
  target: schema.todo.id,
  set: {
    assigneeMembershipId: 'acme-studio-owner',
    title: '顧客インタビューの論点を整理する',
    description: '次回の検証で確かめたい仮説を3つに絞る',
    status: 'open',
    updatedAt: DEMO_STORY_TIME,
  },
})
```

- [ ] **Step 4: buildと既存seed互換を確認する**

Run:

```bash
pnpm --filter @amidala/db build
pnpm --filter @amidala/api build
pnpm db:seed
pnpm db:seed
```

Expected: すべてexit 0。通常seedは2回実行しても重複しない。

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/migrations.ts packages/db/src/migrate.ts packages/db/package.json apps/api/src/dev/seed-development-data.ts apps/api/src/dev/seed.ts
git commit -m "refactor: reuse migrations and development seed"
```

### Task 4: 安全なdemo resetとPostgreSQL story checkを作る

**Files:**
- Create: `apps/api/src/dev/reset-demo-database.ts`
- Create: `apps/api/src/dev/demo-seed.integration.test.ts`
- Modify: `package.json`
- Modify: `apps/api/.dev.vars.example`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: `deriveLocalDemoDatabaseUrl`、`assertLocalDemoDatabaseUrl`、`migrateDatabase`、`seedDevelopmentData`。
- Produces: root command `pnpm db:demo:reset`、reset後にdomain storyをSQLで証明するintegration test。

- [ ] **Step 1: PostgreSQL storyのfailing testを書く**

`demo-seed.integration.test.ts`は`TEST_DATABASE_URL`を`assertLocalDemoDatabaseUrl`へ通してから接続し、次を1 testで確認する。

```ts
expect(todo.rows).toEqual([{
  id: 'todo-demo-customer-interview',
  title: '顧客インタビューの論点を整理する',
  description: '次回の検証で確かめたい仮説を3つに絞る',
  assignee_membership_id: 'acme-studio-owner',
  context_membership_id: 'acme-studio-mori',
  status: 'open',
}])
expect(Number(todoCount.rows[0].count)).toBeLessThanOrEqual(3)
expect(Number(handoffCount.rows[0].count)).toBe(0)
```

- [ ] **Step 2: reset前にstory testが失敗することを確認する**

Run:

```bash
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo \
  pnpm --filter @amidala/api test:demo -- --run
```

Expected: databaseまたはtable/storyが存在せずFAIL。

- [ ] **Step 3: reset commandを実装する**

`reset-demo-database.ts`は以下の順序だけで実行する。

1. `process.env.DATABASE_URL`を必須化。
2. `deriveLocalDemoDatabaseUrl`でtargetを作り、`assertLocalDemoDatabaseUrl`で再検証。
3. 同じhost/port/user/passwordでpathnameだけ`/postgres`にしたmaintenance URLへ接続。
4. `pg_database`に`amidala_demo`がなければ固定SQL `CREATE DATABASE amidala_demo`を実行。
5. targetへ接続し、`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`を実行してclose。
6. `migrateDatabase(target)`。
7. `seedDevelopmentData(target)`。
8. credentialを含めず`Demo database reset complete: amidala_demo`だけを出力。

root `package.json`へ追加する。

```json
"db:demo:reset": "node --env-file=apps/api/.dev.vars --import tsx apps/api/src/dev/reset-demo-database.ts"
```

`apps/api/.dev.vars.example`の`DATABASE_URL`は`amidala_demo`へ変更し、新規cloneが画面用DBを使うようにする。integrationは引き続き明示的な`TEST_DATABASE_URL=.../amidala_handoff`を使う。

- [ ] **Step 4: resetとstory testを2回通す**

Run:

```bash
pnpm db:up
pnpm db:demo:reset
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo \
  pnpm --filter @amidala/api test:demo -- --run
pnpm db:demo:reset
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo \
  pnpm --filter @amidala/api test:demo -- --run
```

Expected: 2回ともPASSし、resetの再実行でも同じdomain storyになる。

- [ ] **Step 5: 通常DBとremote URLが拒否されることを確認する**

Run:

```bash
DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala \
  node --import tsx -e "import('./apps/api/src/dev/demo-database-url.ts').then(({assertLocalDemoDatabaseUrl}) => assertLocalDemoDatabaseUrl(process.env.DATABASE_URL))"
```

Expected: non-zeroで`Refusing reset`。実際のreset commandはsourceから`amidala_demo`を導出するため、raw target guardを直接検査する。

- [ ] **Step 6: Docsへローカル起動順を記録する**

`docs/README.md`へ以下を追加する。

```text
pnpm db:up
pnpm db:demo:reset
cp apps/api/.dev.vars.example apps/api/.dev.vars  # 初回だけ
pnpm dev
```

既存`.dev.vars`利用者は`DATABASE_URL`のdatabase名を`amidala_demo`へ変更する。資格情報の値はDocsへ追加しない。

- [ ] **Step 7: Commit**

```bash
git add package.json apps/api/.dev.vars.example apps/api/src/dev/reset-demo-database.ts apps/api/src/dev/demo-seed.integration.test.ts docs/README.md
git commit -m "feat: reset a deterministic local demo database"
```

### Task 5: PR1全体を検証する

**Files:**
- Modify: `docs/superpowers/plans/2026-07-27-demo-foundation.md`（checkboxと実測結果）

**Interfaces:**
- Consumes: Tasks 1-4の完成物。
- Produces: review可能なclean branchと、PR本文に転載できる検証証跡。

- [x] **Step 1: 全DB-free checksを実行する**

```bash
pnpm --filter @amidala/api test -- --run
pnpm --filter @amidala/web test
pnpm build
git diff --check
```

Expected: すべてPASS。

実測 (2026-07-28): `pnpm --filter @amidala/api test -- --run` (13/13 PASS)、`pnpm --filter @amidala/web test` (7/7 PASS)、`pnpm build` (turbo 3 tasks PASS)、`git diff --check` (exit 0)。

- [x] **Step 2: fresh demo DBを確認する**

```bash
pnpm db:demo:reset
TEST_DATABASE_URL=postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo \
  pnpm --filter @amidala/api test:demo -- --run
```

Expected: story test PASS。

実測 (2026-07-28): `pnpm db:demo:reset` が `Demo database reset complete: amidala_demo` で終了。専用の `test:demo` command は 1 file / 1 test PASS。

実装更新: `vitest.demo.config.ts` は `TEST_DATABASE_URL` を必須化し、local `amidala_demo` URLをassertしたうえでdemo seed testのみをinclude。通常の `vitest.integration.config.ts` は `src/dev/**` をexcludeし、demo testが通常integration suiteへ混入しない。

- [ ] **Step 3: SSRとconsoleを確認する**

`pnpm dev`を起動し、`/`がStart redirect、`/login`がfull documentであることをcurlで確認する。許可されたin-app browserでfresh navigationとdirect reloadを行い、console warning/error 0件を確認する。browser policyでlocalhost inspectionが拒否される場合は、curl結果とbuildを証跡にし、最終3分journeyでbrowser確認を必須pendingとして残す。

実測 (2026-07-28): `curl /` は `HTTP/1.1 307 Temporary Redirect` と `location: /organizations`、legacy marker 0件。`curl /login` は `200 OK` かつ `<!DOCTYPE html><html lang="ja">`。既存の in-app local tab を claim → reload し `dev.logs` の error/warn が空であることは観測したが、DOM snapshot は `Browser Use rejected this action ... localhost URL blocked by Browser use URL policy` と拒否された。迂回は行わず、fresh navigation/direct reload の console 全体 0件は証明できないため、browser 確認を必須 pending とする。

- [x] **Step 4: 計画へ実測結果を記録してcommitする**

```bash
git add docs/superpowers/plans/2026-07-27-demo-foundation.md
git commit -m "docs: record demo foundation verification"
```

- [x] **Step 5: branchがcleanか確認する**

Run: `git status --short --branch`

Expected: `impl/demo-foundation`に未commit差分なし。
