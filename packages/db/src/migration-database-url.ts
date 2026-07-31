export function resolveMigrationDatabaseUrl(
  explicitUrl: string | undefined,
  loadDevelopmentUrl: () => string | undefined,
): string {
  const databaseUrl = explicitUrl || loadDevelopmentUrl()
  if (!databaseUrl) throw new Error('DATABASE_URL is required for migration.')
  return databaseUrl
}
