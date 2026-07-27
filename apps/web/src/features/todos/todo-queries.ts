import { queryOptions } from '@tanstack/react-query';
import { getSharedTodoWorkspace } from './todos.functions';
import type { PersonTodoPath } from './todo-schema';
export const sharedTodoWorkspaceKey = (organizationId: string, contextMembershipId: string) => ['sharedTodoWorkspace', organizationId, contextMembershipId] as const;
export const sharedTodoWorkspaceOrganizationPrefix = (organizationId: string) => ['sharedTodoWorkspace', organizationId] as const;

export const sharedTodoWorkspaceQuery = (input: PersonTodoPath) =>
  queryOptions({
    queryKey: sharedTodoWorkspaceKey(input.organizationId, input.contextMembershipId),
    queryFn: () => getSharedTodoWorkspace({ data: input }),
  });
