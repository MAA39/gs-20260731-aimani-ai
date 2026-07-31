import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

const databaseUrl = process.env.TEST_DATABASE_URL;
const env = { DATABASE_URL: databaseUrl, BETTER_AUTH_SECRET: 'integration-secret-at-least-32-chars', BETTER_AUTH_URL: 'http://localhost:8787' };

describe('Todo relationship boundary', () => {
  it('keeps a shared Todo inside its Organization relationship context', async () => {
    const app = createApp();
    const signIn = async (email: string) => {
      const response = await app.fetch(new Request('http://localhost:8787/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'aimani-ai-demo-2026' }) }), env);
      return response.headers.getSetCookie().join('; ');
    };
    const ownerCookie = await signIn('owner@aimani-ai.local');
    const title = `次回1on1の論点をまとめる ${randomUUID()}`;
    const post = await app.fetch(new Request('http://localhost:8787/organizations/org_acme_studio/people/acme-studio-sato/todos', { method: 'POST', headers: { 'content-type': 'application/json', cookie: ownerCookie }, body: JSON.stringify({ title, description: '共有メモを一つにする', assigneeMembershipId: 'acme-studio-sato' }) }), env);
    expect(post.status).toBe(201);
    const created = (await post.json()) as { todo: { creator: { membershipId: string }; contextMembershipId: string; assignee: { membershipId: string }; status: string } };
    expect(created.todo).toMatchObject({ contextMembershipId: 'acme-studio-sato', status: 'open', creator: { membershipId: 'acme-studio-owner' }, assignee: { membershipId: 'acme-studio-sato' } });

    const workspaceResponse = await app.fetch(new Request('http://localhost:8787/organizations/org_acme_studio/people/acme-studio-sato/todos', { headers: { cookie: ownerCookie } }), env);
    expect(workspaceResponse.status).toBe(200);
    const workspace = (await workspaceResponse.json()) as { organization: { organizationId: string; name: string }; currentMember: { name: string }; contextMember: { name: string }; todos: Array<{ title: string; creator: { name: string }; assignee: { name: string } }> };
    expect(workspace.organization).toEqual({ organizationId: 'org_acme_studio', name: 'Acme Studio' });
    expect(workspace.currentMember.name).toBe('田中 彩');
    expect(workspace.contextMember.name).toBe('佐藤 花子');
    const listedTodo = workspace.todos.find((todo) => todo.title === title);
    expect(listedTodo?.creator.name).toBe('田中 彩');
    expect(listedTodo?.assignee.name).toBe('佐藤 花子');

    const satoCookie = await signIn('sato@aimani-ai.local');
    const db = new pg.Client({ connectionString: databaseUrl });
    await db.connect();
    try {
      const before = await db.query<{ count: number }>('select count(*)::int as count from todo where organization_id=$1 and title=$2', ['org_northstar_lab', title]);
      const forbidden = await app.fetch(new Request('http://localhost:8787/organizations/org_northstar_lab/people/northstar-lab-suzuki/todos', { method: 'POST', headers: { 'content-type': 'application/json', cookie: satoCookie }, body: JSON.stringify({ title, description: '共有メモを一つにする', assigneeMembershipId: 'northstar-lab-suzuki' }) }), env);
      expect(forbidden.status).toBe(403);
      const after = await db.query<{ count: number }>('select count(*)::int as count from todo where organization_id=$1 and title=$2', ['org_northstar_lab', title]);
      expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
    } finally {
      await db.end();
    }
  });
});
