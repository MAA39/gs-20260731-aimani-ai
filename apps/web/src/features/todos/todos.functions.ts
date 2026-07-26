import { createServerFn } from '@tanstack/react-start';
import { createSharedTodoFromApi, getSharedTodoWorkspaceFromApi } from './todos.server';
import { createSharedTodoInputSchema, personTodoPathInputSchema } from './todo-schema';

export const getSharedTodoWorkspace = createServerFn({ method: 'GET' })
  .validator(personTodoPathInputSchema)
  .handler(({ data }) => getSharedTodoWorkspaceFromApi(data));

export const createSharedTodo = createServerFn({ method: 'POST' })
  .validator(createSharedTodoInputSchema)
  .handler(({ data }) => createSharedTodoFromApi(data));
