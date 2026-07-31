import { seedDemoData } from '../demo/seed-demo-data'
import { assertPublicDemoTarget } from './public-demo-target'

function requireEnvironment(name: 'DATABASE_URL' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'PUBLIC_DEMO_SEED_CONFIRMATION'): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const target = assertPublicDemoTarget(
  requireEnvironment('DATABASE_URL'),
  requireEnvironment('PUBLIC_DEMO_SEED_CONFIRMATION'),
)

requireEnvironment('BETTER_AUTH_SECRET')
requireEnvironment('BETTER_AUTH_URL')

await seedDemoData(target.toString())
console.log('Public demo seed complete: gs-20260731-aimani-ai')
