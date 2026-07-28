import pg from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import { processLabWorkspaceSchema } from '@amidala/contracts';
import { createApp } from '../../app';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required.');

const env = {
  DATABASE_URL: databaseUrl,
  BETTER_AUTH_SECRET: 'integration-secret-at-least-32-chars',
  BETTER_AUTH_URL: 'http://localhost:8787',
};

const boardId = 'process-lab-acme-product-launch';

describe('Process Lab API', () => {
  const app = createApp();

  const signIn = async (email: string) => {
    const response = await app.fetch(
      new Request('http://localhost:8787/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'amidala-demo-2026' }),
      }),
      env,
    );
    expect(response.status).toBe(200);
    return response.headers.getSetCookie().join('; ');
  };

  const request = async (
    cookie: string,
    path: string,
    init: { method?: string; body?: unknown } = {},
  ) => {
    const response = await app.fetch(
      new Request(`http://localhost:8787${path}`, {
        method: init.method,
        headers: {
          cookie,
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      env,
    );
    return { status: response.status, body: await response.json() };
  };

  beforeEach(async () => {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query('begin');
      await client.query(
        `update process_lab_board set revision = 1 where id = $1`,
        [boardId],
      );
      await client.query(
        `update process_lab_step
            set status = case id
              when 'problem_discovery' then 'completed'
              when 'experience_design' then 'completed'
              when 'prototype_validation' then 'in_progress'
              else 'not_started'
            end
          where board_id = $1`,
        [boardId],
      );
      await client.query(
        `update process_lab_step_layout set x = 912, y = 64
          where board_id = $1 and step_id = 'launch_preparation'`,
        [boardId],
      );
      await client.query(
        `delete from process_lab_dependency
          where board_id = $1
            and predecessor_step_id = 'launch_preparation'
            and successor_step_id = 'customer_guidance'`,
        [boardId],
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      await client.end();
    }
  });

  it('returns the connected board to an authenticated organization member', async () => {
    const cookie = await signIn('owner@amidala.local');
    const response = await request(cookie, '/organizations/org_acme_studio/process-lab');
    expect(response.status).toBe(200);
    const workspace = processLabWorkspaceSchema.parse(response.body);
    expect(workspace.steps).toHaveLength(6);
    expect(workspace.dependencies).toHaveLength(7);
    expect(workspace.layouts).toHaveLength(6);
  });

  it('returns 403 when a member requests another organization board', async () => {
    const cookie = await signIn('suzuki@amidala.local');
    const response = await request(cookie, '/organizations/org_acme_studio/process-lab');
    expect(response.status).toBe(403);
  });

  it('rejects starting a step whose predecessor is incomplete', async () => {
    const cookie = await signIn('owner@amidala.local');
    const response = await request(
      cookie,
      '/organizations/org_acme_studio/process-lab/steps/launch_preparation/status',
      { method: 'PATCH', body: { status: 'in_progress' } },
    );
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: 'conflict', message: 'predecessor_incomplete' },
    });
  });

  it('rejects a dependency that creates a directed cycle', async () => {
    const cookie = await signIn('owner@amidala.local');
    const response = await request(
      cookie,
      '/organizations/org_acme_studio/process-lab/dependencies',
      {
        method: 'POST',
        body: {
          predecessorStepId: 'product_launch',
          successorStepId: 'problem_discovery',
        },
      },
    );
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: 'conflict', message: 'cycle' },
    });
  });

  it('persists a moved step and returns the incremented revision', async () => {
    const cookie = await signIn('owner@amidala.local');
    const moved = await request(
      cookie,
      '/organizations/org_acme_studio/process-lab/steps/launch_preparation/layout',
      { method: 'PATCH', body: { x: 840, y: 108 } },
    );
    expect(moved.status).toBe(200);
    const workspace = processLabWorkspaceSchema.parse(moved.body);
    expect(workspace.board.revision).toBe(2);
    expect(workspace.layouts.find((layout) => layout.stepId === 'launch_preparation'))
      .toEqual({ stepId: 'launch_preparation', x: 840, y: 108 });
  });

  it('connects and disconnects a valid dependency without isolating a step', async () => {
    const cookie = await signIn('owner@amidala.local');
    const connected = await request(
      cookie,
      '/organizations/org_acme_studio/process-lab/dependencies',
      {
        method: 'POST',
        body: {
          predecessorStepId: 'launch_preparation',
          successorStepId: 'customer_guidance',
        },
      },
    );
    expect(connected.status).toBe(201);
    expect(processLabWorkspaceSchema.parse(connected.body).dependencies).toContainEqual({
      predecessorStepId: 'launch_preparation',
      successorStepId: 'customer_guidance',
    });

    const disconnected = await request(
      cookie,
      '/organizations/org_acme_studio/process-lab/dependencies/launch_preparation/customer_guidance',
      { method: 'DELETE' },
    );
    expect(disconnected.status).toBe(200);
    expect(processLabWorkspaceSchema.parse(disconnected.body).dependencies)
      .not.toContainEqual({
        predecessorStepId: 'launch_preparation',
        successorStepId: 'customer_guidance',
      });
  });
});
