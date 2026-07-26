import { queryOptions } from '@tanstack/react-query';
import { getSharedTodoWorkspace } from './todos.functions';
import type { PersonTodoPath } from './todo-schema';

export const sharedTodoWorkspaceQuery = (input: PersonTodoPath) =>
  queryOptions({
    queryKey: ['sharedTodoWorkspace', input.organizationId, input.contextMembershipId],
    queryFn: () => getSharedTodoWorkspace({ data: input }),
  });
