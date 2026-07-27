import { queryOptions } from '@tanstack/react-query';
import { getAssignedTodoWorkspace } from './todos.functions';
export const assignedTodoWorkspaceKey = (organizationId: string) => ['assignedTodos', organizationId] as const;
export const assignedTodoWorkspaceQuery = (organizationId: string) => queryOptions({ queryKey: assignedTodoWorkspaceKey(organizationId), queryFn: () => getAssignedTodoWorkspace({ data: { organizationId } }) });
