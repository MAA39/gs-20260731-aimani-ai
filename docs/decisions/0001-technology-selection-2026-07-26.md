# ADR-0001: 2026-07-26 技術選定

日付: 2026-07-26
ステータス: 採用。触れる MVP で再評価する
対象: Aimani AI v2。`共通` と記した判断は他プロダクトでも再利用可能

## 結論

TanStack Start の public Web/BFF Worker と、Hono の private API Worker を Cloudflare Service Binding で接続する。API は Better Auth、Awilix、Drizzle、PostgreSQL を所有し、本番接続は Hyperdrive を通す。

UI は TanStack Router / Query / Form、Tailwind CSS v4、Base UI、Lucide で構築する。monorepo は pnpm workspace と Turborepo を使う。

## 固定する初期バージョン

次は 2026-07-26 に npm `latest` を確認した値である。lockfile を正本とし、無条件の自動更新はしない。

| 役割 | package | version |
|---|---|---:|
| package manager | `pnpm` | `11.17.0` |
| monorepo tasks | `turbo` | `2.10.7` |
| language | `typescript` | `7.0.2` |
| Web / SSR / BFF | `@tanstack/react-start` | `1.168.32` |
| routing | `@tanstack/react-router` | `1.170.18` |
| server state | `@tanstack/react-query` | `5.101.4` |
| forms | `@tanstack/react-form` | `1.33.2` |
| API | `hono` | `4.12.32` |
| auth | `better-auth` | `1.6.25` |
| DI | `awilix` | `13.0.5` |
| ORM | `drizzle-orm` | `0.45.2` |
| migrations | `drizzle-kit` | `0.31.10` |
| PostgreSQL client | `pg` | `8.22.0` |
| Cloudflare CLI | `wrangler` | `4.114.0` |
| Vite / Workers | `@cloudflare/vite-plugin` | `1.47.0` |
| CSS | `tailwindcss` | `4.3.3` |
| headless UI | `@base-ui/react` | `1.6.0` |
| icons | `lucide-react` | `1.27.0` |
| unit tests | `vitest` | `4.1.10` |
| E2E | `@playwright/test` | `1.62.0` |

TypeScript 7 は周辺パッケージの peer dependency と Cloudflare build を scaffold 時に確認する。互換性に問題があれば 2026-07-26 時点の最新対応版へ下げ、その理由を本 ADR に追記する。

## 判断一覧

### pnpm workspace + Turborepo — 採用（共通）

pnpm は workspace と content-addressable store を持ち、複数アプリと共有 package を軽く管理できる。Turborepo はタスク依存と cache に責務を絞れ、Nx や Bazel より初期設定が小さい。

