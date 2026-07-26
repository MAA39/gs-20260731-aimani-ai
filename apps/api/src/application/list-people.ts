import type { MemberSummary } from '@amidala/contracts';
import type { PeopleRepository } from '../infrastructure/db/people-repository';
import { ApiError } from '../errors/api-error';

export class ListMembersForCurrentOrganization {
  constructor(private readonly peopleRepository: PeopleRepository) {}
  async execute(userId: string, organizationId: string): Promise<MemberSummary[]> {
    const currentMembership = await this.peopleRepository.findActiveMembership(userId, organizationId);
    if (!currentMembership) throw new ApiError('forbidden', 'This organization is not available to this user.');
    return this.peopleRepository.listForMembership(currentMembership);
  }
}
