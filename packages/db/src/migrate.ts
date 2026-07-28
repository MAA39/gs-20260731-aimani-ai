import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { migrateDatabase } from './migrations.js';

loadEnvFile(resolve(process.cwd(), 'apps/api/.dev.vars'));
await migrateDatabase(process.env.DATABASE_URL ?? '');
