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
  nextAction: z.string().nullable(),
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
const teamWorkOverviewSchema = z.object({
  organization: z.object({ organizationId: z.string(), name: z.string() }),
  currentMember: memberSchema,
  members: z.array(z.object({
    member: memberSchema,
    openTodos: z.array(todoSummarySchema),
  })),
  recentlyCompletedTodos: z.array(todoSummarySchema),
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

  const requestHandoffId = async (cookie: string, todoId: string): Promise<string> => {
    const response = await app.fetch(new Request(`http://localhost:8787/organizations/org_acme_studio/todos/${todoId}/handoffs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ recipientMembershipId: 'acme-studio-mori' }),
    }), env);
    expect(response.status).toBe(201);
    const parsed = z.object({ handoff: z.object({ handoffId: z.string() }) }).parse(await response.json());
    return parsed.handoff.handoffId;
  };

  const decide = async (
    cookie: string,
    handoffId: string,
    action: 'accept' | 'reject' | 'cancel',
    organizationId = 'org_acme_studio',
    body?: { nextAction?: string } | null | unknown[] | string,
  ): Promise<HandoffResponse> => {
    const response = await app.fetch(new Request(`http://localhost:8787/organizations/${organizationId}/handoffs/${handoffId}/${action}`, {
      method: 'POST',
      headers: { cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }), env);
    const parsed = response.status >= 400 ? errorSchema.parse(await response.json()) : resourceSchema.parse(await response.json());
    return response.status >= 400
      ? { status: response.status, error: parsed.error }
      : { status: response.status, handoff: parsed.handoff, todo: parsed.todo };
  };

  const decideStatus = async (
    cookie: string,
    handoffId: string,
    action: 'accept' | 'reject' | 'cancel',
    body?: { nextAction?: string } | null | unknown[] | string,
  ) => {
    const response = await app.fetch(new Request(`http://localhost:8787/organizations/org_acme_studio/handoffs/${handoffId}/${action}`, {
      method: 'POST',
      headers: { cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }), env);
    if (response.status >= 400) return { status: response.status, error: errorSchema.parse(await response.json()).error };
    return { status: response.status };
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

  const getHandoffState = async (cookie: string, handoffId: string) => {
    const response = await app.fetch(new Request('http://localhost:8787/organizations/org_acme_studio/handoffs', { headers: { cookie } }), env);
    expect(response.status).toBe(200);
    const stateSchema = z.object({
      incomingRequests: z.array(z.object({
        handoffId: z.string(),
        status: z.enum(['requested', 'accepted', 'rejected', 'canceled']),
        todo: z.object({ assignee: z.object({ membershipId: z.string() }) }),
      })),
    });
    const workspace = stateSchema.parse(await response.json());
    return workspace.incomingRequests.find((handoff) => handoff.handoffId === handoffId);
  };

  const getSharedTodos = async (cookie: string) => {
    const response = await app.fetch(new Request('http://localhost:8787/organizations/org_acme_studio/people/acme-studio-sato/todos', { headers: { cookie } }), env);
    expect(response.status).toBe(200);
    return sharedTodoWorkspaceSchema.parse(await response.json());
  };

  const getTeamWork = async (cookie: string, organizationId = 'org_acme_studio') => {
    const response = await app.fetch(new Request(
      `http://localhost:8787/organizations/${organizationId}/work`,
      { headers: { cookie } },
    ), env);
    const body = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : await response.text();
    return { status: response.status, body };
  };

  const insertTeamWorkTodo = async (db: pg.Client, input: {
    todoId: string;
    organizationId?: string;
    contextMembershipId?: string;
    creatorMembershipId?: string;
    assigneeMembershipId: string;
    status?: 'open' | 'completed';
    updatedAt: Date;
  }) => {
    await db.query(
      `insert into todo (id, organization_id, context_membership_id, creator_membership_id, assignee_membership_id, title, description, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, null, $7, $8, $8)`,
      [
        input.todoId,
        input.organizationId ?? 'org_acme_studio',
        input.contextMembershipId ?? 'acme-studio-sato',
        input.creatorMembershipId ?? 'acme-studio-owner',
        input.assigneeMembershipId,
        input.todoId,
        input.status ?? 'open',
        input.updatedAt,
      ],
    );
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

  it('stores the recipient next action with acceptance without overwriting it on retry', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const moriCookie = await signIn('mori@amidala.local');
    const todo = await createTodo(ownerCookie);
    const handoffId = await requestHandoffId(ownerCookie, todo.todoId);

    const accepted = await decide(moriCookie, handoffId, 'accept', 'org_acme_studio', {
      nextAction: '  インタビュー仮説を3点にまとめる  ',
    });
    expect(accepted.status).toBe(200);
    expect(accepted.handoff?.nextAction).toBe('インタビュー仮説を3点にまとめる');
    expect(accepted.todo?.assignee.membershipId).toBe('acme-studio-mori');

    const retried = await decide(moriCookie, handoffId, 'accept', 'org_acme_studio', {
      nextAction: '後から上書きしない',
    });
    expect(retried.status).toBe(200);
    expect(retried.handoff?.nextAction).toBe('インタビュー仮説を3点にまとめる');
  });

  it('stores null next action when acceptance has no body or only blanks', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const moriCookie = await signIn('mori@amidala.local');
    for (const body of [undefined, { nextAction: '   ' }]) {
      const todo = await createTodo(ownerCookie);
      const requested = await requestHandoff(ownerCookie, todo.todoId, { recipientMembershipId: 'acme-studio-mori' });
      const accepted = await decide(moriCookie, requested.handoff?.handoffId ?? '', 'accept', 'org_acme_studio', body);
      expect(accepted.status).toBe(200);
      expect(accepted.handoff?.nextAction).toBeNull();
    }
  });

  it('ignores next action bodies on reject and cancel', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const moriCookie = await signIn('mori@amidala.local');

    const rejectedTodo = await createTodo(ownerCookie);
    const rejectedRequest = await requestHandoff(ownerCookie, rejectedTodo.todoId, { recipientMembershipId: 'acme-studio-mori' });
    const rejected = await decide(moriCookie, rejectedRequest.handoff?.handoffId ?? '', 'reject', 'org_acme_studio', { nextAction: '保存しない' });
    expect(rejected.status).toBe(200);
    expect(rejected.handoff?.status).toBe('rejected');
    expect(rejected.handoff?.nextAction).toBeNull();

    const canceledTodo = await createTodo(ownerCookie);
    const canceledRequest = await requestHandoff(ownerCookie, canceledTodo.todoId, { recipientMembershipId: 'acme-studio-mori' });
    const canceled = await decide(ownerCookie, canceledRequest.handoff?.handoffId ?? '', 'cancel', 'org_acme_studio', { nextAction: '保存しない' });
    expect(canceled.status).toBe(200);
    expect(canceled.handoff?.status).toBe('canceled');
    expect(canceled.handoff?.nextAction).toBeNull();
  });

  it.each([
    ['241 characters', { nextAction: 'a'.repeat(241) }],
    ['malformed JSON', '{'],
    ['null body', null],
    ['array body', []],
  ])('rejects %s acceptance input without changing the pending handoff', async (_label, body) => {
    const ownerCookie = await signIn('owner@amidala.local');
    const moriCookie = await signIn('mori@amidala.local');
    const todo = await createTodo(ownerCookie);
    const handoffId = await requestHandoffId(ownerCookie, todo.todoId);

    const invalid = await decideStatus(moriCookie, handoffId, 'accept', body);
    expect(invalid.status).toBe(400);
    expect(invalid.error?.code).toBe('validation_error');

    const pending = await getHandoffState(moriCookie, handoffId);
    expect(pending?.status).toBe('requested');
    expect(pending?.todo.assignee.membershipId).toBe('acme-studio-owner');

    const accepted = await decide(moriCookie, handoffId, 'accept', 'org_acme_studio', { nextAction: 'valid' });
    expect(accepted.status).toBe(200);
    expect(accepted.handoff?.nextAction).toBe('valid');
  });

  it('does not allow a non-recipient to save a next action', async () => {
    const ownerCookie = await signIn('owner@amidala.local');
    const moriCookie = await signIn('mori@amidala.local');
    const todo = await createTodo(ownerCookie);
    const requested = await requestHandoff(ownerCookie, todo.todoId, { recipientMembershipId: 'acme-studio-mori' });
    const handoffId = requested.handoff?.handoffId ?? '';

    const forbidden = await decide(ownerCookie, handoffId, 'accept', 'org_acme_studio', { nextAction: '不正保存' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.error?.code).toBe('forbidden');

    const accepted = await decide(moriCookie, handoffId, 'accept');
    expect(accepted.status).toBe(200);
    expect(accepted.handoff?.nextAction).toBeNull();
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

  it('groups open work under the current assignee and keeps pending Handoff with its requester', async () => {
    const fixtureId = randomUUID();
    const prefix = `todo-team-work-${fixtureId}-`;
    const ownerTodoId = `${prefix}owner-pending`;
    const moriTodoId = `${prefix}mori-open`;
    const db = new pg.Client({ connectionString: env.DATABASE_URL });
    await db.connect();
    try {
      await insertTeamWorkTodo(db, {
        todoId: ownerTodoId,
        assigneeMembershipId: 'acme-studio-owner',
        updatedAt: new Date('2099-01-01T00:02:00.000Z'),
      });
      await insertTeamWorkTodo(db, {
        todoId: moriTodoId,
        assigneeMembershipId: 'acme-studio-mori',
        updatedAt: new Date('2099-01-01T00:01:00.000Z'),
      });
      await db.query(
        `insert into todo_handoff (id, organization_id, todo_id, requester_membership_id, recipient_membership_id, request_message, status, requested_at, resolved_at)
         values ($1, 'org_acme_studio', $2, 'acme-studio-owner', 'acme-studio-mori', null, 'requested', $3, null)`,
        [`handoff-team-work-${fixtureId}`, ownerTodoId, new Date('2099-01-01T00:03:00.000Z')],
      );

      const response = await getTeamWork(await signIn('mori@amidala.local'));
      expect(response.status).toBe(200);
      const overview = teamWorkOverviewSchema.parse(response.body);
      expect(overview.currentMember.membershipId).toBe('acme-studio-mori');
      const ownerTodo = overview.members
        .find((group) => group.member.membershipId === 'acme-studio-owner')
        ?.openTodos.find((todo) => todo.todoId === ownerTodoId);
      expect(ownerTodo?.pendingHandoff?.recipient.membershipId).toBe('acme-studio-mori');
      expect(overview.members
        .find((group) => group.member.membershipId === 'acme-studio-mori')
        ?.openTodos.map((todo) => todo.todoId)).toContain(moriTodoId);
    } finally {
      await db.query('delete from todo where id like $1', [`${prefix}%`]);
      await db.end();
    }
  });

  it('shows every Acme open Todo to an Acme Member without leaking Northstar work', async () => {
    const fixtureId = randomUUID();
    const prefix = `todo-team-work-${fixtureId}-`;
    const acmeOwnerTodoId = `${prefix}acme-owner`;
    const acmeMoriTodoId = `${prefix}acme-mori`;
    const northstarTodoId = `${prefix}northstar-owner`;
    const db = new pg.Client({ connectionString: env.DATABASE_URL });
    await db.connect();
    try {
      await insertTeamWorkTodo(db, {
        todoId: acmeOwnerTodoId,
        assigneeMembershipId: 'acme-studio-owner',
        updatedAt: new Date('2099-01-02T00:03:00.000Z'),
      });
      await insertTeamWorkTodo(db, {
        todoId: acmeMoriTodoId,
        assigneeMembershipId: 'acme-studio-mori',
        updatedAt: new Date('2099-01-02T00:02:00.000Z'),
      });
      await insertTeamWorkTodo(db, {
        todoId: northstarTodoId,
        organizationId: 'org_northstar_lab',
        contextMembershipId: 'northstar-lab-suzuki',
        creatorMembershipId: 'northstar-lab-owner',
        assigneeMembershipId: 'northstar-lab-owner',
        updatedAt: new Date('2099-01-02T00:01:00.000Z'),
      });

      const response = await getTeamWork(await signIn('mori@amidala.local'));
      expect(response.status).toBe(200);
      const overview = teamWorkOverviewSchema.parse(response.body);
      const ids = overview.members.flatMap((group) => group.openTodos.map((todo) => todo.todoId));
      expect(ids).toEqual(expect.arrayContaining([acmeOwnerTodoId, acmeMoriTodoId]));
      expect(ids).not.toContain(northstarTodoId);
    } finally {
      await db.query('delete from todo where id like $1', [`${prefix}%`]);
      await db.end();
    }
  });

  it('returns forbidden when a Northstar Member requests the Acme overview', async () => {
    const response = await getTeamWork(await signIn('suzuki@amidala.local'), 'org_acme_studio');
    expect(response.status).toBe(403);
  });

  it('omits active Members without open work and work assigned to an inactive Member', async () => {
    const fixtureId = randomUUID();
    const prefix = `todo-team-work-${fixtureId}-`;
    const emptyUserId = `user-team-work-${fixtureId}`;
    const emptyActiveMembershipId = `membership-team-work-${fixtureId}`;
    const suspendedUserId = `user-team-work-suspended-${fixtureId}`;
    const suspendedMembershipId = `membership-team-work-suspended-${fixtureId}`;
    const suspendedTodoId = `${prefix}suspended-assignee`;
    const db = new pg.Client({ connectionString: env.DATABASE_URL });
    await db.connect();
    try {
      await db.query(
        `insert into "user" (id, name, email, email_verified, image, created_at, updated_at)
         values ($1, $2, $3, true, null, $4, $4)`,
        [emptyUserId, 'Team Work Empty', `team-work-${fixtureId}@example.local`, new Date('2099-01-03T00:00:00.000Z')],
      );
      await db.query(
        `insert into membership (id, user_id, organization_id, display_name, title, role, status, created_at, updated_at)
         values ($1, $2, 'org_acme_studio', $3, null, 'member', 'active', $4, $4)`,
        [emptyActiveMembershipId, emptyUserId, 'Team Work Empty', new Date('2099-01-03T00:00:00.000Z')],
      );
      await db.query(
        `insert into "user" (id, name, email, email_verified, image, created_at, updated_at)
         values ($1, $2, $3, true, null, $4, $4)`,
        [suspendedUserId, 'Team Work Suspended', `team-work-suspended-${fixtureId}@example.local`, new Date('2099-01-03T00:00:00.000Z')],
      );
      await db.query(
        `insert into membership (id, user_id, organization_id, display_name, title, role, status, created_at, updated_at)
         values ($1, $2, 'org_acme_studio', $3, null, 'member', 'suspended', $4, $4)`,
        [suspendedMembershipId, suspendedUserId, 'Team Work Suspended', new Date('2099-01-03T00:00:00.000Z')],
      );
      await insertTeamWorkTodo(db, {
        todoId: suspendedTodoId,
        assigneeMembershipId: suspendedMembershipId,
        updatedAt: new Date('2099-01-03T00:01:00.000Z'),
      });

      const response = await getTeamWork(await signIn('owner@amidala.local'));
      expect(response.status).toBe(200);
      const overview = teamWorkOverviewSchema.parse(response.body);
      const membershipIds = overview.members.map((group) => group.member.membershipId);
      expect(membershipIds).not.toContain(emptyActiveMembershipId);
      expect(membershipIds).not.toContain(suspendedMembershipId);
    } finally {
      await db.query('delete from todo where id like $1', [`${prefix}%`]);
      await db.query('delete from "user" where id = any($1::text[])', [[emptyUserId, suspendedUserId]]);
      await db.end();
    }
  });

  it('orders open work by updatedAt then Todo ID descending', async () => {
    const fixtureId = randomUUID();
    const prefix = `todo-team-work-${fixtureId}-`;
    const newerTodoId = `${prefix}owner-newer`;
    const sameTimestampHigherId = `${prefix}owner-tie-b`;
    const sameTimestampLowerId = `${prefix}owner-tie-a`;
    const moriTodoId = `${prefix}mori`;
    const db = new pg.Client({ connectionString: env.DATABASE_URL });
    await db.connect();
    try {
      await insertTeamWorkTodo(db, {
        todoId: sameTimestampLowerId,
        assigneeMembershipId: 'acme-studio-owner',
        updatedAt: new Date('2099-01-04T00:02:00.000Z'),
      });
      await insertTeamWorkTodo(db, {
        todoId: newerTodoId,
        assigneeMembershipId: 'acme-studio-owner',
        updatedAt: new Date('2099-01-04T00:04:00.000Z'),
      });
      await insertTeamWorkTodo(db, {
        todoId: sameTimestampHigherId,
        assigneeMembershipId: 'acme-studio-owner',
        updatedAt: new Date('2099-01-04T00:02:00.000Z'),
      });
      await insertTeamWorkTodo(db, {
        todoId: moriTodoId,
        assigneeMembershipId: 'acme-studio-mori',
        updatedAt: new Date('2099-01-04T00:03:00.000Z'),
      });

      const response = await getTeamWork(await signIn('owner@amidala.local'));
      expect(response.status).toBe(200);
      const overview = teamWorkOverviewSchema.parse(response.body);
      expect(overview.members.slice(0, 2).map((group) => group.member.membershipId))
        .toEqual(['acme-studio-owner', 'acme-studio-mori']);
      const ownerFixtureIds = overview.members
        .find((group) => group.member.membershipId === 'acme-studio-owner')
        ?.openTodos.map((todo) => todo.todoId)
        .filter((todoId) => todoId.startsWith(prefix));
      expect(ownerFixtureIds).toEqual([newerTodoId, sameTimestampHigherId, sameTimestampLowerId]);
    } finally {
      await db.query('delete from todo where id like $1', [`${prefix}%`]);
      await db.end();
    }
  });

  it('returns only the latest 20 completed Todos in stable order', async () => {
    const fixtureId = randomUUID();
    const prefix = `todo-team-work-${fixtureId}-completed-`;
    const completedTodoIds = Array.from({ length: 21 }, (_, sequence) => `${prefix}${String(sequence).padStart(2, '0')}`);
    const db = new pg.Client({ connectionString: env.DATABASE_URL });
    await db.connect();
    try {
      for (const [sequence, todoId] of completedTodoIds.entries()) {
        const minute = sequence === 19 ? 20 : sequence;
        await insertTeamWorkTodo(db, {
          todoId,
          assigneeMembershipId: 'acme-studio-owner',
          status: 'completed',
          updatedAt: new Date(Date.UTC(2099, 0, 5, 0, minute)),
        });
      }

      const expectedLatest20Ids = [
        completedTodoIds[20],
        completedTodoIds[19],
        ...completedTodoIds.slice(1, 19).reverse(),
      ];
      const response = await getTeamWork(await signIn('owner@amidala.local'));
      expect(response.status).toBe(200);
      const overview = teamWorkOverviewSchema.parse(response.body);
      expect(overview.recentlyCompletedTodos).toHaveLength(20);
      expect(overview.recentlyCompletedTodos.map((todo) => todo.todoId)).toEqual(expectedLatest20Ids);
      expect(overview.recentlyCompletedTodos.map((todo) => todo.todoId)).not.toContain(completedTodoIds[0]);
    } finally {
      await db.query('delete from todo where id like $1', [`${prefix}%`]);
      await db.end();
    }
  });
});
