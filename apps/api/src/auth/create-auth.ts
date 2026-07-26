import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import * as schema from '@amidala/db/schema';
export function createAuth(database: any, env: { BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string }) {
  const trustedOrigins = [...new Set([env.BETTER_AUTH_URL, 'http://localhost:5173', 'http://localhost:8787'])];
  return betterAuth({ database: drizzleAdapter(database, { provider: 'pg', schema }), secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL, emailAndPassword: { enabled: true }, trustedOrigins, advanced: { defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: env.BETTER_AUTH_URL.startsWith('https://') } } });
}
