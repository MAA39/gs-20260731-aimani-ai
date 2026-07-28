import { resolve } from 'node:path'
import { Client } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

export async function migrateDatabase(connectionString: string): Promise<void> {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), 'packages/db/drizzle') })
  } finally {
    await client.end()
  }
}
