import { z } from 'zod';
export const organizationMembershipSchema = z.object({ organizationId: z.string(), name: z.string(), slug: z.string(), membershipId: z.string(), role: z.enum(['owner', 'manager', 'member']), displayName: z.string() });
export const organizationsResponseSchema = z.object({ organizationMemberships: z.array(organizationMembershipSchema) });
export type OrganizationMembershipSummary = z.infer<typeof organizationMembershipSchema>;
