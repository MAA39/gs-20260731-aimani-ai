import type { CurrentMembershipContext } from './identity';
import type { TodoSummary, RelationshipTodoWorkspace } from '@amidala/contracts';
export interface IdGenerator { next(): string }
export interface CreateTodoCommand { organizationId:string; contextMembershipId:string; title:string; description?:string; assigneeMembershipId:string }
export interface TodoRepository { findActiveMembershipForUser(userId:string, organizationId:string):Promise<CurrentMembershipContext|null>; findMembership(id:string, organizationId:string):Promise<any|null>; create(input:any):Promise<TodoSummary>; list(input:any):Promise<RelationshipTodoWorkspace>; }
