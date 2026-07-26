# Domain Language and Naming Standard

基準日: 2026-07-27  
対象: Amidala v2 と、同じ構成で立ち上げる今後のプロダクト

## 目的

画面、会話、application use case、型、DBで同じ概念に同じ名前を使う。DDDの構造を増やすことではなく、プロダクトの意図をコードから読めることを目的にする。

## 命名する順番

1. 既存プロダクト、ユーザー調査、仕様からプロダクトの言葉を集める。
2. 語彙表で意味・境界・似た語との違いを確定する。
3. 期待する振る舞いをテストリストへ書く。
4. application use case、domain type、API DTO、DBの順で同じ言葉を通す。
5. 実装後に、名前だけを読んで処理の目的を説明できるかレビューする。

技術を先に選んで `data`、`service`、`manager`、`utils` のような名前を付けない。`db`も「接続資源」「Drizzle database」「repository」のどれを指すか分ける。

## 境界

- Domain / applicationでは、業務上の名詞と動詞を使う。
- Infrastructure / composition / adapterでは、`DatabaseResource`、`ApiBindings`、`RequestScope`のような技術語を使ってよい。
- UIの表示語と内部の安定した識別子は分ける。例: People画面の一人は、組織内profileを返すAPIでは`MemberSummary`とする。
- 型がすでに示す情報を名前へ重複させない。一方、`OrganizationOption`のようにMembership情報を隠す短縮はしない。
- `any`で意味を消さない。外部ライブラリの型境界で避けられない場合は一箇所へ閉じ、理由を書く。

## Amidala v2の語彙

| 語 | 意味 | 使わない意味 |
| --- | --- | --- |
| User | 組織に依存しない認証主体 | 組織内の役割・表示profile |
| Account | Better Authのcredential | 人、契約企業 |
| Organization | 人が参加するworkspace / tenant | 認証主体 |
| Membership | UserとOrganizationを結ぶ組織内profile | credential |
| CurrentMembershipContext | session Userと検証済みMembershipから作る認可文脈 | ブラウザ入力のidentity |
| Relationship | 同じOrganizationのMembership間の関係 | Organizationをまたぐ関係 |
| MemberSummary | People画面へ返す組織内の人の要約 | グローバルUserの全情報 |
| TodoHandoff | 現在担当者が引き継ぎ先へTodo担当の移管を依頼し、受諾・見送り・取消のいずれかで終わる記録 | 汎用workflow、即時の担当上書き |
| requester Membership | TodoHandoffを依頼した時点の現在担当 | credential User、常に現在担当であり続ける人 |
| recipient Membership | TodoHandoffを引き受けるか見送る人 | accept前のTodo担当者 |

`manager_report`はsource Membershipがmanager、target Membershipがdirect reportである有向関係とする。画面ラベルは翻訳辞書で「直属の部下」等に変換し、DB値を直接表示しない。Membership statusは`active | invited | suspended`を正本とする。

TodoHandoffの公開ユースケースは`RequestTodoHandoff`、`AcceptTodoHandoff`、`RejectTodoHandoff`、`CancelTodoHandoff`とする。acceptだけがTodo担当を変更するため、`DecideHandoff(decision)`や`UpdateStatus`へ副作用の差を隠さない。Organization内のactorに`UserId`を使わずMembership IDを使う。

read use caseは、返すworkspaceと対象を名前へ残す。`GetTodoHandoffWorkspace`は`TodoHandoffWorkspace`を、`GetAssignedTodoWorkspace`は`AssignedTodoWorkspace`を返す。汎用`GetHandoffWorkspace`や、workspaceを返すのに`ListAssignedTodos`とは呼ばない。

## テストとの関係

テスト数やcoverageを目的化しない。先に重要な振る舞いをリスト化し、ひとつを実行可能なテストにし、通した後で命名と構造を整える。今回のIdentity → Peopleでは「別OrganizationのPeopleを読めない」を最初のintegration testとする。

## 過剰設計を避ける

- 実際の振る舞いがないAggregate、Value Object、Domain Event、Repository interfaceを先に作らない。
- 重複は抽象化の命令ではなく、調査・リファクタリングの手掛かりとして扱う。
- CQRS / Event Sourcingは必要なread/write差や履歴要件が現れるまで導入しない。

## 根拠

- [t-wada: 「テスト駆動開発の定義」](https://t-wada.hatenablog.jp/entry/canon-tdd-by-kent-beck) — テストリストから一つずつ振る舞いを固定し、必要に応じてリファクタリングする。早すぎる抽象化を避ける。
- [Eric Evans / Domain Language](https://www.domainlanguage.com/) — domain modelと言語を設計の中心に置く。
- [Google TypeScript Style Guide: Naming](https://google.github.io/styleguide/tsguide.html#naming) — 新しい読者に明確な名前を使い、型が示す情報を重複させない。
- [TypeScript Do's and Don'ts: any](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html#any) — 型情報を失う`any`を避ける。
