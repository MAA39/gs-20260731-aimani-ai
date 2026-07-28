import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { completeTodoResponseSchema, sharedTodoWorkspaceSchema, todoHandoffWorkspaceSchema, todoSummarySchema } from '@amidala/contracts';
import { createApp } from '../app';

const env = {
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: 'integration-secret-at-least-32-chars',
  BETTER_AUTH_URL: 'http://localhost:8787',
};

const memberSchema = z.object({
  membershipId: z.string().min(1),
  name: z.string(),
  title: z.string().nullable(),
});
const handoffSchema = z.object({
  handoffId: z.string().min(1),
  organizationId: z.string().min(1),
  todo: todoSummarySchema,
  requester: memberSchema,
  recipient: memberSchema,
  requestMessage: z.string().nullable(),
  status: z.enum(['requested', 'accepted', 'rejected', 'canceled']),
  requestedAt: z.string(),
  resolvedAt: z.string().nullable(),
});
const resourceSchema = z.object({ handoff: handoffSchema, todo: todoSummarySchema });
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const assignedWorkspaceSchema = z.object({
  organization: z.object({ organizationId: z.string(), name: z.string() }),
  currentMember: memberSchema,
  todos: z.array(todoSummarySchema),
});

type Resource = z.infer<typeof resourceSchema>;
type AssignedWorkspace = z.infer<typeof assignedWorkspaceSchema>;
type HandoffWorkspace = z.infer<typeof todoHandoffWorkspaceSchema>;
type ErrorBody = z.infer<typeof errorSchema>;
type HandoffResponse = {
  status: number;
  handoff?: Resource['handoff'];
  todo?: Resource['todo'];
  error?: ErrorBody['error'];
};

