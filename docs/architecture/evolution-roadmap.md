# アイマニAI 段階的進化ロードマップ

日付: 2026-08-01
ステータス: 現行方針
対象: アイマニAI、および同じ構成で立ち上げる次のプロダクト

## 結論

これまで検討・実装した認証、PostgreSQL、private API Worker、Hyperdrive、DI、複数組織、Process Labなどは不要ではない。**触れる価値を確かめる公開デモに対して、一度に有効化するには早かった将来 capability** として保持する。

採用判断は「技術的に正しいか」だけでなく、次の条件で行う。

> 利用者価値を一つ増やす最小capability bundleを、一つのvertical sliceとして有効化すること。

説明できない場合は捨てずに保留し、[将来 capability カタログ](deferred-capability-catalog.md)へ戻す。

## 現在地と到達先

### 現在の公開デモ

```text
Browser
  -> TanStack Start Web Worker
  -> server-only mock API
  -> Worker isolate上の固定初期fixture
```

- ログイン不要で、Today / Todo / Handoff / Team Work / People / Process Labを触れる。
- 外部DB、API Worker、Service Binding、Hyperdriveは公開環境で使わない。
- 書き込みは永続化を保証せず、Workerの再起動や更新で初期状態へ戻る。
- 現在のmock stateは閲覧者単位に分離されない共有Workerメモリである。同じisolateでは別閲覧者の操作が混ざり、別isolateでは直前の操作が見えない可能性がある。個人情報や秘密情報は入力させない。

### 製品としての到達先

```text
Browser
  -> TanStack Start Web/BFF Worker
  -> Cloudflare Service Binding
  -> private Hono API Worker
  -> Hyperdrive
  -> dedicated PostgreSQL

shared: contracts / domain language / application ports
API: Better Auth / application services / repositories / DI composition root
```

WebはURL、SSR、Query、画面体験を所有し、APIは認証、組織境界、責任移管、永続化を所有する。UserはOrganizationから独立させ、Membershipで所属とroleを表す。

## ステータスの語彙

| ステータス | 意味 |
|---|---|
| 現在有効 | 公開デモの実行経路に入っている |
| 実装済み・未有効 | ローカル用コードはあるが公開経路では使っていない |
| 設計済み・未作成 | Docsと判断はあるが外部資産や設定を作っていない |
| 導入トリガー待ち | 価値仮説または運用条件が成立した時だけ着手する |
| 実験 | 製品の核と分離し、削除または昇格を選べる |

「未有効」や「トリガー待ち」は不採用を意味しない。

## Stage 0 — 触れる公開デモ（現在）

### 利用者に提供する価値

3分以内に「誰の作業がどこで止まり、誰へ責任を渡すか」を見て、Handoffを依頼できる。

### 維持する範囲

- 1つのデモ組織と固定の初期fixture
- Todo作成・完了、Handoff依頼・依頼者による取消
- TodayとTeam Workによる担当・停滞・次の行動の可視化
- 任意の実験導線としてのProcess Lab。3分デモの完了条件には含めない
- DBを必要としないWeb Worker単独デプロイ

現在の固定demo actorは田中 彩であり、初期fixtureの受領者は佐藤 花子である。公開版にActor Switchがないため、受領者としての受入・見送りは現在のUIから体験できない。これはStage 1で解消する明示的なUXギャップである。

### 出口条件（現在一部未達）

- 初見の利用者が説明なし、または短い案内だけで主要導線を触れる。
- desktopとmobileで主要操作が画面外へ失われない。
- 初期fixtureとproduction bundleにcredential、個人情報、他製品のDB設定が含まれない。

公開URLでは既に入力操作を提供しているため、閲覧者ごとのstate分離トリガーは成立済みである。広くURLを共有し続ける前の優先対応とし、それまでは公開案内で共有memoryの既知リスクを明示する。

### この段階では行わないこと

- 外部DBの契約・作成
- 本番認証の有効化
- API Worker、Hyperdrive、Service Bindingの公開設定
- coverage率や網羅的E2Eを完了条件にすること

## Stage 1 — 再現可能なデモ体験

### 導入トリガー

- 商談、授業、ユーザー観察で同じシナリオを繰り返す。
- 依頼者と受領者の両視点を短時間で見せる必要がある。
- `PROD`というbuild種別と「mockを使う」という製品モードの混同が変更を妨げ始める。

### 実施内容

