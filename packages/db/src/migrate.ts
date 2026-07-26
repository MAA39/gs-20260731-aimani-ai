import { loadEnvFile } from 'node:process';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { resolve } from 'node:path';

loadEnvFile(resolve(process.cwd(), 'apps/api/.dev.vars'));
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try { await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), 'packages/db/drizzle') }); }
finally { await client.end(); }
