import type { MembershipRepository } from '../infrastructure/db/membership-repository';
export class ListOrganizationMembershipsForUser { constructor(private readonly membershipRepository: MembershipRepository) {} execute(userId: string) { return this.membershipRepository.listActiveMembershipsForUser(userId); } }
