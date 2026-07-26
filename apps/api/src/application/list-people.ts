import { ApiError } from '../errors/api-error';
import type { CurrentMembershipContext } from '../domain/identity';
import type { MemberSummary } from '@amidala/contracts';

export interface PeopleReadModel {
  findActiveMembershipForUser(userId: string, organizationId: string): Promise<CurrentMembershipContext | null>;
  listMembersForCurrentMembership(current: CurrentMembershipContext): Promise<MemberSummary[]>;
}

export class ListMembersForCurrentOrganization {
  constructor(private readonly peopleReadModel: PeopleReadModel) {}
  async execute(userId: string, organizationId: string): Promise<MemberSummary[]> {
    const currentMembership = await this.peopleReadModel.findActiveMembershipForUser(userId, organizationId);
    if (!currentMembership) throw new ApiError('forbidden', 'This organization is not available to this user.');
    return this.peopleReadModel.listMembersForCurrentMembership(currentMembership);
  }
}
