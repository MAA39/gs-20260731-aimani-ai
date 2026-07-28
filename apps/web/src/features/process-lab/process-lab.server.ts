import '@tanstack/react-start/server-only';
import { getRequestHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { createApiFetcher, readApiBody } from '../server/api-fetcher.server';
import {
  connectProcessStepsInputSchema,
  disconnectProcessStepsInputSchema,
  moveProcessStepInputSchema,
  parseProcessLabWorkspace,
  processLabInputSchema,
  updateProcessStepInputSchema,
  type MoveProcessStepInput,
  type ProcessDependencyInput,
  type ProcessLabInput,
  type ProcessLabResult,
  type UpdateProcessStepInput,
} from './process-lab-schema';

const unavailable = (): ProcessLabResult => ({
  status: 'error',
  error: {
    code: 'service_unavailable',
    message: '工程を読み込めませんでした。時間をおいてもう一度お試しください。',
  },
});

function errorReason(body: unknown) {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error?: unknown }).error === 'object' &&
    (body as { error: { message?: unknown } }).error !== null
  ) {
    const message = (body as { error: { message?: unknown } }).error.message;
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
}

function conflictMessage(reason?: string) {
  if (reason === 'predecessor_incomplete') {
    return '先行工程が完了するまで、この工程は開始できません。';
  }
  if (reason === 'cycle') {
    return '工程が循環するため、このつながりは追加できません。';
  }
  if (reason === 'graph_disconnected') {
    return '工程が孤立するため、このつながりは削除できません。';
  }
  if (reason === 'duplicate') return '同じ工程のつながりがすでにあります。';
  return '工程が更新されています。画面を確認してもう一度お試しください。';
}

async function requestWorkspace(
  url: string,
  init: RequestInit | undefined,
  expectedStatus: number,
): Promise<ProcessLabResult> {
  const cookie = getRequestHeader('cookie') ?? '';
  let response: Response;
  try {
    response = await createApiFetcher(cookie)(url, init);
  } catch {
    return unavailable();
  }
  const body = await readApiBody(response);
  if (response.status === 401) throw redirect({ to: '/login' });
  if (response.status === 403) {
    return {
      status: 'forbidden',
      error: { code: 'forbidden', message: 'この組織の工程は閲覧できません。' },
    };
  }
  if (response.status === 404) {
    return {
      status: 'not_found',
      error: { code: 'not_found', message: '対象の工程が見つかりません。' },
    };
  }
  if (response.status === 409) {
    return {
      status: 'conflict',
      error: { code: 'conflict', message: conflictMessage(errorReason(body)) },
    };
  }
  if (response.status === 400) {
    return {
      status: 'error',
      error: { code: 'validation_error', message: '工程の指定を確認してください。' },
    };
  }
  if (response.status !== expectedStatus) return unavailable();
  const workspace = parseProcessLabWorkspace(body);
  return workspace ? { status: 'ok', workspace } : unavailable();
}

export async function getProcessLabFromApi(
  input: ProcessLabInput,
): Promise<ProcessLabResult> {
  const parsed = processLabInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      error: { code: 'validation_error', message: '組織の指定を確認してください。' },
    };
  }
  return requestWorkspace(
    `http://api.internal/organizations/${parsed.data.organizationId}/process-lab`,
    undefined,
    200,
  );
}

export async function updateProcessStepStatusFromApi(
  input: UpdateProcessStepInput,
) {
  const parsed = updateProcessStepInputSchema.safeParse(input);
  if (!parsed.success) return unavailable();
  const { organizationId, stepId, status } = parsed.data;
  return requestWorkspace(
    `http://api.internal/organizations/${organizationId}/process-lab/steps/${stepId}/status`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    },
    200,
  );
}

export async function moveProcessStepFromApi(input: MoveProcessStepInput) {
  const parsed = moveProcessStepInputSchema.safeParse(input);
  if (!parsed.success) return unavailable();
  const { organizationId, stepId, x, y } = parsed.data;
  return requestWorkspace(
    `http://api.internal/organizations/${organizationId}/process-lab/steps/${stepId}/layout`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ x, y }),
    },
    200,
  );
}

export async function connectProcessStepsFromApi(input: ProcessDependencyInput) {
  const parsed = connectProcessStepsInputSchema.safeParse(input);
  if (!parsed.success) return unavailable();
  const { organizationId, predecessorStepId, successorStepId } = parsed.data;
  return requestWorkspace(
    `http://api.internal/organizations/${organizationId}/process-lab/dependencies`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ predecessorStepId, successorStepId }),
    },
    201,
  );
}

export async function disconnectProcessStepsFromApi(
  input: ProcessDependencyInput,
) {
  const parsed = disconnectProcessStepsInputSchema.safeParse(input);
  if (!parsed.success) return unavailable();
  const { organizationId, predecessorStepId, successorStepId } = parsed.data;
  return requestWorkspace(
    `http://api.internal/organizations/${organizationId}/process-lab/dependencies/${predecessorStepId}/${successorStepId}`,
    { method: 'DELETE' },
    200,
  );
}
