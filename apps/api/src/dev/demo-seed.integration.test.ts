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
})
