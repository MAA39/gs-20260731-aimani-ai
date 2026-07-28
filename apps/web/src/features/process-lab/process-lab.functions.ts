import { createServerFn } from '@tanstack/react-start';
import {
  connectProcessStepsInputSchema,
  disconnectProcessStepsInputSchema,
  moveProcessStepInputSchema,
  processLabInputSchema,
  updateProcessStepInputSchema,
} from './process-lab-schema';
import {
  connectProcessStepsFromApi,
  disconnectProcessStepsFromApi,
  getProcessLabFromApi,
  moveProcessStepFromApi,
  updateProcessStepStatusFromApi,
} from './process-lab.server';

export const getProcessLab = createServerFn({ method: 'GET' })
  .validator(processLabInputSchema)
  .handler(({ data }) => getProcessLabFromApi(data));

export const updateProcessStepStatus = createServerFn({ method: 'POST' })
  .validator(updateProcessStepInputSchema)
  .handler(({ data }) => updateProcessStepStatusFromApi(data));

export const moveProcessStep = createServerFn({ method: 'POST' })
  .validator(moveProcessStepInputSchema)
  .handler(({ data }) => moveProcessStepFromApi(data));

export const connectProcessSteps = createServerFn({ method: 'POST' })
  .validator(connectProcessStepsInputSchema)
  .handler(({ data }) => connectProcessStepsFromApi(data));

export const disconnectProcessSteps = createServerFn({ method: 'POST' })
  .validator(disconnectProcessStepsInputSchema)
  .handler(({ data }) => disconnectProcessStepsFromApi(data));