describe('Todo Handoff API', () => {
  const app = createApp();

  const signIn = async (email: string): Promise<string> => {
    const response = await app.fetch(new Request('http://localhost:8787/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'amidala-demo-2026' }),
    }), env);
    expect(response.status).toBe(200);
    return response.headers.getSetCookie().join('; ');
  };

  const createTodo = async (
    cookie: string,
    assigneeMembershipId = 'acme-studio-owner',
  ): Promise<z.infer<typeof todoSummarySchema>> => {
    const response = await app.fetch(new Request('http://localhost:8787/organizations/org_acme_studio/people/acme-studio-sato/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ title: `handoff-${Date.now()}-${Math.random()}`, description: 'handoff integration fixture', assigneeMembershipId }),
    }), env);
    expect(response.status).toBe(201);
    const body = z.object({ todo: todoSummarySchema }).parse(await response.json());
    return body.todo;
  };

  const completeTodo = async (
    cookie: string,
    todoId: string,
    organizationId = 'org_acme_studio',
  ) => {
    const response = await app.fetch(new Request(
      `http://localhost:8787/organizations/${organizationId}/todos/${todoId}/complete`,
      { method: 'POST', headers: { cookie } },
    ), env);
    const body = await response.json();
    return { status: response.status, body };
  };

  const requestHandoff = async (
    cookie: string,
    todoId: string,
    body: { recipientMembershipId: string; requestMessage?: string },
  ): Promise<HandoffResponse> => {
    const response = await app.fetch(new Request(`http://localhost:8787/organizations/org_acme_studio/todos/${todoId}/handoffs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    }), env);
    const parsed = response.status >= 400 ? errorSchema.parse(await response.json()) : resourceSchema.parse(await response.json());
    return response.status >= 400
      ? { status: response.status, error: parsed.error }
      : { status: response.status, handoff: parsed.handoff, todo: parsed.todo };
  };

  const decide = async (
    cookie: string,
    handoffId: string,
    action: 'accept' | 'reject' | 'cancel',
    organizationId = 'org_acme_studio',
  ): Promise<HandoffResponse> => {
    const response = await app.fetch(new Request(`http://localhost:8787/organizations/${organizationId}/handoffs/${handoffId}/${action}`, {
      method: 'POST',
      headers: { cookie },
    }), env);
    const parsed = response.status >= 400 ? errorSchema.parse(await response.json()) : resourceSchema.parse(await response.json());
    return response.status >= 400
      ? { status: response.status, error: parsed.error }
      : { status: response.status, handoff: parsed.handoff, todo: parsed.todo };
  };

  const getAssignedTodos = async (cookie: string): Promise<AssignedWorkspace> => {
    const response = await app.fetch(new Request('http://localhost:8787/organizations/org_acme_studio/todos/assigned-to-me', { headers: { cookie } }), env);
    expect(response.status).toBe(200);
    return assignedWorkspaceSchema.parse(await response.json());
  };

  const getHandoffWorkspace = async (cookie: string): Promise<HandoffWorkspace> => {
    const response = await app.fetch(new Request('http://localhost:8787/organizations/org_acme_studio/handoffs', { headers: { cookie } }), env);
    expect(response.status).toBe(200);
    return todoHandoffWorkspaceSchema.parse(await response.json());
  };

  const getSharedTodos = async (cookie: string) => {
    const response = await app.fetch(new Request('http://localhost:8787/organizations/org_acme_studio/people/acme-studio-sato/todos', { headers: { cookie } }), env);
    expect(response.status).toBe(200);
    return sharedTodoWorkspaceSchema.parse(await response.json());
  };

  it('lets only the current assignee complete an open Todo and removes it from assigned work', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const todo = await createTodo(ownerCookie);
    const completed = await completeTodo(ownerCookie, todo.todoId);
    expect(completed.status).toBe(200);
    expect(completeTodoResponseSchema.parse(completed.body).todo).toMatchObject({ todoId: todo.todoId, status: 'completed', assignee: { membershipId: 'acme-studio-owner' } });
    expect((await getAssignedTodos(ownerCookie)).todos.map((item) => item.todoId)).not.toContain(todo.todoId);
    expect((await getSharedTodos(ownerCookie)).todos.find((item) => item.todoId === todo.todoId)?.status).toBe('completed');
  });

  it('keeps Todo completion idempotent for the assignee and forbidden for another Member', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const moriCookie = await signIn('mori@amidala.local');
    const todo = await createTodo(ownerCookie);
    expect((await completeTodo(moriCookie, todo.todoId)).status).toBe(403);
    expect((await completeTodo(ownerCookie, todo.todoId)).status).toBe(200);
    const repeated = await completeTodo(ownerCookie, todo.todoId);
    expect(repeated.status).toBe(200);
    expect(completeTodoResponseSchema.parse(repeated.body).todo.status).toBe('completed');
  });

  it('does not complete a Todo while its Handoff is waiting for a decision', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const todo = await createTodo(ownerCookie);
    const requested = await requestHandoff(ownerCookie, todo.todoId, { recipientMembershipId: 'acme-studio-mori' });
    const result = await completeTodo(ownerCookie, todo.todoId);
    expect(result.status).toBe(409);
    expect(errorSchema.parse(result.body).error.message).toBe('handoff_pending');
    expect((await getAssignedTodos(ownerCookie)).todos.find((item) => item.todoId === todo.todoId)?.pendingHandoff?.handoffId).toBe(requested.handoff?.handoffId);
  });

  it('does not disclose a Todo through another Organization path', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const northstarCookie = await signIn('suzuki@amidala.local');
    const todo = await createTodo(ownerCookie);
    expect((await completeTodo(northstarCookie, todo.todoId, 'org_northstar_lab')).status).toBe(404);
    expect((await completeTodo(northstarCookie, todo.todoId, 'org_acme_studio')).status).toBe(403);
  });

  it('moves responsibility only when the recipient accepts the Todo Handoff', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const moriCookie = await signIn('mori@amidala.local');
    const todo = await createTodo(ownerCookie);

    const requested = await requestHandoff(ownerCookie, todo.todoId, {
      recipientMembershipId: 'acme-studio-mori',
      requestMessage: '次回の確認をお願いします',
    });
    expect(requested.status).toBe(201);
    expect(requested.handoff).toBeDefined();

    const sharedWorkspace = await getSharedTodos(ownerCookie);
    const listedTodo = sharedWorkspace.todos.find((item) => item.todoId === todo.todoId);
    expect(listedTodo).toBeDefined();
    const pendingHandoff = listedTodo?.pendingHandoff;
    expect(pendingHandoff).not.toBeNull();
    if (!pendingHandoff || !requested.handoff) throw new Error('Expected pending Handoff projection.');
    expect(pendingHandoff.handoffId).toBe(requested.handoff.handoffId);
    expect(pendingHandoff.requester.membershipId).toBe('acme-studio-owner');
    expect(pendingHandoff.recipient.membershipId).toBe('acme-studio-mori');
    expect(pendingHandoff.requestMessage).toBe('次回の確認をお願いします');

    const accepted = await decide(moriCookie, requested.handoff?.handoffId ?? '', 'accept');
    expect(accepted.status).toBe(200);
    expect(accepted.todo?.assignee.membershipId).toBe('acme-studio-mori');

    const retry = await decide(moriCookie, requested.handoff?.handoffId ?? '', 'accept');
    expect(retry.status).toBe(200);
    expect(retry.handoff?.handoffId).toBe(requested.handoff?.handoffId);

    const assigned = await getAssignedTodos(moriCookie);
    expect(assigned.todos.some((item) => item.todoId === todo.todoId)).toBe(true);
  });

  it('serializes competing decisions, rejects another Organization, and allows cancellation', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const satoCookie = await signIn('sato@amidala.local');
    const suzukiCookie = await signIn('suzuki@amidala.local');
    const todo = await createTodo(ownerCookie);
    const requested = await requestHandoff(ownerCookie, todo.todoId, {
      recipientMembershipId: 'acme-studio-sato',
      requestMessage: '',
    });
    expect(requested.handoff).toBeDefined();
    const handoffId = requested.handoff?.handoffId ?? '';

    const sameRequest = await requestHandoff(ownerCookie, todo.todoId, { recipientMembershipId: 'acme-studio-sato' });
    expect(sameRequest.status).toBe(200);
    expect(sameRequest.handoff?.handoffId).toBe(handoffId);

    const forbidden = await decide(suzukiCookie, handoffId, 'accept', 'org_northstar_lab');
    expect(forbidden.status).toBe(404);

    const [accepted, rejected] = await Promise.all([
      decide(satoCookie, handoffId, 'accept'),
      decide(satoCookie, handoffId, 'reject'),
    ]);
    expect([accepted.status, rejected.status].sort()).toEqual([200, 409]);

    const acceptedWon = accepted.status === 200;
    const currentAssigneeCookie = acceptedWon ? satoCookie : ownerCookie;
    const currentAssigneeId = acceptedWon ? 'acme-studio-sato' : 'acme-studio-owner';
    const nextRecipientId = acceptedWon ? 'acme-studio-mori' : 'acme-studio-sato';
    const next = await requestHandoff(currentAssigneeCookie, todo.todoId, { recipientMembershipId: nextRecipientId });
    expect(next.status).toBe(201);
    const nextHandoffId = next.handoff?.handoffId ?? '';

    const canceled = await decide(currentAssigneeCookie, nextHandoffId, 'cancel');
    expect(canceled.status).toBe(200);
    expect(canceled.handoff?.status).toBe('canceled');
    expect((await decide(currentAssigneeCookie, nextHandoffId, 'cancel')).status).toBe(200);

    const rerequested = await requestHandoff(currentAssigneeCookie, todo.todoId, {
      recipientMembershipId: currentAssigneeId === 'acme-studio-sato' ? 'acme-studio-owner' : 'acme-studio-mori',
    });
    expect(rerequested.status).toBe(201);
  });

  it('shows only Handoffs involving the current Member before applying the recent limit', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const fixtureId = randomUUID();
    const db = new pg.Client({ connectionString: env.DATABASE_URL });
    await db.connect();
    try {
      await db.query("delete from todo where id like 'todo-workspace-%'");
      const insertHandoff = async (input: {
        sequence: number;
        requesterMembershipId: string;
        recipientMembershipId: string;
        status: 'requested' | 'rejected';
        resolvedAt?: Date;
      }) => {
        const todoId = `todo-workspace-${fixtureId}-${input.sequence}`;
        const handoffId = `handoff-workspace-${fixtureId}-${input.sequence}`;
        const assigneeMembershipId = input.requesterMembershipId;
        const requestedAt = new Date(Date.UTC(2040, 0, 1, 0, 0, input.sequence));
        await db.query(
          `insert into todo (id, organization_id, context_membership_id, creator_membership_id, assignee_membership_id, title, description, status, created_at, updated_at)
           values ($1, 'org_acme_studio', 'acme-studio-sato', 'acme-studio-owner', $2, $3, null, 'open', $4, $4)`,
          [todoId, assigneeMembershipId, `workspace fixture ${input.sequence}`, requestedAt],
        );
        await db.query(
          `insert into todo_handoff (id, organization_id, todo_id, requester_membership_id, recipient_membership_id, request_message, status, requested_at, resolved_at)
           values ($1, 'org_acme_studio', $2, $3, $4, null, $5, $6, $7)`,
          [handoffId, todoId, input.requesterMembershipId, input.recipientMembershipId, input.status, requestedAt, input.resolvedAt ?? null],
        );
        return handoffId;
      };

      const incomingHandoffId = await insertHandoff({ sequence: 1, requesterMembershipId: 'acme-studio-sato', recipientMembershipId: 'acme-studio-owner', status: 'requested' });
      const outgoingHandoffId = await insertHandoff({ sequence: 2, requesterMembershipId: 'acme-studio-owner', recipientMembershipId: 'acme-studio-mori', status: 'requested' });
      await insertHandoff({ sequence: 3, requesterMembershipId: 'acme-studio-owner', recipientMembershipId: 'acme-studio-mori', status: 'rejected', resolvedAt: new Date(Date.UTC(2040, 0, 1, 1)) });
      const unrelatedHandoffIds: string[] = [];
      for (let sequence = 10; sequence < 31; sequence += 1) {
        unrelatedHandoffIds.push(await insertHandoff({
          sequence,
          requesterMembershipId: 'acme-studio-sato',
          recipientMembershipId: 'acme-studio-mori',
          status: 'rejected',
          resolvedAt: new Date(Date.UTC(2041, 0, 1, 0, 0, sequence)),
        }));
      }
      const ownRecentHandoffIds: string[] = [];
      for (let sequence = 40; sequence < 61; sequence += 1) {
        ownRecentHandoffIds.push(await insertHandoff({
          sequence,
          requesterMembershipId: 'acme-studio-owner',
          recipientMembershipId: 'acme-studio-mori',
          status: 'rejected',
          resolvedAt: new Date(Date.UTC(2040, 0, 2, 0, 0, sequence)),
        }));
      }
      for (let sequence = 70; sequence < 91; sequence += 1) {
        await insertHandoff({
          sequence,
          requesterMembershipId: 'acme-studio-sato',
          recipientMembershipId: 'acme-studio-mori',
          status: 'requested',
        });
      }

      const workspace = await getHandoffWorkspace(ownerCookie);
      expect(workspace.incomingRequests.map((handoff) => handoff.handoffId)).toContain(incomingHandoffId);
      expect(workspace.outgoingRequests.map((handoff) => handoff.handoffId)).toContain(outgoingHandoffId);
      const recentHandoffIds = workspace.recentHandoffs.map((handoff) => handoff.handoffId);
      expect(recentHandoffIds).toEqual(ownRecentHandoffIds.slice(1).reverse());
      expect(recentHandoffIds.filter((handoffId) => unrelatedHandoffIds.includes(handoffId))).toEqual([]);
    } finally {
      await db.query("delete from todo where id like 'todo-workspace-%'");
      await db.end();
    }
  });

  it('does not include completed Todos in the Assigned Todo workspace', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const completedTodo = await createTodo(ownerCookie);
    const db = new pg.Client({ connectionString: env.DATABASE_URL });
    await db.connect();
    try {
      await db.query("update todo set status = 'completed' where id = $1 and organization_id = 'org_acme_studio'", [completedTodo.todoId]);
    } finally {
      await db.end();
    }

    const assigned = await getAssignedTodos(ownerCookie);
    expect(assigned.todos.map((todo) => todo.todoId)).not.toContain(completedTodo.todoId);
  });
});
