export type MembershipRole = 'owner' | 'manager' | 'member';
export interface Principal { userId: string; membershipId: string; organizationId: string; role: MembershipRole }
export interface OrganizationOption { organizationId: string; name: string; slug: string; membershipId: string; role: MembershipRole; displayName: string }
