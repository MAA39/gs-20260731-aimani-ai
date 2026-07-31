import { loadEnvFile } from 'node:process';
import { defineConfig } from 'drizzle-kit';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
try { loadEnvFile(resolve(repositoryRoot, 'apps/api/.dev.vars')); } catch { /* optional for config inspection */ }

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani_ai' },
});