1. `import.meta.env.PROD`によるmock切替を廃止し、`APP_RUNTIME_MODE=demo|product`のような明示的設定へ置き換える。
2. API clientの呼び先をComposition Rootで選び、route/component/domainへモード分岐を漏らさない。
3. 閲覧者ごとのdemo stateを分離する。browser-local adapterを第一候補とし、SSR/共有要件があれば匿名session + Durable Object等を比較する。
4. 3分以内に「依頼を見る → 引き受ける／見送る → 責任者または状態が変わる → Today / Team Workで結果を見る」を完結できるfixtureと導線を作る。
5. 完結手段としてDemo Actor Switchが必要かを観察結果で決める。代わりに固定demo actorを受領者にした初期fixtureでもよい。Actor Switchを出す場合はcredentialを埋め込まない。
6. 「初期状態へ戻す」を画面から実行できる必要が出た時だけ、demo repositoryのreset境界を追加する。

### 検証

- demo buildが外部DBやprivate APIなしで動く。
- product buildがmockへ暗黙fallbackしない。
- 2つの独立browser sessionで操作が混ざらない。
- Handoffの受入または見送りと、その後のToday / Team Workまでを3分以内に確認できる。
- Actor Switchを採用する場合、incoming / outgoing / Todayの意味が一貫して変わる。
- reset後に同じ3分シナリオを再現できる。

### 閲覧者ごとのデモ状態

現在の公開デモでは状態が混在し得るため、これを将来候補ではなくStage 1の優先対応とする。最初の候補は、製品経路と分離したbrowser-local demo adapterである。SSRと同じBFF経路、端末間共有、短命sessionが必要なら、匿名session IDとDurable Object等を別途比較する。外部資産を増やす前に、必要な保存期間と共有範囲を決める。

いずれもdomain/applicationのportを実装するadapterとして閉じ、product modeのPostgreSQL repositoryと混ぜない。

## Stage 2 — ローカルで本番経路を完成させる

### 導入トリガー

- 匿名共有デモではなく、利用者ごとのデータを保存する価値が確認できた。
- 再読み込み後の保持、同時更新、組織境界のいずれかが必要になった。

### 実施内容

1. 既存PostgreSQL / Drizzle migrationを空DBから再現する。
2. UI由来のcommand/queryをapplication use caseへ通し、そのrepository portをdemo/PostgreSQL adapterが実装する。
3. 既存Hono API、Awilix request scope、repository adapterをローカル経路で有効化する。
4. Better Auth route/sessionとWebの同一origin proxyを有効化する。
5. User → Organization → Membershipを正本とし、全業務query/commandにorganization境界を適用する。

### 検証

- 空DBへのmigrationと冪等seedが成功する。
- login/logout/session復元が動く。
- Todo/Handoffの主要journeyが再読み込み後も保持される。
- 別ユーザー・別組織IDへの差し替えが拒否される。
- request間でDB clientやprincipalの状態が漏れず、disposerが動く。

### 完了の定義

この段階ではクラウドDBを作らない。ローカルで製品経路と主要UXを一つの縦切りとして確認できればよい。

## Stage 3 — 永続版をCloudflareへ公開する

### 導入トリガー

- 外部利用者が継続して使う日付と責任者が決まった。
- DBの月額費用、削除責任者、データ保持方針に合意した。
- Stage 2の主要journeyがローカルで成立した。

### 実施順

1. 外部資産を作る前に明示的product mode、専用hostを受け取るguard、guarded public migration、wrangler binding templateを実装する。
2. アイマニAI専用PlanetScale PostgreSQLを作り、専用hostnameをguardへ固定する。
3. migration roleとconfirmationを使うguarded migrationでschemaを作る。
4. 最小権限のruntime roleを別に作り、guarded seedで決定論的fixtureを投入する。
5. runtime roleでHyperdriveを作り、初期はquery cacheを無効にする。
6. Hono API Workerを`workers_dev: false`、`preview_urls: false`、public route/custom domainなしのprivate Workerとしてデプロイする。
7. Web WorkerからService Binding `API`を設定し、認証cookieを同一originで終端する。
8. product modeを明示してWebをデプロイする。障害時にmockへ自動fallbackしない。

作業手順の正本は[PlanetScale運用Runbook](../operations/planet-scale-runbook.md)と[PlanetScale / Cloudflare DB設計](../superpowers/specs/2026-07-31-planetscale-cloudflare-database-design.md)を使う。Runbook冒頭のactivation blockerが残っている間は外部資産を作らない。

アイマニAIでは、ユーザーが指定したWeb Worker / API Worker分離と、既にある実装を活かすため、この構成を標準とする。次製品でprivate APIの導入トリガーがなく、まだAPI実装もない場合は、単一TanStack Start Web/BFF Workerから始め、DB adapterだけをserver-onlyに閉じる選択を認める。

### 検証

- API Workerへ外部から直接アクセスできない。
- Web経由でlogin、Organizations、People、Todo、Handoff、Today、Team Workが動く。
- 再デプロイ後もデータが保持される。
- runtime roleではCRUDが成功し、DDL/dropが失敗する。
- read-after-writeが正しく、接続数とcold startが許容範囲にある。
- 直前のWorker versionへ戻す手順と、DBを残したまま停止する手順が実行可能である。

