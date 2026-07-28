import { createNodePgDatabase } from '@amidala/db/client'
import { migrateDatabase } from '@amidala/db/migrations'
import { deriveLocalDemoDatabaseUrl, assertLocalDemoDatabaseUrl } from './demo-database-url'
import { seedDevelopmentData } from './seed-development-data'

const source = process.env.DATABASE_URL
if (!source) throw new Error('DATABASE_URL is required.')

const target = assertLocalDemoDatabaseUrl(deriveLocalDemoDatabaseUrl(source))
const maintenance = new URL(target.toString())
maintenance.pathname = '/postgres'

const maintenanceClient = createNodePgDatabase(maintenance.toString()).client
await maintenanceClient.connect()
try {
  const exists = await maintenanceClient.query('select 1 from pg_database where datname = $1', ['amidala_demo'])
  if (exists.rowCount === 0) await maintenanceClient.query('CREATE DATABASE amidala_demo')
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
await seedDevelopmentData(target.toString())
console.log('Demo database reset complete: amidala_demo')
