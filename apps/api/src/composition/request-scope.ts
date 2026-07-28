import { asFunction, asValue, type AwilixContainer } from 'awilix';
import { HealthCheck, type Clock } from '../application/health-check';
import type { RootContainer, RootCradle } from './root-container';
import type { ApiBindings } from '../config/env';
import { resolveDatabaseUrl } from '../config/env';
import { createNodePgDatabase, type DatabaseResource } from '@amidala/db/client';
import { createAuth } from '../auth/create-auth';
import { MembershipRepository } from '../infrastructure/db/membership-repository';
import { ListOrganizationMembershipsForUser } from '../application/list-organizations';
import { PeopleRepository } from '../infrastructure/db/people-repository';
import { ListMembersForCurrentOrganization } from '../application/list-people';
import { TodoRepository } from '../infrastructure/db/todo-repository'; import { CreateSharedTodo } from '../application/create-todo'; import { GetSharedTodoWorkspace } from '../application/list-shared-todos';
import { CompleteTodo } from '../application/complete-todo';
import { TodoHandoffRepository } from '../infrastructure/db/todo-handoff-repository'; import { RequestTodoHandoff } from '../application/request-todo-handoff'; import { AcceptTodoHandoff } from '../application/accept-todo-handoff'; import { RejectTodoHandoff } from '../application/reject-todo-handoff'; import { CancelTodoHandoff } from '../application/cancel-todo-handoff'; import { GetTodoHandoffWorkspace } from '../application/get-todo-handoff-workspace'; import { GetAssignedTodoWorkspace } from '../application/get-assigned-todo-workspace';

export interface RequestScopeArgs {
  env: ApiBindings;
  request: Request;
}

export interface RequestCradle extends RootCradle {
  env: ApiBindings;
  request: Request;
  healthCheck: HealthCheck; todoRepository: Promise<TodoRepository>; createSharedTodo: Promise<CreateSharedTodo>; getSharedTodoWorkspace: Promise<GetSharedTodoWorkspace>; completeTodo: Promise<CompleteTodo>; todoHandoffRepository: Promise<TodoHandoffRepository>; requestTodoHandoff: Promise<RequestTodoHandoff>; acceptTodoHandoff: Promise<AcceptTodoHandoff>; rejectTodoHandoff: Promise<RejectTodoHandoff>; cancelTodoHandoff: Promise<CancelTodoHandoff>; getTodoHandoffWorkspace: Promise<GetTodoHandoffWorkspace>; getAssignedTodoWorkspace: Promise<GetAssignedTodoWorkspace>;
  databaseResource: Promise<DatabaseResource>; auth: Promise<ReturnType<typeof createAuth>>; membershipRepository: Promise<MembershipRepository>; listOrganizationMembershipsForUser: Promise<ListOrganizationMembershipsForUser>; peopleRepository: Promise<PeopleRepository>; listMembersForCurrentOrganization: Promise<ListMembersForCurrentOrganization>;
}

export type RequestScope = AwilixContainer<RequestCradle>;

export async function withRequestScope<T>(
  root: RootContainer,
  { env, request }: RequestScopeArgs,
  execute: (scope: RequestScope) => Promise<T>,
): Promise<T> {
  const scope = root.createScope() as RequestScope;
  scope.register({
    env: asValue(env),
    request: asValue(request),
    healthCheck: asFunction(
      ({ clock }: { clock: Clock }) => new HealthCheck(clock),
    ).scoped(),
    databaseResource: asFunction(async ({ env }: { env: ApiBindings }) => {
      const resource = createNodePgDatabase(resolveDatabaseUrl(env));
      try {
        await resource.client.connect();
        return resource;
      } catch (cause) {
        await resource.client.end().catch(() => undefined);
        throw cause;
      }
    }).scoped().disposer(async (resourcePromise: Promise<DatabaseResource>) => { const resource = await resourcePromise; await resource.client.end(); }),
    auth: asFunction(async ({ databaseResource, env }: { databaseResource: Promise<DatabaseResource>; env: ApiBindings }) => { const resource = await databaseResource; return createAuth(resource.database, env); }).scoped(),
    membershipRepository: asFunction(async ({ databaseResource }: { databaseResource: Promise<DatabaseResource> }) => { const resource = await databaseResource; return new MembershipRepository(resource.database); }).scoped(),
    listOrganizationMembershipsForUser: asFunction(async ({ membershipRepository }: { membershipRepository: Promise<MembershipRepository> }) => new ListOrganizationMembershipsForUser(await membershipRepository)).scoped(),
    peopleRepository: asFunction(async ({ databaseResource }: { databaseResource: Promise<DatabaseResource> }) => new PeopleRepository((await databaseResource).database)).scoped(),
    listMembersForCurrentOrganization: asFunction(async ({ peopleRepository }: { peopleRepository: Promise<PeopleRepository> }) => new ListMembersForCurrentOrganization(await peopleRepository)).scoped(),
    todoRepository: asFunction(async ({ databaseResource }: { databaseResource: Promise<DatabaseResource> }) => new TodoRepository((await databaseResource).database)).scoped(),
    createSharedTodo: asFunction(async ({ todoRepository, idGenerator, clock }: { todoRepository: Promise<TodoRepository>; idGenerator: RootCradle['idGenerator']; clock: Clock }) => new CreateSharedTodo(await todoRepository, idGenerator, clock)).scoped(),
    getSharedTodoWorkspace: asFunction(async ({ todoRepository }: { todoRepository: Promise<TodoRepository> }) => new GetSharedTodoWorkspace(await todoRepository)).scoped(),
    completeTodo: asFunction(async ({ todoRepository, clock }: { todoRepository: Promise<TodoRepository>; clock: Clock }) => new CompleteTodo(await todoRepository, clock)).scoped(),
    todoHandoffRepository: asFunction(async ({ databaseResource }: { databaseResource: Promise<DatabaseResource> }) => new TodoHandoffRepository((await databaseResource).database)).scoped(), requestTodoHandoff: asFunction(async ({ todoHandoffRepository, idGenerator, clock }: { todoHandoffRepository: Promise<TodoHandoffRepository>; idGenerator: RootCradle['idGenerator']; clock: Clock }) => new RequestTodoHandoff(await todoHandoffRepository, idGenerator, clock)).scoped(), acceptTodoHandoff: asFunction(async ({ todoHandoffRepository, clock }: { todoHandoffRepository: Promise<TodoHandoffRepository>; clock: Clock }) => new AcceptTodoHandoff(await todoHandoffRepository, clock)).scoped(), rejectTodoHandoff: asFunction(async ({ todoHandoffRepository, clock }: { todoHandoffRepository: Promise<TodoHandoffRepository>; clock: Clock }) => new RejectTodoHandoff(await todoHandoffRepository, clock)).scoped(), cancelTodoHandoff: asFunction(async ({ todoHandoffRepository, clock }: { todoHandoffRepository: Promise<TodoHandoffRepository>; clock: Clock }) => new CancelTodoHandoff(await todoHandoffRepository, clock)).scoped(), getTodoHandoffWorkspace: asFunction(async ({ todoHandoffRepository }: { todoHandoffRepository: Promise<TodoHandoffRepository> }) => new GetTodoHandoffWorkspace(await todoHandoffRepository)).scoped(), getAssignedTodoWorkspace: asFunction(async ({ todoHandoffRepository }: { todoHandoffRepository: Promise<TodoHandoffRepository> }) => new GetAssignedTodoWorkspace(await todoHandoffRepository)).scoped(),
  });

  try {
    return await execute(scope);
  } finally {
    await scope.dispose();
  }
}
