# 公開デモ運用

Aimani AI の公開デモは、チームの作業を眺めて責任を引き継ぐ体験を共有するための環境です。

## 開き方

公開URLを開き、「Acme Studio」を選びます。現在の公開版はログイン情報を必要としません。

https://gs-20260731-aimani-ai-web.masa-nekoshinshi39.workers.dev

過去のローカルDB版で使用したseed accountは、現在の公開版では使用しません。credentialを公開案内へ記載しません。

## データの性質

公開版は、TanStack Start Web Worker内のserver-only mock APIが固定の初期fixtureを返します。PlanetScale、Supabase、D1、Hyperdrive、private API Workerは使用しません。

## リセット方針

操作中の書き込みはWorker isolateのメモリにだけ保持されます。Workerの再起動、再デプロイ、別isolateへの移動で初期状態へ戻り、保存・復元を保証しません。同じisolateを使う別の閲覧者に一時的な入力が見える可能性もあるため、個人情報、顧客情報、秘密情報は入力しないでください。

固定fixtureへ戻す必要がある場合は、直前に検証済みのWeb Workerを再デプロイします。ローカルDB版の`pnpm db:demo:reset`を公開環境へ使いません。

## 現在の3分UIツアー

1. Organizationsで「Acme Studio」を選ぶ。
2. Todayで、自分の手元・依頼中・確認待ち・最近動いた仕事の分け方を見る。
3. Team Workで、田中 彩・佐藤 花子・森 ハルの誰がどの作業を持つかを見る。
4. Peopleから相手を選び、その文脈でTodoを作るか、既存Todoの引き継ぎを依頼する。
5. Handoffで自分からの依頼を確認し、必要なら取り消す。

現在の公開版は田中 彩の固定demo actorです。初期fixtureの依頼先は佐藤 花子で、公開Actor Switchはないため、受領者としての「引き受ける／見送る」はまだ体験できません。このギャップは[ロードマップ Stage 1](../architecture/evolution-roadmap.md#stage-1--再現可能なデモ体験)で管理します。

これは現行UIで可能な確認順であり、Handoff価値が完結する最終デモシナリオではありません。最終シナリオは、受領判断、責任の移動、Today / Team Workへの反映までを3分以内に含めます。

## Process Lab

Process Lab は工程と依存関係を試すための試験機能です。正式な業務データの保管場所ではなく、仮説検証後に削除できる機能として扱います。

認証、永続DB、複数組織などを有効化する条件は[段階的進化ロードマップ](../architecture/evolution-roadmap.md)を参照してください。
