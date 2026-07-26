import { z } from 'zod';
export const peopleInputSchema = z.object({ organizationId: z.string().min(1) });
export type PeopleInput = z.infer<typeof peopleInputSchema>;
