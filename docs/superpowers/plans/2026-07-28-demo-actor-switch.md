# Demo Actor Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 開発環境で田中と森を安全に切り替え、現在誰としてTodo/Handoffを見ているか常に分かるようにする。

**Architecture:** 通常shellはBetter Auth `useSession`をactor identityの正本にする。Demo switch実装とcredential参照は`.dev.tsx`をproductionでdead-code elimination可能なdynamic importに閉じ込め、切替event handlerだけでsignOut→signIn→Query cache clear→Handoff route遷移を行う。

**Tech Stack:** React 19、TanStack Start/Router/Query、Better Auth 1.6.25、TypeScript 7、Vite 7、Node test runner

## Global Constraints

- Switcherは`import.meta.env.DEV`かつ`VITE_DEMO_ACTOR_PASSWORD`がある時だけ表示する。
- 本番Web artifactへ`owner@amidala.local`、`mori@amidala.local`、demo password、`VITE_DEMO_ACTOR_PASSWORD`を残さない。
- 通常LoginFormのemail/password初期値は空にし、demo credential表示を削除する。
- actor identityは`authClient.useSession()`のname/emailを表示し、UserをOrganizationから独立した認証主体として扱う。
- 切替対象は田中 彩と森 ハルだけ。任意impersonationやproduction代理操作は作らない。
- switchは`signOut`→`signIn.email`→`queryClient.clear()`→既存`/$organizationId/handoffs`へreplace navigation→`router.invalidate()`。PR3でTodayへ変更する。
- errorは固定日本語。上流messageを表示しない。pending中は全切替buttonをdisabledにする。
- state同期目的の`useEffect`を使わない。

---

### Task 1: Demo actor contractをテストで固定する

**Files:**
- Create: `apps/web/src/features/auth/demo-actors.dev.ts`
- Create: `apps/web/src/features/auth/demo-actors.dev.test.ts`
- Create: `apps/web/src/env.d.ts`

**Interfaces:**
- Produces: `DemoActor`、`DEMO_ACTORS`、`isDemoActorSwitchEnabled(dev, password)`、`demoActorSwitchFailureMessage()`。
- Consumes: Vite `ImportMetaEnv`型。

- [ ] **Step 1: failing testを書く**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_ACTORS, demoActorSwitchFailureMessage, isDemoActorSwitchEnabled } from './demo-actors.dev'

test('demo actors use the domain names and seeded emails', () => {
  assert.deepEqual(DEMO_ACTORS, [
    { id: 'tanaka', name: '田中 彩', email: 'owner@amidala.local' },
    { id: 'mori', name: '森 ハル', email: 'mori@amidala.local' },
  ])
})

test('actor switch requires both development mode and a password', () => {
  assert.equal(isDemoActorSwitchEnabled(true, 'local-password'), true)
  assert.equal(isDemoActorSwitchEnabled(false, 'local-password'), false)
  assert.equal(isDemoActorSwitchEnabled(true, ''), false)
  assert.equal(isDemoActorSwitchEnabled(true, undefined), false)
})

test('actor switch failure never exposes an upstream message', () => {
  assert.equal(demoActorSwitchFailureMessage(), '操作ユーザーを切り替えられませんでした。もう一度お試しください。')
})
```

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @amidala/web test`

Expected: module not foundでFAIL。

- [ ] **Step 3: 最小実装とenv型を書く**

```ts
export type DemoActor = { id: 'tanaka' | 'mori'; name: string; email: string }
export const DEMO_ACTORS = [
  { id: 'tanaka', name: '田中 彩', email: 'owner@amidala.local' },
  { id: 'mori', name: '森 ハル', email: 'mori@amidala.local' },
] as const satisfies readonly DemoActor[]

export function isDemoActorSwitchEnabled(dev: boolean, password: string | undefined): password is string {
  return dev && Boolean(password?.trim())
}

export function demoActorSwitchFailureMessage(): string {
  return '操作ユーザーを切り替えられませんでした。もう一度お試しください。'
}
```

`env.d.ts`で`ImportMetaEnv.VITE_DEMO_ACTOR_PASSWORD?: string`を宣言する。

- [ ] **Step 4: GREENを確認する**

Run: `pnpm --filter @amidala/web test`

Expected: 10 tests PASS（既存7 + 新規3）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/demo-actors.dev.ts apps/web/src/features/auth/demo-actors.dev.test.ts apps/web/src/env.d.ts
git commit -m "test: define local demo actors"
```

### Task 2: Shell identityとdevelopment-only switcherを実装する

**Files:**
- Create: `apps/web/src/features/auth/DemoActorSwitcher.dev.tsx`
- Modify: `apps/web/src/features/auth/LoginForm.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `authClient.useSession/signOut/signIn.email`、`DEMO_ACTORS`、`VITE_DEMO_ACTOR_PASSWORD`、`QueryClient.clear`、organizationId。
- Produces: shellのcurrent actor name/email/initialと、DEV限定切替UI。

- [ ] **Step 1: LoginFormからcredentialを除去する**

