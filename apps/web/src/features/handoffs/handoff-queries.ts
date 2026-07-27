import { queryOptions } from '@tanstack/react-query';
import { getTodoHandoffWorkspace } from './handoffs.functions';
export const todoHandoffWorkspaceKey = (organizationId: string) => ['todoHandoffWorkspace', organizationId] as const;
export const todoHandoffWorkspaceQuery = (organizationId: string) => queryOptions({ queryKey: todoHandoffWorkspaceKey(organizationId), queryFn: () => getTodoHandoffWorkspace({ data: { organizationId } }) });
