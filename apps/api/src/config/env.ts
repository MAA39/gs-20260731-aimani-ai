export interface Hyperdrive { connectionString: string }
export interface ApiBindings { DATABASE_URL?: string; HYPERDRIVE?: Hyperdrive; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string }
export class ConfigurationError extends Error { constructor(message: string) { super(message); this.name = 'ConfigurationError' } }
export function resolveDatabaseUrl(env: ApiBindings): string {
  if (env.HYPERDRIVE?.connectionString) return env.HYPERDRIVE.connectionString;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  throw new ConfigurationError('Database configuration is missing');
}
