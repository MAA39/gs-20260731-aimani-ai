import { createNodePgDatabase } from '@amidala/db/client';
import { resolveDatabaseUrl, type ApiBindings } from '../config/env';
import * as schema from '@amidala/db/schema';
import { createAuth } from '../auth/create-auth';
const env = process.env as unknown as ApiBindings;
const password = 'amidala-demo-2026';
const users = [['owner@amidala.local','田中 彩'],['sato@amidala.local','佐藤 花子'],['suzuki@amidala.local','鈴木 健'],['mori@amidala.local','森 ハル']] as const;
const orgs = [['acme-studio','Acme Studio'],['northstar-lab','Northstar Lab']] as const;
async function main() {
  const resource = createNodePgDatabase(resolveDatabaseUrl(env)); await resource.client.connect();
  try {
    const auth = createAuth(resource.db, env);
    for (const [email,name] of users) {
      const existing = await (resource.db.select().from(schema.user) as any).where(((await import('drizzle-orm')).eq as any)(schema.user.email,email));
      if (!existing.length) await auth.api.signUpEmail({ body: { email, password, name } });
      else { const result = await auth.api.signInEmail({ body: { email, password } }); if (!result) throw new Error(`Seed collision for ${email}: password/account unavailable; resolve locally without changing credentials.`); }
    }
    const now = new Date();
    const userRows = await resource.db.select().from(schema.user);
    const byEmail = new Map(userRows.map((u:any)=>[u.email,u]));
    for (const [slug,name] of orgs) {
      const [org] = await resource.db.insert(schema.organization).values({ id: slug, slug, name, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.organization.slug, set: { name, updatedAt: now } }).returning();
      const members = slug === 'acme-studio' ? [['owner@amidala.local','owner','田中 彩'],['sato@amidala.local','manager','佐藤 花子'],['mori@amidala.local','member','森 ハル']] : [['owner@amidala.local','owner','田中 彩'],['suzuki@amidala.local','member','鈴木 健']];
      for (const [email,role,displayName] of members) { const u:any = byEmail.get(email); await resource.db.insert(schema.membership).values({ id: `${slug}-${email.split('@')[0]}`, userId:u.id, organizationId:org.id, displayName, role, status:'active', createdAt:now, updatedAt:now }).onConflictDoUpdate({ target:[schema.membership.userId,schema.membership.organizationId], set:{displayName,role,status:'active',updatedAt:now} }); }
    }
  } finally { await resource.client.end(); }
}
main().catch((error)=>{ console.error(error); process.exitCode=1 });
