import type { AssignedTodoWorkspace, TodoHandoffWorkspace } from '@aimani-ai/contracts';

export type TodayWorkspace = {
  organization: AssignedTodoWorkspace['organization'];
  currentMember: AssignedTodoWorkspace['currentMember'];
  incomingRequests: TodoHandoffWorkspace['incomingRequests'];
  ownedTodos: AssignedTodoWorkspace['todos'];
  outgoingRequests: TodoHandoffWorkspace['outgoingRequests'];
  recentHandoffs: TodoHandoffWorkspace['recentHandoffs'];
};

export function isTodoWaitingOnRecipient(todo: AssignedTodoWorkspace['todos'][number]) {
  return todo.pendingHandoff !== null;
}

export function acceptedHandoffAnnouncement(recipientName: string, nextAction: string | null = null) {
  const moved = `${recipientName}さんへ責任が移りました。`;
  return nextAction ? `${moved}次の一手: ${nextAction}` : moved;
}

export function composeTodayWorkspace(
  assignedWorkspace: AssignedTodoWorkspace,
  handoffWorkspace: TodoHandoffWorkspace,
): TodayWorkspace {
  return {
    organization: assignedWorkspace.organization,
    currentMember: assignedWorkspace.currentMember,
    incomingRequests: handoffWorkspace.incomingRequests,
    ownedTodos: assignedWorkspace.todos.filter((todo) => !isTodoWaitingOnRecipient(todo)),
    outgoingRequests: handoffWorkspace.outgoingRequests,
    recentHandoffs: handoffWorkspace.recentHandoffs,
  };
}
