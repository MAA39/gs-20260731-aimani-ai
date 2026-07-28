import type { AssignedTodoWorkspace, TodoHandoffWorkspace } from '@amidala/contracts';

export type TodayWorkspace = {
  organization: AssignedTodoWorkspace['organization'];
  currentMember: AssignedTodoWorkspace['currentMember'];
  incomingRequests: TodoHandoffWorkspace['incomingRequests'];
  ownedTodos: AssignedTodoWorkspace['todos'];
  outgoingRequests: TodoHandoffWorkspace['outgoingRequests'];
  recentHandoffs: TodoHandoffWorkspace['recentHandoffs'];
};

export function composeTodayWorkspace(
  assignedWorkspace: AssignedTodoWorkspace,
  handoffWorkspace: TodoHandoffWorkspace,
): TodayWorkspace {
  return {
    organization: assignedWorkspace.organization,
    currentMember: assignedWorkspace.currentMember,
    incomingRequests: handoffWorkspace.incomingRequests,
    ownedTodos: assignedWorkspace.todos.filter((todo) => todo.pendingHandoff === null),
    outgoingRequests: handoffWorkspace.outgoingRequests,
    recentHandoffs: handoffWorkspace.recentHandoffs,
  };
}
