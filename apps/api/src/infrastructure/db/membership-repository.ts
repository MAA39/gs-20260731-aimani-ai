import { eq, and } from 'drizzle-orm';
import { membership, organization } from '@aimani-ai/db/schema';
import type { OrganizationMembershipSummary } from '../../domain/identity';
import type { AimaniAiDatabase } from '@aimani-ai/db/client';
export class MembershipRepository {
  constructor(private readonly database: AimaniAiDatabase) {}
  async listActiveMembershipsForUser(userId: string): Promise<OrganizationMembershipSummary[]> {
    const rows = await this.database.select({ organizationId: organization.id, name: organization.name, slug: organization.slug, membershipId: membership.id, role: membership.role, displayName: membership.displayName }).from(membership).innerJoin(organization, (eq as any)(membership.organizationId, organization.id)).where((and as any)((eq as any)(membership.userId, userId), (eq as any)(membership.status, 'active')));
    return rows as OrganizationMembershipSummary[];
  }
}
