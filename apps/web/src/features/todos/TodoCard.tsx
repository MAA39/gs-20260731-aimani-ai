import { CheckCircle2, Circle } from 'lucide-react';
import type { TodoSummary } from '@aimani-ai/contracts';
import type { ReactNode } from 'react';

export function TodoCard({ todo, action }: { todo: TodoSummary; action?: ReactNode }) {
  const createdAt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(todo.createdAt));
  return <article className="todo-card">
    <div className="todo-card-heading"><h3>{todo.title}</h3><span className={`todo-status ${todo.status === 'completed' ? 'is-complete' : ''}`}>{todo.status === 'completed' ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}{todo.status === 'completed' ? '完了' : '未完了'}</span></div>
    {todo.description ? <p className="todo-description">{todo.description}</p> : null}
    <div className="todo-rail" aria-label={`作成者 ${todo.creator.name}、現在の担当 ${todo.assignee.name}`}><span>{todo.creator.name || '不明'}</span><span className="todo-rail-line" aria-hidden="true">→</span><span>{todo.assignee.name || '不明'}</span></div>
    <div className="todo-card-meta"><span>作成者: {todo.creator.name || '不明'}</span><span>担当: {todo.assignee.name || '不明'}</span><time dateTime={todo.createdAt}>{createdAt}</time></div>{action}
  </article>;
}