## Stage 4 — 複数組織とチーム運用

### 導入トリガー

- 同じUserが2つ以上のOrganizationに所属する。
- 組織単位の権限・データ分離が契約上またはUX上必要になる。

### 実施内容

- Membershipによる所属・roleを唯一の組織接続とする。
- 組織選択と切替を追加し、選択後のURLを`/$organizationId/...`で一貫させる。
- Stage 2で成立済みのorganization境界を維持し、複数所属の切替UXとrole運用を追加する。
- Team Workで「誰が、何を持ち、どこで止まり、次に何をするか」を組織単位で示す。

### 検証

- 組織切替後にURL、Query cache、権限、表示データが揃って切り替わる。
- 無所属組織および別組織のresource IDへアクセスできない。
- 一人一組織の利用者には選択UIを強制しない。

## Stage 5 — 外部連携・typed RPC・非同期処理

### 導入トリガー

- Webhook、別クライアント、外部連携、独立したデプロイ責務のいずれかが具体化した。
- 手書きfetch routeが増え、Web–API間のpath/input/output不整合が実害になった。

### 実施内容

- Hono routeを小さなmoduleに保ち、module単位の`AppType`とRPC clientを導入する。
- Webhookは最初はAPI Workerの明示routeとして追加する。負荷・secret・再試行責務が分かれた時だけ専用Webhook Workerへ分離する。
- 長時間処理や再試行が必要になった時にQueueを検討する。
- Awilixはrepository/use case/request resourceが手動factoryでは読みにくくなった範囲に限定する。

### 検証

- 存在しないpathや不正なinputが型またはschema検証で止まる。
- Hono versionをWeb/APIで一致させ、巨大なRPC型でIDEを遅くしない。
- Webhookの署名検証、冪等性、再試行方針を入口ごとに確認する。

## Stage 6 — 検証機能の昇格

### Process Lab

Process Labは既に独立した縦切りとして実装されているが、正式なドメインではなく実験である。3件程度の利用観察で「Todo一覧では工程の前後関係や待ちが分からない」が繰り返された場合だけ、製品機能へ昇格する。

昇格時は次を行う。

- 業務用語でbounded context名を付け直す。
- 現在のDB/API経路を本番で有効化する。
- cycle、self-loop、孤立、組織越境などのgraph invariantを少数のdomain testで守る。
- [Process Lab削除境界](../research/2026-07-28-process-lab-removal.md)を逆に使い、実験名・試験導線を除去する。

価値が確認できなければ同資料の境界で削除し、Today / Handoffの核を残す。

## 横断プラクティスの入れ方

調査、Docs、レビュー、テストは独立した巨大フェーズにしない。各Stageへ次の最小単位で差し込む。

| プラクティス | 実施する時 | 成果物 |
|---|---|---|
| 調査 | Cloudflare/Auth/DB/課金など変動・不可逆領域を決める直前 | 選択、見送る理由、撤退条件。30〜60分を初期timeboxとし、安全上の未解消リスクは合意を得て延長する |
| ADR | 複数製品へ効く判断、外部資産、後戻りコストがある判断 | 1つの決定と再評価トリガー |
| 設計Docs | 複数層にまたがる縦切りを実装する前 | 境界、データフロー、完了条件 |
| レビュー | 動くvertical sliceの後、公開前、高blast-radius変更 | 具体的な修正または判断記録 |
| テスト | 壊れやすい業務規則、組織越境、公開主要journey | 変更リスクに合う最小の1層。公開主要journeyだけbrowser smoke |
| Handoff | 担当交代または作業停止時 | 現在地、再開手順、未決事項 |

coverage率は目標にせず、ユーザーが触れるhappy path、Handoffの状態遷移、組織境界、公開smokeを優先する。

## 次の一手を選ぶゲート

課金、外部資産、個人データ、認証、不可逆変更を伴うStageへ進む前に、次の5問へ答える。

1. 利用者が新しくできることは何か。
2. 現在の簡単な構成では何が具体的に困るか。
3. 作成する外部資産、費用、削除責任者は明確か。
4. 最小の検証と撤退方法は何か。
5. この判断を次のプロダクトでも再利用できる形で残したか。

一つでも答えられない場合は、実装を始めずcapabilityカタログに保持する。ローカルで削除可能なUX実験は例外とし、「利用者が新しくできること」「timebox」「削除境界」の3点があれば始めてよい。

## Docsの更新責務

- ADRは決定時点の記録として原則変更せず、訂正や優先ADRへのリンクだけを追記する。
- このロードマップは現在Stage、Stageの順序、到達条件を所有する。
- capabilityカタログは各項目の実装状態、導入トリガー、参照資料を所有する。
- 詳細spec、plan、research、handoffは履歴資料とし、現在地の正本にしない。
