import { Link } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import type { TeamWorkOverviewResult } from './team-work-schema';
import { TeamWorkTodoCard } from './TeamWorkTodoCard';

export function TeamWorkPage({
  organizationId,
  result,
  retry,
}: {
  organizationId: string;
  result: TeamWorkOverviewResult;
  retry?: () => void;
}) {
  if (result.status !== 'ok') return <TeamWorkLoadFailure result={result} retry={retry} />;

  const { overview } = result;
  return (
    <section className="content team-work-page">
      <header className="people-context team-work-header">
        <div>
          <p className="eyebrow">{overview.organization.name}</p>
          <h2>チームのボール</h2>
          <p>誰がどの仕事を持ち、どこで止まっているかを確認できます。</p>
        </div>
      </header>

      {overview.members.length ? (
        <div className="team-work-groups">
          {overview.members.map(({ member, openTodos }) => {
            const headingId = `team-work-member-${member.membershipId}`;
            return (
              <section className="team-work-member" aria-labelledby={headingId} key={member.membershipId}>
                <div className="section-heading team-work-member-heading">
                  <div>
                    <h3 id={headingId}>{member.name}</h3>
                    <p>{member.title ?? '役割を未設定'}</p>
                  </div>
                  <span className="team-work-count">{openTodos.length}件</span>
                </div>
                <div className="todo-list">
                  {openTodos.map((todo) => <TeamWorkTodoCard todo={todo} key={todo.todoId} />)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="empty-surface team-work-empty">
          <h3>いまチームが持っているボールはありません</h3>
          <p>Peopleから相手を選び、共有Todoを作れます。</p>
          <Link className="secondary-button" to="/$organizationId/people" params={{ organizationId }}>Peopleを見る</Link>
        </div>
      )}

      {overview.recentlyCompletedTodos.length ? (
        <section className="team-work-recent" aria-labelledby="team-work-recent-heading">
          <div className="section-heading team-work-member-heading">
            <div>
              <h3 id="team-work-recent-heading">最近完了</h3>
              <p>チームで最近完了したTodo</p>
            </div>
          </div>
          <div className="todo-list">
            {overview.recentlyCompletedTodos.map((todo) => <TeamWorkTodoCard todo={todo} key={todo.todoId} />)}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function TeamWorkLoadFailure({
  result,
  retry,
}: {
  result: Exclude<TeamWorkOverviewResult, { status: 'ok' }>;
  retry?: () => void;
}) {
  const title = result.status === 'forbidden'
    ? 'この組織では閲覧できません'
    : result.status === 'not_found'
      ? '組織が見つかりません'
      : 'チームのボールを読み込めませんでした';
  return (
    <section className="content">
      <div className="empty-surface">
        <h2>{title}</h2>
        <p>{result.error.message}</p>
        {result.status === 'error' && retry ? (
          <button type="button" className="secondary-button" onClick={retry}>
            <RefreshCw size={16} aria-hidden="true" />再試行
          </button>
        ) : null}
        <Link className="secondary-button" to="/organizations">組織を選び直す</Link>
      </div>
    </section>
  );
}
