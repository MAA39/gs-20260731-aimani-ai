import { and, eq, ne, or } from 'drizzle-orm';
import { membership, relationship } from '@aimani-ai/db/schema';
import type { AimaniAiDatabase } from '@aimani-ai/db/client';
import { relationshipKindSchema, type MemberSummary, type RelationshipKind } from '@aimani-ai/contracts';
import type { CurrentMembershipContext } from '../../domain/identity';
const membershipRoleValues = new Set(['owner', 'manager', 'member'] as const);

const relationshipOrder: Record<RelationshipKind, number> = { manager_report: 0, supporter: 1, peer: 2 };

export class PeopleRepository {
  constructor(private readonly database: AimaniAiDatabase) {}

  async findActiveMembershipForUser(userId: string, organizationId: string): Promise<CurrentMembershipContext | null> {
    const rows = await this.database.select({ membershipId: membership.id, organizationId: membership.organizationId, userId: membership.userId, role: membership.role })
      .from(membership).where(and(eq(membership.userId, userId), eq(membership.organizationId, organizationId), eq(membership.status, 'active'))).limit(1);
    const row = rows[0];
    if (!row || !membershipRoleValues.has(row.role as 'owner' | 'manager' | 'member')) return null;
    return { ...row, role: row.role as CurrentMembershipContext['role'] };
  }

  async listMembersForCurrentMembership(current: CurrentMembershipContext): Promise<MemberSummary[]> {
    const rows = await this.database.select({ membershipId: membership.id, name: membership.displayName, title: membership.title, relationshipKind: relationship.kind })
      .from(membership)
      .leftJoin(relationship, and(eq(relationship.organizationId, current.organizationId), or(and(eq(relationship.sourceMembershipId, current.membershipId), eq(relationship.targetMembershipId, membership.id)), and(or(eq(relationship.kind, 'peer'), eq(relationship.kind, 'supporter')), eq(relationship.targetMembershipId, current.membershipId), eq(relationship.sourceMembershipId, membership.id)))))
      .where(and(eq(membership.organizationId, current.organizationId), eq(membership.status, 'active'), ne(membership.id, current.membershipId)));
    const byMembership = new Map<string, MemberSummary>();
    for (const row of rows) {
      const existing = byMembership.get(row.membershipId) ?? { membershipId: row.membershipId, name: row.name, title: row.title, relationshipKinds: [] };
      const parsedKind = row.relationshipKind === null ? null : relationshipKindSchema.safeParse(row.relationshipKind).data ?? null;
      if (parsedKind && !existing.relationshipKinds.includes(parsedKind)) existing.relationshipKinds.push(parsedKind);
      byMembership.set(row.membershipId, existing);
    }
    return [...byMembership.values()].map((member) => ({ ...member, relationshipKinds: member.relationshipKinds.sort((a, b) => relationshipOrder[a] - relationshipOrder[b]) })).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }
}
