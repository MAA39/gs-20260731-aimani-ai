# 将来 capability カタログ

日付: 2026-08-01
ステータス: 継続管理
親資料: [段階的進化ロードマップ](evolution-roadmap.md)

## この資料の目的

過去に「不要だった」と表現した技術・設計・プロセスを、破棄対象ではなく**導入条件がまだ成立していない再利用可能な能力**として保存する。ここでは、コードがあることと公開環境で有効であることを区別する。

すべてを同時に有効化しない。導入トリガーが成立した時、利用者価値を一つ増やす最小capability bundleをvertical sliceとして進める。

## 現在も有効な土台

次は保留項目ではなく、公開デモでも今後の製品経路でも維持する基準である。

| Capability | 現在の状態 | 維持する理由 | 参照 |
|---|---|---|---|
| pnpm monorepo | Web / API / contracts / DBを同じlockfileで管理 | 実行境界を分けながら型・command・履歴を一か所で扱う | [ADR-0001](../decisions/0001-technology-selection-2026-07-26.md) |
| TanStack Routerのtyped route/search | 公開画面で有効 | URL契約、loader、pending/error境界を型付きで扱う | [React/TanStack基準](../standards/react-tanstack-practices.md) |
| `routes` / `features`ハイブリッド | Web実装で有効 | Router依存をroute adapterへ閉じ、画面ロジックとViewを再利用する | [Platform設計](../superpowers/specs/2026-07-26-aimani-ai-platform-design.md) |
| TanStack Startの薄いBFF | Server Functionとserver-only adapterで有効 | browserへsecretやprivate APIを出さず、Query/Routerへデータを渡す | [Platform設計](../superpowers/specs/2026-07-26-aimani-ai-platform-design.md) |
| loader + Query + Suspense | 主要routeで有効 | loaderのprefetchとPageの取得済み前提を同じquery optionsで接続する | [React/TanStack基準](../standards/react-tanstack-practices.md) |
| Effectを外部system同期に限定 | 現行React実装の基準 | server fetchやderived stateをEffectへ置かず、原因のある場所で処理する | [React/TanStack基準](../standards/react-tanstack-practices.md) |

## 技術・アーキテクチャ

