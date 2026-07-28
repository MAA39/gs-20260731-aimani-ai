import type { TodoSummary } from '@amidala/contracts';
import { useRef } from 'react';
import { RequestTodoHandoffDialog } from '../handoffs/RequestTodoHandoffDialog';
import { TodoCard } from './TodoCard';

export function AssignedTodoCard({ todo, organizationId, currentMembershipId }: { todo: TodoSummary; organizationId: string; currentMembershipId: string }) {
  const actionRef = useRef<HTMLDivElement>(null);
  const action = todo.pendingHandoff ? <div className="todo-handoff-action" ref={actionRef} tabIndex={-1} aria-live="polite"><span className="handoff-pending">引き継ぎを依頼中</span><span>{todo.assignee.name} → {todo.pendingHandoff.recipient.name}</span>{todo.pendingHandoff.requestMessage ? <small>依頼メッセージ: {todo.pendingHandoff.requestMessage}</small> : null}</div> : <div className="todo-handoff-action" ref={actionRef} tabIndex={-1}><RequestTodoHandoffDialog organizationId={organizationId} todo={todo} currentMembershipId={currentMembershipId} onRequested={() => actionRef.current?.focus()} /></div>;
  return <TodoCard todo={todo} action={todo.assignee.membershipId === currentMembershipId ? action : undefined} />;
}
