import { loadEnvFile } from 'node:process';
import { defineConfig } from 'drizzle-kit';
import { resolve } from 'node:path';

try { loadEnvFile(resolve(process.cwd(), 'apps/api/.dev.vars')); } catch { /* optional for config inspection */ }

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://amidala:amidala@127.0.0.1:54329/amidala' },
});
