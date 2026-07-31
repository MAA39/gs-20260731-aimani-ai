import '@tanstack/react-start/server-only'
import type { MemberSummary, ProcessLabWorkspace, TodoHandoffSummary, TodoMemberSummary, TodoSummary } from '@aimani-ai/contracts'

const organization = { organizationId: 'org_acme_studio', name: 'Acme Studio' }
const owner: TodoMemberSummary = { membershipId: 'acme-studio-owner', name: '田中 彩', title: 'プロダクトオーナー' }
const sato: TodoMemberSummary = { membershipId: 'acme-studio-sato', name: '佐藤 花子', title: 'プロジェクトマネージャー' }
const mori: TodoMemberSummary = { membershipId: 'acme-studio-mori', name: '森 ハル', title: 'デザイナー' }
const people: MemberSummary[] = [
  { ...owner, relationshipKinds: [] },
  { ...sato, relationshipKinds: ['manager_report'] },
  { ...mori, relationshipKinds: ['peer'] },
]
const members = new Map([owner, sato, mori].map((member) => [member.membershipId, member]))
const now = '2026-07-31T03:00:00.000Z'

let todos: TodoSummary[] = [
  {
    todoId: 'todo-demo-customer-interview', organizationId: organization.organizationId,
    contextMembershipId: mori.membershipId, title: '顧客インタビューの論点を整理する',
    description: '次回の検証で確かめたい仮説を3つに絞る', status: 'open', creator: owner,
    assignee: owner, createdAt: now, updatedAt: now,
    pendingHandoff: { handoffId: 'handoff-demo-review', requester: owner, recipient: sato, requestMessage: '仮説の優先順位を一緒に確認してください', requestedAt: now },
  },
  {
    todoId: 'todo-demo-prototype', organizationId: organization.organizationId,
    contextMembershipId: mori.membershipId, title: 'プロトタイプの迷いどころを記録する',
    description: '操作中に止まった箇所を画面ごとに残す', status: 'open', creator: owner,
    assignee: mori, createdAt: now, updatedAt: now, pendingHandoff: null,
  },
  {
    todoId: 'todo-demo-completed', organizationId: organization.organizationId,
    contextMembershipId: sato.membershipId, title: '公開デモの対象範囲を決める',
    description: null, status: 'completed', creator: owner, assignee: sato,
    createdAt: now, updatedAt: now, pendingHandoff: null,
  },
]

let handoffs: TodoHandoffSummary[] = [{
  handoffId: 'handoff-demo-review', organizationId: organization.organizationId,
  todo: todos[0], requester: owner, recipient: sato,
  requestMessage: '仮説の優先順位を一緒に確認してください', nextAction: null,
  status: 'requested', requestedAt: now, resolvedAt: null,
}]

let processLab: ProcessLabWorkspace = {
  board: { boardId: 'process-lab-acme-product-launch', organizationId: organization.organizationId, name: '新製品を顧客へ届ける', revision: 1 },
  steps: [
    ['problem_discovery', '課題を確かめる', '顧客が本当に困っている場面と言葉を集める。', 'completed', owner, '2026-07-21'],
    ['experience_design', '体験を設計する', '最短で価値を確かめられる体験を描く。', 'completed', sato, '2026-07-24'],
    ['prototype_validation', 'プロトタイプを触って確かめる', '実際に触れる画面で迷いと期待を観察する。', 'in_progress', mori, '2026-07-30'],
    ['launch_preparation', '提供準備を整える', '提供開始に必要な運用を整える。', 'not_started', owner, '2026-08-03'],
    ['customer_guidance', '利用案内を用意する', '最初の価値へ迷わず到達できる案内を作る。', 'not_started', sato, '2026-08-03'],
    ['product_launch', '顧客へ届ける', '準備が揃った状態で新製品を届ける。', 'not_started', mori, '2026-08-06'],
  ].map(([stepId, title, description, status, assignee, dueDate]) => ({
    stepId: stepId as string, boardId: 'process-lab-acme-product-launch', organizationId: organization.organizationId,
    title: title as string, description: description as string, status: status as 'not_started' | 'in_progress' | 'completed',
    assignee: { membershipId: (assignee as TodoMemberSummary).membershipId, name: (assignee as TodoMemberSummary).name, image: null }, dueDate: dueDate as string,
  })),
  dependencies: [
    ['problem_discovery', 'experience_design'], ['experience_design', 'prototype_validation'],
    ['prototype_validation', 'launch_preparation'], ['prototype_validation', 'customer_guidance'],
    ['launch_preparation', 'product_launch'], ['customer_guidance', 'product_launch'],
  ].map(([predecessorStepId, successorStepId]) => ({ predecessorStepId, successorStepId })),
  layouts: [
    ['problem_discovery', 24, 180], ['experience_design', 320, 180], ['prototype_validation', 616, 180],
    ['launch_preparation', 912, 64], ['customer_guidance', 912, 296], ['product_launch', 1208, 180],
  ].map(([stepId, x, y]) => ({ stepId: stepId as string, x: x as number, y: y as number })),
}

