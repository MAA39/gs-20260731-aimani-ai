import { defineConfig } from 'vitest/config'
import { assertLocalDemoDatabaseUrl } from './src/dev/demo-database-url'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for demo tests')
assertLocalDemoDatabaseUrl(databaseUrl)

export default defineConfig({
  test: {
    include: ['src/dev/demo-seed.integration.test.ts'],
  },
})
