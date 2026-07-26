import type { MembershipRepository } from '../infrastructure/db/membership-repository';
export class ListOrganizations { constructor(private readonly membershipRepository: MembershipRepository) {} execute(userId: string) { return this.membershipRepository.listActiveByUser(userId); } }
