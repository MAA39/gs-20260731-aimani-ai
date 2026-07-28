export const DEMO_DATABASE_NAME = 'amidala_demo'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

export function assertLocalDemoDatabaseUrl(target: string): URL {
  let url: URL
  try {
    url = new URL(target)
  } catch {
    throw new Error('Refusing reset: target must be the local demo database.')
  }

  if (url.protocol !== 'postgresql:' || !LOCAL_HOSTS.has(url.hostname) || decodeURIComponent(url.pathname.slice(1)) !== DEMO_DATABASE_NAME) {
    throw new Error('Refusing reset: target must be the local demo database.')
  }

  return url
}

export function deriveLocalDemoDatabaseUrl(source: string): string {
  let url: URL
  try {
    url = new URL(source)
  } catch {
    throw new Error('Refusing reset: source must be a local PostgreSQL URL.')
  }

  if (url.protocol !== 'postgresql:' || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('Refusing reset: source must be a local demo database.')
  }

  url.pathname = `/${DEMO_DATABASE_NAME}`
  url.search = ''
  url.hash = ''
  return assertLocalDemoDatabaseUrl(url.toString()).toString().replace(/\/$/, '')
}