const json = (body: unknown, status = 200) => Response.json(body, { status })
const findTodo = (todoId: string) => todos.find((todo) => todo.todoId === todoId)
const refreshHandoffTodo = (todo: TodoSummary) => { handoffs = handoffs.map((handoff) => handoff.todo.todoId === todo.todoId ? { ...handoff, todo } : handoff) }

export async function mockApiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init)
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  if (method === 'GET' && path === '/organizations') return json({ organizationMemberships: [{ ...organization, slug: 'acme-studio', membershipId: owner.membershipId, role: 'owner', displayName: owner.name }] })
  if (method === 'GET' && /\/organizations\/[^/]+\/people$/.test(path)) return json({ people })
  if (method === 'GET' && path.endsWith('/todos/assigned-to-me')) return json({ organization, currentMember: owner, todos: todos.filter((todo) => todo.assignee.membershipId === owner.membershipId && todo.status === 'open') })
  if (method === 'GET' && /\/people\/[^/]+\/todos$/.test(path)) {
    const contextMembershipId = path.split('/').at(-2) ?? ''
    return json({ organization, currentMember: owner, contextMember: people.find((person) => person.membershipId === contextMembershipId) ?? people[0], todos: todos.filter((todo) => todo.contextMembershipId === contextMembershipId) })
  }
  if (method === 'POST' && /\/people\/[^/]+\/todos$/.test(path)) {
    const body = await request.json() as { title: string; description?: string; assigneeMembershipId: string }
    const contextMembershipId = path.split('/').at(-2) ?? mori.membershipId
    const todo: TodoSummary = { todoId: `todo-demo-${Date.now()}`, organizationId: organization.organizationId, contextMembershipId, title: body.title, description: body.description ?? null, status: 'open', creator: owner, assignee: members.get(body.assigneeMembershipId) ?? owner, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pendingHandoff: null }
    todos = [todo, ...todos]
    return json({ todo }, 201)
  }
  const completeMatch = path.match(/\/todos\/([^/]+)\/complete$/)
  if (method === 'POST' && completeMatch) {
    const todo = findTodo(completeMatch[1])
    if (!todo) return json({ error: { message: 'not_found' } }, 404)
    const completed = { ...todo, status: 'completed' as const, updatedAt: new Date().toISOString() }
    todos = todos.map((item) => item.todoId === completed.todoId ? completed : item)
    refreshHandoffTodo(completed)
    return json({ todo: completed })
  }
  if (method === 'GET' && path.endsWith('/handoffs')) return json({ organization, currentMember: owner, incomingRequests: handoffs.filter((handoff) => handoff.status === 'requested' && handoff.recipient.membershipId === owner.membershipId), outgoingRequests: handoffs.filter((handoff) => handoff.status === 'requested' && handoff.requester.membershipId === owner.membershipId), recentHandoffs: handoffs.filter((handoff) => handoff.status !== 'requested') })
  const requestMatch = path.match(/\/todos\/([^/]+)\/handoffs$/)
  if (method === 'POST' && requestMatch) {
    const todo = findTodo(requestMatch[1])
    if (!todo) return json({ error: { message: 'not_found' } }, 404)
    const body = await request.json() as { recipientMembershipId: string; requestMessage?: string }
    const recipient = members.get(body.recipientMembershipId) ?? sato
    const handoffId = `handoff-demo-${Date.now()}`
    const pendingHandoff = { handoffId, requester: owner, recipient, requestMessage: body.requestMessage ?? null, requestedAt: new Date().toISOString() }
    const updatedTodo = { ...todo, pendingHandoff }
    todos = todos.map((item) => item.todoId === todo.todoId ? updatedTodo : item)
    const handoff: TodoHandoffSummary = { handoffId, organizationId: organization.organizationId, todo: updatedTodo, requester: owner, recipient, requestMessage: body.requestMessage ?? null, nextAction: null, status: 'requested', requestedAt: pendingHandoff.requestedAt, resolvedAt: null }
    handoffs = [handoff, ...handoffs]
    return json({ handoff, todo: updatedTodo }, 201)
  }
  const decisionMatch = path.match(/\/handoffs\/([^/]+)\/(accept|reject|cancel)$/)
  if (method === 'POST' && decisionMatch) {
    const [handoffId, verb] = [decisionMatch[1], decisionMatch[2]]
    const existing = handoffs.find((handoff) => handoff.handoffId === handoffId)
    if (!existing) return json({ error: { message: 'not_found' } }, 404)
    const body = verb === 'accept' ? await request.json() as { nextAction?: string } : {}
    const todo = { ...existing.todo, assignee: verb === 'accept' ? existing.recipient : existing.todo.assignee, pendingHandoff: null, updatedAt: new Date().toISOString() }
    const handoff = { ...existing, todo, status: (verb === 'cancel' ? 'canceled' : `${verb}ed`) as 'accepted' | 'rejected' | 'canceled', nextAction: 'nextAction' in body ? body.nextAction ?? null : null, resolvedAt: new Date().toISOString() }
    todos = todos.map((item) => item.todoId === todo.todoId ? todo : item)
    handoffs = handoffs.map((item) => item.handoffId === handoffId ? handoff : item)
    return json({ handoff, todo })
  }
  if (method === 'GET' && path.endsWith('/work')) return json({ organization, currentMember: owner, members: [owner, sato, mori].map((member) => ({ member, openTodos: todos.filter((todo) => todo.status === 'open' && todo.assignee.membershipId === member.membershipId) })), recentlyCompletedTodos: todos.filter((todo) => todo.status === 'completed') })
  if (path.endsWith('/process-lab') && method === 'GET') return json(processLab)
  const stepStatusMatch = path.match(/\/process-lab\/steps\/([^/]+)\/status$/)
  if (method === 'PATCH' && stepStatusMatch) { const body = await request.json() as { status: 'not_started' | 'in_progress' | 'completed' }; processLab = { ...processLab, board: { ...processLab.board, revision: processLab.board.revision + 1 }, steps: processLab.steps.map((step) => step.stepId === stepStatusMatch[1] ? { ...step, status: body.status } : step) }; return json(processLab) }
  const stepLayoutMatch = path.match(/\/process-lab\/steps\/([^/]+)\/layout$/)
  if (method === 'PATCH' && stepLayoutMatch) { const body = await request.json() as { x: number; y: number }; processLab = { ...processLab, layouts: processLab.layouts.map((layout) => layout.stepId === stepLayoutMatch[1] ? { ...layout, ...body } : layout) }; return json(processLab) }
  if (method === 'POST' && path.endsWith('/process-lab/dependencies')) { const body = await request.json() as { predecessorStepId: string; successorStepId: string }; processLab = { ...processLab, dependencies: [...processLab.dependencies, body] }; return json(processLab, 201) }
  const dependencyMatch = path.match(/\/process-lab\/dependencies\/([^/]+)\/([^/]+)$/)
  if (method === 'DELETE' && dependencyMatch) { processLab = { ...processLab, dependencies: processLab.dependencies.filter((item) => item.predecessorStepId !== dependencyMatch[1] || item.successorStepId !== dependencyMatch[2]) }; return json(processLab) }
  return json({ error: { message: 'mock_route_not_found' } }, 404)
}
