import { teamWorkOverviewSchema } from '@aimani-ai/contracts';
import type { TeamWorkOverview } from '@aimani-ai/contracts';
import { z } from 'zod';

export const teamWorkOverviewInputSchema = z.object({
  organizationId: z.string().min(1),
});

export type TeamWorkOverviewInput = z.infer<typeof teamWorkOverviewInputSchema>;

export type TeamWorkOverviewResult =
  | { status: 'ok'; overview: TeamWorkOverview }
  | { status: 'forbidden'; error: { code: 'forbidden'; message: string } }
  | { status: 'not_found'; error: { code: 'not_found'; message: string } }
  | {
      status: 'error';
      error: { code: 'validation_error' | 'service_unavailable'; message: string };
    };

export { teamWorkOverviewSchema };
