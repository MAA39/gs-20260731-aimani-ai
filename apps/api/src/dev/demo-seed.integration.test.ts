import { createNodePgDatabase } from '@amidala/db/client'
import { describe, expect, it } from 'vitest'
import { assertLocalDemoDatabaseUrl } from './demo-database-url'

const databaseUrl = assertLocalDemoDatabaseUrl(process.env.TEST_DATABASE_URL ?? '')

describe('deterministic demo seed', () => {
  it('proves the customer interview story in PostgreSQL', async () => {
    const resource = createNodePgDatabase(databaseUrl.toString())
    await resource.client.connect()
    try {
      const todo = await resource.client.query(
        `select id, title, description, assignee_membership_id, context_membership_id, status
           from todo
          where id = 'todo-demo-customer-interview'`,
      )
      const todoCount = await resource.client.query('select count(*)::text as count from todo')
      const handoffCount = await resource.client.query('select count(*)::text as count from todo_handoff')

      expect(todo.rows).toEqual([{
        id: 'todo-demo-customer-interview',
        title: '顧客インタビューの論点を整理する',
        description: '次回の検証で確かめたい仮説を3つに絞る',
        assignee_membership_id: 'acme-studio-owner',
        context_membership_id: 'acme-studio-mori',
        status: 'open',
      }])
      expect(Number(todoCount.rows[0].count)).toBeLessThanOrEqual(3)
      expect(Number(handoffCount.rows[0].count)).toBe(0)
    } finally {
      await resource.client.end()
    }
  })

  it('seeds one connected Process Lab board with a layout for every step', async () => {
    const resource = createNodePgDatabase(databaseUrl.toString())
    await resource.client.connect()
    try {
      const board = await resource.client.query(
        `select id, organization_id, name, revision
           from process_lab_board
          where id = 'process-lab-acme-product-launch'`,
      )
      const steps = await resource.client.query(
        `select id from process_lab_step
          where board_id = 'process-lab-acme-product-launch'
          order by id`,
      )
      const dependencies = await resource.client.query(
        `select predecessor_step_id, successor_step_id
           from process_lab_dependency
          where board_id = 'process-lab-acme-product-launch'`,
      )
      const layouts = await resource.client.query(
        `select step_id from process_lab_step_layout
          where board_id = 'process-lab-acme-product-launch'`,
      )

      const connectedStepIds = new Set(
        dependencies.rows.flatMap((dependency) => [
          dependency.predecessor_step_id,
          dependency.successor_step_id,
        ]),
      )
      expect(board.rows).toEqual([{
        id: 'process-lab-acme-product-launch',
        organization_id: 'org_acme_studio',
        name: '新製品を顧客へ届ける',
        revision: 1,
      }])
      expect(steps.rows).toHaveLength(6)
      expect(dependencies.rows).toHaveLength(7)
      expect(connectedStepIds).toEqual(new Set(steps.rows.map((step) => step.id)))
      expect(layouts.rows).toHaveLength(steps.rows.length)
    } finally {
      await resource.client.end()
    }
  })
})
