import { describe, expect, it } from 'vitest'
import { assertLocalDemoDatabaseUrl, deriveLocalDemoDatabaseUrl } from './demo-database-url'

describe('assertLocalDemoDatabaseUrl', () => {
  it.each([
    'postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani_ai_demo',
    'postgresql://aimani_ai:aimani_ai@localhost:54329/aimani_ai_demo',
  ])('accepts only the local demo database: %s', (value) => {
    expect(assertLocalDemoDatabaseUrl(value).pathname).toBe('/aimani_ai_demo')
  })

  it.each([
    'postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani-ai',
    'postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani_ai_handoff',
    'postgresql://user:pass@example.com:5432/aimani_ai_demo',
    'http://localhost:54329/aimani_ai_demo',
    'postgres://localhost:54329/aimani_ai_demo',
    'not-a-url',
  ])('rejects an unsafe target: %s', (value) => {
    expect(() => assertLocalDemoDatabaseUrl(value)).toThrow(/local demo database/i)
  })
})

describe('deriveLocalDemoDatabaseUrl', () => {
  it('keeps local connection details and replaces only the database name', () => {
    expect(deriveLocalDemoDatabaseUrl('postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani-ai'))
      .toBe('postgresql://aimani_ai:aimani_ai@127.0.0.1:54329/aimani_ai_demo')
  })

  it('does not derive a target from a remote connection', () => {
    expect(() => deriveLocalDemoDatabaseUrl('postgresql://user:pass@example.com/db'))
      .toThrow(/local demo database/i)
  })

  it('does not derive a target from a non-PostgreSQL URL', () => {
    expect(() => deriveLocalDemoDatabaseUrl('http://localhost:54329/aimani-ai'))
      .toThrow(/local demo database/i)
  })
})
