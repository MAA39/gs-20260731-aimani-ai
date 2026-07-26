import { z } from 'zod';

export const relationshipKindSchema = z.enum(['manager_report', 'supporter', 'peer']);
export const memberSummarySchema = z.object({
  membershipId: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  relationshipKinds: z.array(relationshipKindSchema),
});
export const listPeopleResponseSchema = z.object({ people: z.array(memberSummarySchema) });
export const listPeopleInputSchema = z.object({ organizationId: z.string().min(1) });
export type RelationshipKind = z.infer<typeof relationshipKindSchema>;
export type MemberSummary = z.infer<typeof memberSummarySchema>;
export type ListPeopleResponse = z.infer<typeof listPeopleResponseSchema>;
