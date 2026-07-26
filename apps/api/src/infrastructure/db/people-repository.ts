import { and, eq, ne, or, sql } from 'drizzle-orm';
import { membership, relationship } from '@amidala/db/schema';
import type { AmidalaDatabase } from '@amidala/db/client';
import type { MemberSummary, RelationshipKind } from '@amidala/contracts';

const relationshipOrder: Record<RelationshipKind, number> = { manager_report: 0, supporter: 1, peer: 2 };

export interface CurrentMembershipContext { membershipId: string; organizationId: string; userId: string }

export class PeopleRepository {
  constructor(private readonly database: AmidalaDatabase) {}

  async findActiveMembership(userId: string, organizationId: string): Promise<CurrentMembershipContext | null> {
    const rows = await this.database.select({ membershipId: membership.id, organizationId: membership.organizationId, userId: membership.userId })
      .from(membership).where(and(eq(membership.userId, userId), eq(membership.organizationId, organizationId), eq(membership.status, 'active'))).limit(1);
    return rows[0] ?? null;
  }

  async listForMembership(current: CurrentMembershipContext): Promise<MemberSummary[]> {
    const rows = await this.database.select({ membershipId: membership.id, name: membership.displayName, title: membership.title, relationshipKind: relationship.kind })
      .from(membership)
      .leftJoin(relationship, and(eq(relationship.organizationId, current.organizationId), or(and(eq(relationship.sourceMembershipId, current.membershipId), eq(relationship.targetMembershipId, membership.id)), and(eq(relationship.targetMembershipId, current.membershipId), eq(relationship.sourceMembershipId, membership.id)))))
      .where(and(eq(membership.organizationId, current.organizationId), eq(membership.status, 'active'), ne(membership.id, current.membershipId)));
    const byMembership = new Map<string, MemberSummary>();
    for (const row of rows) {
      const existing = byMembership.get(row.membershipId) ?? { membershipId: row.membershipId, name: row.name, title: row.title, relationshipKinds: [] };
      if (row.relationshipKind && ['manager_report', 'supporter', 'peer'].includes(row.relationshipKind) && !existing.relationshipKinds.includes(row.relationshipKind as RelationshipKind)) existing.relationshipKinds.push(row.relationshipKind as RelationshipKind);
      byMembership.set(row.membershipId, existing);
    }
    return [...byMembership.values()].map((member) => ({ ...member, relationshipKinds: member.relationshipKinds.sort((a, b) => relationshipOrder[a] - relationshipOrder[b]) })).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }
}
