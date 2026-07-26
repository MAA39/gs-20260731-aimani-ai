import { createServerFn } from '@tanstack/react-start';
import { createSharedTodoFromApi, getSharedTodoWorkspaceFromApi } from './todos.server';
import { createSharedTodoInputSchema, personTodoPathInputSchema } from './todo-schema';
import { assignedTodoWorkspaceInputSchema } from './todo-schema';
import { getAssignedTodoWorkspaceFromApi } from './todos.server';

export const getSharedTodoWorkspace = createServerFn({ method: 'GET' })
  .validator(personTodoPathInputSchema)
  .handler(({ data }) => getSharedTodoWorkspaceFromApi(data));

export const createSharedTodo = createServerFn({ method: 'POST' })
  .validator(createSharedTodoInputSchema)
  .handler(({ data }) => createSharedTodoFromApi(data));

export const getAssignedTodoWorkspace = createServerFn({ method: 'GET' })
  .validator(assignedTodoWorkspaceInputSchema)
  .handler(({ data }) => getAssignedTodoWorkspaceFromApi(data));
