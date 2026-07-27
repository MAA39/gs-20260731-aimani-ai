import { describe, expect, it } from 'vitest'
import { assertLocalDemoDatabaseUrl, deriveLocalDemoDatabaseUrl } from './demo-database-url'

describe('assertLocalDemoDatabaseUrl', () => {
  it.each([
    'postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo',
    'postgresql://amidala:amidala@localhost:54329/amidala_demo',
  ])('accepts only the local demo database: %s', (value) => {
    expect(assertLocalDemoDatabaseUrl(value).pathname).toBe('/amidala_demo')
  })

  it.each([
    'postgresql://amidala:amidala@127.0.0.1:54329/amidala',
    'postgresql://amidala:amidala@127.0.0.1:54329/amidala_handoff',
    'postgresql://user:pass@example.com:5432/amidala_demo',
    'not-a-url',
  ])('rejects an unsafe target: %s', (value) => {
    expect(() => assertLocalDemoDatabaseUrl(value)).toThrow(/local demo database/i)
  })
})

describe('deriveLocalDemoDatabaseUrl', () => {
  it('keeps local connection details and replaces only the database name', () => {
    expect(deriveLocalDemoDatabaseUrl('postgresql://amidala:amidala@127.0.0.1:54329/amidala'))
      .toBe('postgresql://amidala:amidala@127.0.0.1:54329/amidala_demo')
  })

  it('does not derive a target from a remote connection', () => {
    expect(() => deriveLocalDemoDatabaseUrl('postgresql://user:pass@example.com/db'))
      .toThrow(/local demo database/i)
  })
})
