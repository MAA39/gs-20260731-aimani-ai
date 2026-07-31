import type { Context } from 'hono';
import { Hono } from 'hono';
import {
  connectProcessStepsBodySchema,
  moveProcessStepBodySchema,
  organizationProcessLabPathSchema,
  processDependencyPathSchema,
  processStepPathSchema,
  updateProcessStepBodySchema,
} from '@aimani-ai/contracts';
import type { ApiEnv } from '../../app';
import { ApiError } from '../../errors/api-error';
import type { ProcessLabService } from './process-lab-service';

async function currentUserId(context: Context<ApiEnv>) {
  const auth = await context.get('scope').resolve('auth');
  const session = await auth.api.getSession({ headers: context.req.raw.headers });
  if (!session?.user) throw new ApiError('unauthorized', 'Authentication required');
  return session.user.id;
}

function parseJson(context: Context<ApiEnv>) {
  return context.req.json().catch(() => {
    throw new ApiError('validation_error', 'Invalid JSON body.');
  });
}

export function createProcessLabRoutes() {
  return new Hono<ApiEnv>()
    .get('/organizations/:organizationId/process-lab', async (context) => {
      const path = organizationProcessLabPathSchema.safeParse(context.req.param());
      if (!path.success) throw new ApiError('validation_error', 'Invalid path.');
      const service = await context.get('scope').resolve<ProcessLabService>('processLabService');
      return context.json(
        await service.getWorkspace(await currentUserId(context), path.data.organizationId),
      );
    })
    .patch('/organizations/:organizationId/process-lab/steps/:stepId/status', async (context) => {
      const path = processStepPathSchema.safeParse(context.req.param());
      const body = updateProcessStepBodySchema.safeParse(await parseJson(context));
      if (!path.success || !body.success) throw new ApiError('validation_error', 'Invalid step status.');
      const service = await context.get('scope').resolve<ProcessLabService>('processLabService');
      return context.json(await service.updateStepStatus(await currentUserId(context), path.data.organizationId, path.data.stepId, body.data.status));
    })
    .patch('/organizations/:organizationId/process-lab/steps/:stepId/layout', async (context) => {
      const path = processStepPathSchema.safeParse(context.req.param());
      const body = moveProcessStepBodySchema.safeParse(await parseJson(context));
      if (!path.success || !body.success) throw new ApiError('validation_error', 'Invalid step layout.');
      const service = await context.get('scope').resolve<ProcessLabService>('processLabService');
      return context.json(await service.moveStep(await currentUserId(context), path.data.organizationId, path.data.stepId, body.data));
    })
    .post('/organizations/:organizationId/process-lab/dependencies', async (context) => {
      const path = organizationProcessLabPathSchema.safeParse(context.req.param());
      const body = connectProcessStepsBodySchema.safeParse(await parseJson(context));
      if (!path.success || !body.success) throw new ApiError('validation_error', 'Invalid dependency.');
      const service = await context.get('scope').resolve<ProcessLabService>('processLabService');
      return context.json(await service.connectSteps(await currentUserId(context), path.data.organizationId, body.data), 201);
    })
    .delete('/organizations/:organizationId/process-lab/dependencies/:predecessorStepId/:successorStepId', async (context) => {
      const path = processDependencyPathSchema.safeParse(context.req.param());
      if (!path.success) throw new ApiError('validation_error', 'Invalid dependency path.');
      const service = await context.get('scope').resolve<ProcessLabService>('processLabService');
      return context.json(await service.disconnectSteps(await currentUserId(context), path.data.organizationId, path.data));
    });
}
