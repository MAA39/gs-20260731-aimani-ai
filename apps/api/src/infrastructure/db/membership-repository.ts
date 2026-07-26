import { eq, and } from 'drizzle-orm';
import { membership, organization } from '@amidala/db/schema';
import type { OrganizationMembershipSummary } from '../../domain/identity';
export class MembershipRepository {
  constructor(private readonly db: any) {}
  async listActiveMembershipsForUser(userId: string): Promise<OrganizationMembershipSummary[]> {
    const rows = await this.db.select({ organizationId: organization.id, name: organization.name, slug: organization.slug, membershipId: membership.id, role: membership.role, displayName: membership.displayName }).from(membership).innerJoin(organization, (eq as any)(membership.organizationId, organization.id)).where(and((eq as any)(membership.userId, userId), (eq as any)(membership.status, 'active')));
    return rows as OrganizationMembershipSummary[];
  }
}
