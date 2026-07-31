import { describe, expect, it } from 'vitest'
import { assertPublicDemoTarget } from './public-demo-target'

const confirmation = 'gs-20260731-aimani-ai'
const validUrl = 'postgresql://migration.branch:fake@abc.ap-northeast-1.horizon.psdb.cloud:5432/postgres?sslmode=verify-full'

describe('public demo database target', () => {
  it('accepts only the confirmed PlanetScale direct PostgreSQL target', () => {
    const target = assertPublicDemoTarget(validUrl, confirmation)

    expect(target.hostname).toBe('abc.ap-northeast-1.horizon.psdb.cloud')
    expect(target.port).toBe('5432')
    expect(target.pathname).toBe('/postgres')
  })

  it.each([
    ['confirmation mismatch', validUrl, 'another-product'],
    ['localhost', 'postgresql://postgres:fake@127.0.0.1:5432/postgres?sslmode=verify-full', confirmation],
    ['Supabase', 'postgresql://postgres:fake@db.example.supabase.co:5432/postgres?sslmode=verify-full', confirmation],
    ['pooler port', 'postgresql://migration.branch:fake@abc.ap-northeast-1.horizon.psdb.cloud:6543/postgres?sslmode=verify-full', confirmation],
    ['another database', 'postgresql://migration.branch:fake@abc.ap-northeast-1.horizon.psdb.cloud:5432/aimani_ai_demo?sslmode=verify-full', confirmation],
    ['unverified TLS', 'postgresql://migration.branch:fake@abc.ap-northeast-1.horizon.psdb.cloud:5432/postgres?sslmode=require', confirmation],
  ])('rejects %s without exposing credentials', (_case, databaseUrl, providedConfirmation) => {
    let message = ''
    try {
      assertPublicDemoTarget(databaseUrl, providedConfirmation)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toMatch(/Public demo database target/)
    expect(message).not.toContain('fake')
    expect(message).not.toContain('postgresql://')
  })
})
