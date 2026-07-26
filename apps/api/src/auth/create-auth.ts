import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import * as schema from '@amidala/db/schema';
export function createAuth(db: any, env: { BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string }) {
  return betterAuth({ database: drizzleAdapter(db, { provider: 'pg', schema }), secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL, emailAndPassword: { enabled: true }, trustedOrigins: ['http://localhost:5173', 'http://localhost:8787'], advanced: { defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: false } } });
}