| Capability | 現在の状態 | 保持する理由 | 導入トリガー | 前提・順序 | 最小検証 | 参照 |
|---|---|---|---|---|---|---|
| PostgreSQL | schema/repository/migrationを実装済み。公開版では未使用 | 永続性、同時更新、組織境界、責任移管transactionを表現する | 再読み込み後の保持、複数利用者、同時更新のいずれかが必要 | UXで最小集約を確定 → local Postgres → 外部Postgres | 空DB migration、FK/unique、Handoff競合、組織境界 | [Auth/Postgres/DI調査](../research/2026-07-26-auth-postgres-di.md) |
| Drizzle ORM | schema/query/migrationを実装済み。公開版では未使用 | SQLに近い型付きschemaとmigrationを保つ | PostgreSQL経路を有効化する時 | domain/applicationへDrizzle型を漏らさずrepository adapterに閉じる | 空DB再現、生成SQL/index確認、repository integration | [ADR-0001](../decisions/0001-technology-selection-2026-07-26.md) |
| Better Auth | API/Web実装済み。公開版は認証なし・固定demo actor | 実User、session、同一origin cookie、将来のaccount接続を扱う | 利用者ごとのデータを保存する時 | Postgres → API composition → auth schema/secret/origin → session → membership認可 | login/logout、cookie、未認証・他組織拒否 | [Auth/Postgres/DI調査](../research/2026-07-26-auth-postgres-di.md) |
| private Hono API Worker | APIコードを実装済み。公開資産は未デプロイ | secret/DB/業務APIの所有者を分け、Webhookや別clientへ拡張できる | アイマニAIの永続product mode、または外部入口・DB責務独立・別clientが具体化 | Web内use caseをport化 → API deploy → private化 | `workers_dev:false`と`preview_urls:false`、public routeなし、外部直アクセス不能、Web経由journey | [Platform設計](../superpowers/specs/2026-07-26-aimani-ai-platform-design.md) |
| Service Binding | local構成とadapterを実装済み。公開Webにはbindingなし | public Web/BFFとprivate APIをCloudflare内部で接続する | API Workerを公開経路に戻す時 | API名/date/cookie転送を確定 → API → binding → Webの順にdeploy | cookie/Set-Cookie、障害時503、API非公開 | [deployment](../operations/deployment.md) |
| Hono client / RPC | 部分実装。`AppType`とclientはあるがvalidator構成が不完全で、`as unknown as`とraw fetchが残る | path/input/outputの不整合をcompile timeで減らす | route数が増え、手書きfetchの不整合が実害になる | validatorで入力宣言 → 小さいmodule単位AppType → client | typo/body不整合がcompile errorになり、transport境界の二重castを原則0件にする | [ADR-0001](../decisions/0001-technology-selection-2026-07-26.md) |
| Awilix request scope DI | APIで実装済み。公開版はAPI自体を迂回 | repository/use case/request resourceの生成とdisposeを集約する | 手動factoryが読みにくい、request resourceが複数になる | portを先に定義し、container参照をComposition Rootだけに置く | request間状態漏れなし、dispose、adapter差替え | [DI計画](../superpowers/plans/2026-07-26-api-request-scoped-di.md) |
| DDD / CQRS-lite | Handoff等で一部実装済み | 業務語彙と不変条件をUI/DBから独立させ、複数入口で再利用する | 同じ規則を複数画面・API・Webhookから使う | domain language → use case → repository port → adapter | 少数のdomain testで主要不変条件、全入口が同じuse caseを通る | [命名基準](../standards/domain-language-and-naming.md) |
| full Event Sourcing | **現行方針では不採用。例外的再評価のみ** | 通常のtransaction recordで足りない場合の判断跡を残す | 法的監査、時点復元、event replayのすべてが必須要件になる | 別ADRで再選定し、event schema/retention/削除/運用コストを先に設計 | replay、schema evolution、個人データ削除、障害復旧 | [再利用基準](../standards/reusable-product-baseline.md) |
| 明示的runtime mode | 未実装。現在は`import.meta.env.PROD`でmock選択 | build環境と製品モードを分け、意図しないmock fallbackを防ぐ | DB/API版を再有効化する前 | `demo` / `product`を設定 → Composition Rootでadapter選択 | productで設定不足ならfail closed、demoだけmock | [ロードマップ Stage 1](evolution-roadmap.md#stage-1--再現可能なデモ体験) |
| 閲覧者ごとのdemo state | **優先対応・トリガー成立済み**。現在は共有isolate memory | 他の閲覧者の操作との混在を防ぎ、観察シナリオを再現する | 公開URLで入力操作を既に提供している | 保存期間と共有範囲を決定 → browser-local adapterを第一候補 → SSR/共有が必要なら匿名session + DO等を比較 | 2ブラウザ間で状態非共有、reset、再読み込み方針を説明可能 | [ロードマップ Stage 1](evolution-roadmap.md#stage-1--再現可能なデモ体験) |

## Cloudflare・データベース運用

| Capability | 現在の状態 | 保持する理由 | 導入トリガー | 前提・順序 | 最小検証 | 参照 |
|---|---|---|---|---|---|---|
| PlanetScale PostgreSQL | 設計・Runbook済み。契約・DB作成なし | Cloudflare公開環境の専用永続Postgres候補 | 継続利用者、保存要件、公開日、費用・削除責任者が決まる | local完成 → 課金確認 → 専用DB → migration | CRUD、再deploy後保持、backup/復旧方針 | [DB設計](../superpowers/specs/2026-07-31-planetscale-cloudflare-database-design.md)、[Runbook](../operations/planet-scale-runbook.md) |
| Hyperdrive | connection解決コード済み。binding未作成 | WorkersからPostgresへの接続管理・pooling | private API Workerを本番Postgresへ接続する | DB/runtime role → Hyperdrive → binding。初期cache無効 | Worker CRUD、接続数、cold start、read-after-write | [DB設計](../superpowers/specs/2026-07-31-planetscale-cloudflare-database-design.md) |
| migration/runtime role分離 | 設計済み。外部role未作成 | schema変更権限をruntimeから外し事故範囲を限定する | 初めて外部DBを使う | migration roleでDDL → runtime roleへ必要DMLのみ → Hyperdriveにはruntimeのみ | runtime CRUD成功、DDL/drop/別schema失敗 | [Runbook](../operations/planet-scale-runbook.md) |
| production seed guard | 部分実装。provider/port/path/confirmationは検査するが、専用DB hostnameの完全一致は未実装 | 誤ったDB、特に他製品DBへのseed/resetを防ぐ | 共有preview/demo DBへfixtureを入れる | DB作成後にexpected hostnameを固定 → 完全一致検査 → migration → 冪等seed | localhost、他provider、別PlanetScale DB、誤tokenを拒否し、専用DBだけ許可 | [公開計画](../superpowers/plans/2026-07-31-planetscale-cloudflare-public-launch.md) |
| guarded public migration | 未実装。現在の`db:migrate`はURL存在確認だけ | seedより先に誤DBへDDLを適用する事故を防ぐ | 外部PostgreSQLへ初回migrationする前 | seed guardと同じprotocol/host/port/path/TLS/confirmation検査 → migration roleで実行 | 別PlanetScale DBと誤confirmationでDDL前に失敗 | [Runbook](../operations/planet-scale-runbook.md) |
| PlanetScale運用Runbook | 草案済み・未実行。activation blockerあり | 課金、secret、migration、停止・削除を人間が安全に再現する | blocker解消後のStage 3着手時 | 公式仕様と画面価格を直前再確認し、専用資産だけ操作 | dry-run、smoke、rollback/停止、削除対象照合 | [Runbook](../operations/planet-scale-runbook.md) |
| 専用Webhook Worker | 未実装。Webhook自体も未要件 | 外部入口をWeb/API本体から独立して運用できる | Webhook量、secret、再試行、障害範囲を分ける必要が出る | まずprivate API内route → 必要時Worker分離 → Queue検討 | 署名、冪等性、再試行、dead-letter/監視 | [ロードマップ Stage 5](evolution-roadmap.md) |

PlanetScaleは2026-07-31時点の第一候補であり、契約時点の価格・リージョン・バックアップ・Cloudflare公式接続手順を再調査する。プロバイダ名をdomain/applicationへ漏らさず、PostgreSQL adapterと運用設定だけを交換可能にする。

## プロダクト・UX

| Capability | 現在の状態 | 保持する理由 | 導入トリガー | 前提・順序 | 最小検証 | 参照 |
|---|---|---|---|---|---|---|
| UserとOrganizationの分離 | DB/APIに実装済み。公開版は固定1組織 | 個人のidentityを組織所有にせず、複数所属へ拡張する | 実認証または組織単位のデータ分離を有効化 | User → Organization → Membership → resourceのorganizationId | 無所属/別組織拒否、User削除/所属変更の意味 | [Identity設計](../superpowers/specs/2026-07-27-identity-people-vertical-slice-design.md) |
| 組織選択・複数組織 | UI/APIの基礎あり。公開fixtureは1組織 | 一人が複数workspaceを使える | 同じUserが2組織以上に所属する | 認証 → Membership → switcher。1組織では省略 | 切替後のURL/cache/権限/表示の一致 | [Identity設計](../superpowers/specs/2026-07-27-identity-people-vertical-slice-design.md) |
| Demo Actor Switch | development専用実装あり。公開版では無効 | 依頼者/受領者の両側を3分デモで見せる | 観察・商談で両視点が理解に必要 | 固定fixture後。credentialをproduction bundleへ入れない | actor切替でToday/incoming/outgoingが反転 | [Actor計画](../superpowers/plans/2026-07-28-demo-actor-switch.md) |
| Process Labの永続化 | DB/API/UIまで実装済み。公開版はmock、機能は実験 | 工程の依存、待ち、担当経路という仮説を検証する | 「一覧では前後関係が分からない」が複数観察で再現 | Today/Handoffの核を先に検証し、別bounded contextとして昇格 | reload保持、cycle/self-loop/組織越境拒否、mobile | [設計](../superpowers/specs/2026-07-28-process-lab-design.md)、[削除境界](../research/2026-07-28-process-lab-removal.md) |
| Team Workの運用強化 | 公開画面あり | 「誰の作業が今どこでどうなっているか」を核の価値として磨く | 利用観察で必要な比較軸・停滞理由が得られる | 実データ観察 → 語彙確定 → read model拡張 | 担当、状態、次の行動、待ち理由を一画面で説明できる | [ライフサイクル設計](../superpowers/specs/2026-07-28-work-lifecycle-visibility-design.md) |
| 既存製品UX監査とデザイン基盤 | 監査・foundation作成済み | Aimani AI / BYARDの知見を盲目的に移植せず、継承・再解釈・見送りを説明する | 新しい主要画面または再利用部品を設計する時 | 既存挙動を観察 → 仮説として実画面へ反映 → 再利用判断になった時にDocs更新 | desktop/mobileで触り、採否と理由を残す | [UX監査](../product/legacy-ux-audit.md)、[デザイン基盤](../design/foundation.md) |

## 調査・Docs・レビュー・テスト

これらも不要ではない。ただし、プロダクトを触れる状態にする時間を奪わない予算と実施条件を持たせる。

| Capability | 保持する目的 | 実施トリガー | 軽量な運用 | 完了の判断 | 参照 |
|---|---|---|---|---|---|
| 技術調査 | 古い知識、外部仕様変更、課金による手戻りを減らす | Cloudflare/Auth/DB等の変動領域、未知library、課金・不可逆判断 | 実装直前の30〜60分を初期timeboxにし、一次情報から「選択・見送り理由・撤退条件」を残す。安全上の未解消リスクは合意を得て延長する | 実装判断に必要な不確実性が減ったら止める | [Research Gate](../standards/research-before-build.md) |
| 設計Docs / ADR | 判断を他製品へ再利用し、担当交代後も理由を辿る | 複数製品へ効く判断、複数層変更、外部資産、後戻りコスト | 動くvertical sliceの前後で短く更新。現行コードと日付へリンク | 現在地、決定、再評価条件が一読で分かる | [Docs index](../README.md) |
| 詳細実装計画 | 複数層の変更順と検証を安全に共有する | 1セッションを超える、複数agent/担当者、外部操作がある | 小さなslice単位。完了後は履歴とし、現行指示はroadmap/ADRへ圧縮 | 実装者が追加質問なしに次のsliceを開始できる | [plans](../superpowers/plans/) |
| Handoff文書 | 揮発する会話を担当交代時に保存する | 実際の担当交代、長期停止、環境依存手順が残る | 作業中は作らず、停止点で現在地・再開・未決だけを書く | 新担当が同じ調査をやり直さず再開できる | [HANDOFF最終版](../HANDOFF-CLAUDE-2026-07-28.md) |
| AI/人間レビュー | ドメイン境界、公開事故、統合不良を別視点で見つける | 動くPR、公開前、高blast-radius変更 | 原則30分以内。計画の言い換えではなく具体的な欠陥・選択肢を求める | 採否を決められる具体事項が得られたら終了 | [再利用基準](../standards/reusable-product-baseline.md) |
| テスト | Handoff遷移、組織越境、graph invariantなど壊れやすい価値を守る | 条件分岐が増える、同じ不具合が再発、公開journeyを変更 | 変更リスクに応じ、happy path / pure domain / API integrationのうち最小の1層を選ぶ。公開主要journeyだけbrowser smoke、coverage gateなし | 重大な回帰を短時間で検知できる | [React/TanStack](../standards/react-tanstack-practices.md) |
| 名称移行 | UI、repo、package、Worker、URLの公開ブランドを揃える | 初回公開前、商標・意味の問題、正式改称 | 公開名を凍結して一度に実施。旧名は出典説明だけに残す | HTML title、UI、repo、package、Worker、Docsリンクが一致 | [公開計画](../superpowers/plans/2026-07-31-aimani-ai-public-launch.md) |

## 既存資料の扱い

- `docs/architecture/`と`docs/decisions/`を現在の判断の正本とする。
- `docs/superpowers/specs/`は採用済み設計または設計時点の根拠、`plans/`は実装履歴として残す。
- `docs/research/`は調査時点を必ず読み、外部仕様を有効化する直前に一次情報で再確認する。
- `HANDOFF-*`はその時点の履歴であり、現在の作業指示として使わない。
- 旧製品名は出典や移行履歴を説明する時だけ保持する。公開UI、実行資産、現行コマンドには現行名を使う。
- 90日ごと、または次製品へコピーする時に、重複資料を正本へ圧縮する。判断根拠そのものは削除せずGit履歴から辿れる状態を保つ。

ADRは決定時点の記録、このカタログはcapabilityの状態とトリガー、ロードマップは現在Stageと順序を所有する。重複箇所を更新する場合は、この所有関係を優先する。

## capability追加テンプレート

新しい候補は次の形でこのカタログへ追加する。

```text
Capability:
利用者が新しくできること:
現在の状態:
導入トリガー:
前提:
実装順:
最小検証:
撤退・削除方法:
一次情報と既存Docs:
```