`email`と`password`の`useState`初期値を空文字にし、`.demo-copy` paragraphを削除する。既存の固定日本語errorとsubmit handlerは維持する。

- [ ] **Step 2: switcher componentを書く**

`DemoActorSwitcher.dev.tsx`は`organizationId: string`を受け取る。`authClient.useSession()`、`useQueryClient()`、`useNavigate()`、`useRouter()`を使う。

button handlerは次の順序に固定する。

```ts
setPendingActorId(actor.id)
setError(null)
try {
  const signOutResult = await authClient.signOut()
  if (signOutResult.error) throw new Error('sign out failed')
  const signInResult = await authClient.signIn.email({ email: actor.email, password })
  if (signInResult.error) throw new Error('sign in failed')
  queryClient.clear()
  await navigate({ to: '/$organizationId/handoffs', params: { organizationId }, replace: true })
  await router.invalidate()
} catch {
  setError(demoActorSwitchFailureMessage())
} finally {
  setPendingActorId(null)
}
```

現在sessionと同じemailのbuttonは`aria-current="true"`かつdisabled。pending中は全button disabled。errorは`role="alert"`。

- [ ] **Step 3: shellへsession identityを表示する**

`ApplicationShell`で`const session = authClient.useSession()`を呼び、`session.data?.user.name`と`email`をside accountとtop barへ表示する。initialはnameの先頭文字、nameがなければemail先頭、session pendingは`…`。

DEV componentはproductionでimportされないよう次の形にする。

```ts
const DemoActorSwitcher = import.meta.env.DEV
  ? lazy(() => import('../features/auth/DemoActorSwitcher.dev'))
  : null
```

`import.meta.env.DEV && VITE_DEMO_ACTOR_PASSWORD && organizationId`の時だけ`Suspense`内に表示する。

- [ ] **Step 4: responsive stylesを書く**

top bar右側を`.actor-controls`にし、name/emailを省略可能に表示する。Switcherはnative `details/summary`、2つのbutton、errorだけ。390pxで横overflowせず、tap target 44px以上。

- [ ] **Step 5: tests/buildを通す**

```bash
pnpm --filter @amidala/web test
pnpm --filter @amidala/web build
git diff --check
```

Expected: tests/build PASS、`useEffect`追加0件。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/auth/DemoActorSwitcher.dev.tsx apps/web/src/features/auth/LoginForm.tsx apps/web/src/routes/__root.tsx apps/web/src/styles.css
git commit -m "feat: switch local demo actors"
```

### Task 3: local env/docsとproduction artifact gateを完成する

**Files:**
- Create: `apps/web/.env.development.local.example`
- Modify: `.gitignore`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/plans/2026-07-28-demo-actor-switch.md`

**Interfaces:**
- Consumes: production Web build artifactとignored local env。
- Produces: 新規cloneでcredentialをGitへ入れずActor Switchを有効にする手順、production artifact absence証跡。

- [x] **Step 1: env templateとignoreを書く**

`apps/web/.env.development.local.example`:

```dotenv
VITE_DEMO_ACTOR_PASSWORD=
```

`.gitignore`へ`apps/web/.env.development.local`を追加する。

- [x] **Step 2: Docsへlocal設定を追加する**

初回のみtemplateを`.env.development.local`へcopyし、local seed passwordを値に設定することを記載する。値そのものはDocs/exampleへ書かない。

- [x] **Step 3: production artifact gateを実行する**

実際の`.env.development.local`を作業用に置いても、production buildはdevelopment local envを読まない。

```bash
pnpm --filter @amidala/web build
if rg -n 'owner@amidala\.local|mori@amidala\.local|amidala-demo-2026|VITE_DEMO_ACTOR_PASSWORD' apps/web/dist; then exit 1; fi
```

Expected: grep hit 0、exit 0。

実測: `pnpm --filter @amidala/web build` 成功後、指定パターンの `rg` はhit 0（否定条件のgateはexit 0）。

- [x] **Step 4: local dev compileを確認する**

`.env.development.local`へlocal seed passwordを設定し、`pnpm --filter @amidala/web dev`の起動ログにcompile errorがないことを確認して終了する。ブラウザinspectionがURL policyで拒否される場合は迂回しない。

実測: ignoredな`.env.development.local`へseed passwordを設定し、dev起動ログでVite ready／compile errorなしを確認した（ブラウザinspectionは実施していない）。

- [x] **Step 5: full verification**

```bash
pnpm --filter @amidala/api test -- --run
pnpm --filter @amidala/web test
pnpm build
git diff --check
git status --short --branch
```

Expected: tests/build/diff PASS、branch cleanはcommit後に確認。

実測: API test、Web test、`pnpm build`、`git diff --check` がすべて成功。

- [x] **Step 6: 実測をplanへ記録してCommit**

```bash
git add .gitignore apps/web/.env.development.local.example docs/README.md docs/superpowers/plans/2026-07-28-demo-actor-switch.md
git commit -m "docs: secure the local actor switch setup"
```
