import { describe, expect, it } from 'vitest'
import { resolveMigrationDatabaseUrl } from './migration-database-url.js'

describe('migration database URL', () => {
  it('keeps an explicitly supplied production URL', () => {
    let developmentLoads = 0

    const result = resolveMigrationDatabaseUrl('postgresql://production.example/postgres', () => {
      developmentLoads += 1
      return 'postgresql://localhost/development'
    })

    expect(result).toBe('postgresql://production.example/postgres')
    expect(developmentLoads).toBe(0)
  })

  it('loads the development URL only when no explicit URL exists', () => {
    expect(resolveMigrationDatabaseUrl(undefined, () => 'postgresql://localhost/development'))
      .toBe('postgresql://localhost/development')
  })

  it('fails without including a connection string when neither URL exists', () => {
    expect(() => resolveMigrationDatabaseUrl(undefined, () => undefined))
      .toThrow('DATABASE_URL is required for migration.')
  })
})
