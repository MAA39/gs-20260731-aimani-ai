import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { migrateDatabase } from './migrations.js';
import { resolveMigrationDatabaseUrl } from './migration-database-url.js';

const databaseUrl = resolveMigrationDatabaseUrl(process.env.DATABASE_URL, () => {
  loadEnvFile(resolve(process.cwd(), 'apps/api/.dev.vars'))
  return process.env.DATABASE_URL
})

await migrateDatabase(databaseUrl);
