export type MembershipRole = 'owner' | 'manager' | 'member';
export interface CurrentMembershipContext { userId: string; membershipId: string; organizationId: string; role: MembershipRole }
export interface OrganizationMembershipSummary { organizationId: string; name: string; slug: string; membershipId: string; role: MembershipRole; displayName: string }
