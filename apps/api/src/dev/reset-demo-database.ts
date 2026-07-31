import { createNodePgDatabase } from '@aimani-ai/db/client'
import { migrateDatabase } from '@aimani-ai/db/migrations'
import { deriveLocalDemoDatabaseUrl, assertLocalDemoDatabaseUrl } from './demo-database-url'
import { seedDemoData } from '../demo/seed-demo-data'

const source = process.env.DATABASE_URL
if (!source) throw new Error('DATABASE_URL is required.')

const target = assertLocalDemoDatabaseUrl(deriveLocalDemoDatabaseUrl(source))
const maintenance = new URL(target.toString())
maintenance.pathname = '/postgres'

const maintenanceClient = createNodePgDatabase(maintenance.toString()).client
await maintenanceClient.connect()
try {
  const exists = await maintenanceClient.query('select 1 from pg_database where datname = $1', ['aimani_ai_demo'])
  if (exists.rowCount === 0) await maintenanceClient.query('CREATE DATABASE aimani_ai_demo')
} finally {
  await maintenanceClient.end()
}

const targetClient = createNodePgDatabase(target.toString()).client
await targetClient.connect()
try {
  await targetClient.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  // Drizzle keeps its migration journal outside public; clear it so reset is repeatable.
  await targetClient.query('DROP SCHEMA IF EXISTS drizzle CASCADE')
} finally {
  await targetClient.end()
}

await migrateDatabase(target.toString())
await seedDemoData(target.toString())
console.log('Demo database reset complete: aimani_ai_demo')
