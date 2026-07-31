const expectedConfirmation = 'gs-20260731-aimani-ai'

function rejectTarget(): never {
  throw new Error('Public demo database target is not the dedicated PlanetScale database.')
}

export function assertPublicDemoTarget(databaseUrl: string, confirmation: string): URL {
  if (confirmation !== expectedConfirmation) rejectTarget()

  let target: URL
  try {
    target = new URL(databaseUrl)
  } catch {
    return rejectTarget()
  }

  if (target.protocol !== 'postgresql:') rejectTarget()
  if (!target.hostname.endsWith('.horizon.psdb.cloud')) rejectTarget()
  if (target.port !== '5432') rejectTarget()
  if (target.pathname !== '/postgres') rejectTarget()
  if (target.searchParams.get('sslmode') !== 'verify-full') rejectTarget()

  return target
}
