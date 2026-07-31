import type { AssignedTodoWorkspace, TodoHandoffStatus, TodoHandoffSummary, TodoHandoffWorkspace, TodoSummary } from '@aimani-ai/contracts';
import type { CurrentMembershipContext } from './identity';
export type { TodoHandoffWorkspace, AssignedTodoWorkspace, TodoHandoffSummary };
export interface RequestTodoHandoffCommand { id:string; organizationId:string; todoId:string; requesterMembershipId:string; recipientMembershipId:string; requestMessage:string|null; now:Date }
export interface AcceptTodoHandoffCommand { organizationId:string; handoffId:string; recipientMembershipId:string; nextAction:string|null; now:Date }
export interface RejectTodoHandoffCommand { organizationId:string; handoffId:string; recipientMembershipId:string; now:Date }
export interface CancelTodoHandoffCommand { organizationId:string; handoffId:string; requesterMembershipId:string; now:Date }
export interface TodoHandoffWorkspaceQuery { organizationId:string; currentMembershipId:string }
export interface AssignedTodoWorkspaceQuery { organizationId:string; currentMembershipId:string }
export type TodoHandoffConflictReason='handoff_already_requested'|'handoff_already_resolved'|'requester_is_not_current_assignee'|'todo_not_open'|'invalid_recipient'|'inactive_recipient';
type Result = { handoff:TodoHandoffSummary; todo:TodoSummary };
export type RequestTodoHandoffOutcome=({kind:'created'}|{kind:'already_requested'})&Result|{kind:'not_found'}|{kind:'forbidden'}|{kind:'conflict';reason:TodoHandoffConflictReason};
export type AcceptTodoHandoffOutcome=({kind:'accepted'}|{kind:'already_accepted'})&Result|{kind:'not_found'}|{kind:'forbidden'}|{kind:'conflict';reason:TodoHandoffConflictReason};
export type RejectTodoHandoffOutcome=({kind:'rejected'}|{kind:'already_rejected'})&Result|{kind:'not_found'}|{kind:'forbidden'}|{kind:'conflict';reason:TodoHandoffConflictReason};
export type CancelTodoHandoffOutcome=({kind:'canceled'}|{kind:'already_canceled'})&Result|{kind:'not_found'}|{kind:'forbidden'}|{kind:'conflict';reason:TodoHandoffConflictReason};
export interface TodoHandoffRepository { findActiveMembershipForUser(userId:string,organizationId:string):Promise<CurrentMembershipContext|null>; requestTodoHandoff(c:RequestTodoHandoffCommand):Promise<RequestTodoHandoffOutcome>; acceptTodoHandoff(c:AcceptTodoHandoffCommand):Promise<AcceptTodoHandoffOutcome>; rejectTodoHandoff(c:RejectTodoHandoffCommand):Promise<RejectTodoHandoffOutcome>; cancelTodoHandoff(c:CancelTodoHandoffCommand):Promise<CancelTodoHandoffOutcome>; getTodoHandoffWorkspace(q:TodoHandoffWorkspaceQuery):Promise<TodoHandoffWorkspace>; getAssignedTodoWorkspace(q:AssignedTodoWorkspaceQuery):Promise<AssignedTodoWorkspace> }