- 採用理由: Web/API/contracts/db/modules を同じ lockfile と型で扱える。
- 不採用: npm workspace は可能だが、workspace 運用と省ディスクを pnpm に統一する。Nx/Bazel はこの規模の初期 MVP には運用面が大きい。
- 根拠: [pnpm](https://pnpm.io/)、[Turborepo support policy](https://turborepo.dev/docs/support-policy)

### TanStack Start / Router / Query / Form — 採用（共通、一部 Aimani AI 固有）

Router の path/search params の型安全、loader と Query の接続、Vite ベースの SSR、Server Function を一貫して使える。Router 依存を `routes` に限定し、ドメインの実体は `features` に置く。

- Start: public Web Worker と同一 origin BFF。認証 cookie の終端と SSR を担う。
- Router: URL 契約、`validateSearch`、loader、pending/error boundary。
- Query: API 由来の server state。loader の `ensureQueryData` と Page の `useSuspenseQuery` で同じ query options を使う。
- Form: headless で型付きのフォーム状態。UI は Base UI と自前 CSS に委ねる。
- 不採用: Next.js は App Router/RSC と Vercel 寄りの実行モデルが今回の Cloudflare/Worker 分離方針より大きい。React Router SSR は有力だが Router/Search の型統合と既存 PoC の知見を優先する。
- 注意: `@tanstack/start` ではなく `@tanstack/react-start` を使う。React Server Components は初期採用しない。
- 根拠: [Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)、[Router](https://tanstack.com/router/latest/docs/quick-start)、[Query](https://tanstack.com/query/latest/docs/framework/react/overview)、[Form](https://tanstack.com/form/latest/docs/overview)

### public Web Worker + private Hono API Worker — 採用（Aimani AI 固有）

Web と API を Service Binding で接続する。API Worker は公開 route を持たず、Web Worker だけがブラウザから見える。

- 採用理由: SSR/BFF と業務 API の責務を分け、将来 Webhook Worker や別クライアントを追加しやすい。
- Hono RPC: API の `AppType` から client を生成し、入力・出力型を monorepo で共有する。
- 制約: Web と API の Hono version を一致させる。route を小さな module に分け、巨大な RPC 型による IDE 遅延を避ける。
- 不採用: Web 側から PostgreSQL へ直接接続しない。Start Server Function と Hono API を同じ用途で二重に作らない。
- 根拠: [Cloudflare Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)、[Hono RPC](https://hono.dev/docs/guides/rpc)

### Better Auth — 採用（共通候補）

framework-agnostic な TypeScript 認証を PostgreSQL 上で使える。Better Authの`User`をOrganizationから独立させ、`Account`はcredentialの意味に予約する。初期は Organization plugin を使わず、自前 Membership でUserとOrganizationを接続する。

- 初期範囲: email/password、session、同一 origin cookie。
- 後回し: SSO、SCIM、MFA、mail verification/reset。
- 不採用: Clerk は初期 UX は速いが認証主体とデータの所有権が外部サービスへ寄る。Supabase Auth は DB 選択と認証選択が結びつく。Auth.js は候補だが Better Auth の typed plugin/API と独立運用を優先する。
- 根拠: [Better Auth repository](https://github.com/better-auth/better-auth)、[Hono integration](https://www.better-auth.com/docs/integrations/hono)

### Awilix — 採用（Aimani AI 固有、使い方は共通化可能）

DI は API の Composition Root だけで使う。root container は stateless dependency、request scope は DB/repository/use case を保持する。strict mode と明示 `register` を使う。

- 採用理由: repository と use case の差し替えを明示し、Worker request 間の状態漏れを防ぐ。
- 禁止: domain/application から container を参照しない。filesystem auto-loading を Workers へ持ち込まない。
- 代替: 手動 Composition Root は小規模なら十分だが、今回の複数 module と request disposal を一箇所で管理するため Awilix を選ぶ。Inversify/TSyringe の decorator/metadata は不要。
- 根拠: [Awilix](https://github.com/jeffijoe/awilix)

### Drizzle ORM + PostgreSQL + Hyperdrive — 採用（共通候補 / 接続先は固有）

PostgreSQL の制約と移植性を保ち、SQL に近い Drizzle で schema/migration/query を記述する。本番 Worker は Hyperdrive binding の connection string を使う。

- 採用理由: 型安全、軽量、SQL と schema が追跡しやすい。User/Membership と Handoff transaction を自然に表せる。
- 接続先: PlanetScale Postgres Tokyo を第一候補とする。preview 前に価格、リージョン、バックアップ、Hyperdrive 接続を再確認する。Supabase/Neon も代替可能。
- 不採用: D1 は SQLite であり、今回の PostgreSQL 方針と将来の移植性に合わない。Prisma は edge/runtime と生成 engine の複雑さを避ける。Kysely は優れた query builder だが migration/schema の一体感を Drizzle に寄せる。
- 制約: 長時間 transaction を作らない。初期は Hyperdrive query cache を無効にし、整合性を優先する。
- 根拠: [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)、[Hyperdrive](https://developers.cloudflare.com/hyperdrive/)、[Hyperdrive limits](https://developers.cloudflare.com/hyperdrive/platform/limits/)

### Tailwind CSS v4 + Base UI + Lucide — 採用（共通）

Tailwind は token を CSS variable として表現し、Base UI は Dialog/Menu/Tabs 等の挙動とアクセシビリティに限定する。Lucide でアイコンの語彙を統一する。

- 採用理由: CSS の所有権を Aimani AI に残しながら、keyboard/focus/ARIA の primitive を一から作らずに済む。
- 不採用: shadcn/ui は出発点として有効だが、既製の見た目とコピーが設計判断を引っ張りやすい。Radix を個別に組むより Base UI の統一 API を選ぶ。MUI は既存製品で有効だったが、新規の固有デザインには runtime/style layer が大きい。
- 原則: Base UI は必要な primitive だけ導入する。汎用 component catalog を先に作らない。
- 根拠: [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)、[Base UI](https://base-ui.com/react/overview/about)、[Lucide](https://lucide.dev/)

### Vitest + Playwright — 採用（共通）

Vitest は Vite の変換・設定と揃え、Playwright は一つの主要ジャーニーをブラウザで守る。

- 初期テストは四つに限定する。coverage gate を置かない。
- 不採用: Jest は既存資産がある場合の選択肢だが、新規 Vite 構成では Vitest の方が設定が小さい。Cypress ではなく Playwright を選び、Chromium 以外を後から加えられるようにする。
- 根拠: [Vitest features](https://vitest.dev/guide/features)、[Playwright browsers](https://playwright.dev/docs/browsers)

## Cloudflare 実装上の注意

- `nodejs_compat` と compatibility date を明示する。
- Node.js API は完全互換ではないため、利用 package は local `wrangler dev` だけでなく production build で確認する。
- 選定基準日は 2026-07-26 だが、ローカル workerd の対応上限に合わせ、Web/API の compatibility date は 2026-06-24 とする。
- Service Binding の呼び出しも Worker invocation/subrequest の上限に含まれる。
- API request 中に長時間の処理を行わない。必要性が出た時点で Queue/別 Worker を判断する。
- 外部 Cloudflare/DB resource は、ローカルで Todo/Handoff が触れるまで作成しない。

根拠: [Workers Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)、[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

## 再評価トリガー

- TypeScript 7 または TanStack Start RC の互換問題で開発体験が悪化した。
- Hono RPC の型計算が実用上遅くなった。
- Better Auth と Hyperdrive の session 接続に安定性問題が出た。
- Service Binding を跨ぐ構成がローカル開発を大きく遅くした。
- 実際のユーザージャーニーが Server Function だけで十分だと判明した。
