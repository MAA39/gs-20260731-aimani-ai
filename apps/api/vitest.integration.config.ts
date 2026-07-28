import { defineConfig } from 'vitest/config';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
export default defineConfig({ test: { include: ['src/**/*.integration.test.ts'], exclude: ['src/dev/**'] } });
