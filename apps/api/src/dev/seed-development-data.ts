import { createNodePgDatabase } from '@amidala/db/client';
import { resolveDatabaseUrl, type ApiBindings } from '../config/env';
import * as schema from '@amidala/db/schema';
import { createAuth } from '../auth/create-auth';
import { eq } from 'drizzle-orm';

const password = 'amidala-demo-2026';
const users = [['owner@amidala.local','田中 彩'],['sato@amidala.local','佐藤 花子'],['suzuki@amidala.local','鈴木 健'],['mori@amidala.local','森 ハル']] as const;
const orgs = [['org_acme_studio','acme-studio','Acme Studio'],['org_northstar_lab','northstar-lab','Northstar Lab']] as const;
const DEMO_STORY_TIME = new Date('2026-07-27T00:00:00.000Z');
type MembershipRow = typeof schema.membership.$inferSelect;
type UserRow = typeof schema.user.$inferSelect;
function requireMembershipId(rows: MembershipRow[], organizationId: string, userId: string, email: string): string {
  const membership = rows.find((row) => row.organizationId === organizationId && row.userId === userId);
  if (!membership) throw new Error(`Seed fixture incomplete: active membership for ${email} in ${organizationId} is missing.`);
  return membership.id;
}

export async function seedDevelopmentData(databaseUrl: string): Promise<void> {
  const env = process.env as unknown as ApiBindings;
  const resource = createNodePgDatabase(databaseUrl); await resource.client.connect();
  try {
    const auth = createAuth(resource.database, env);
    for (const [email,name] of users) {
      const existing = await resource.database.select().from(schema.user).where((eq as any)(schema.user.email, email));
      if (!existing.length) await auth.api.signUpEmail({ body: { email, password, name } });
      else { try { await auth.api.signInEmail({ body: { email, password } }); } catch (cause) { throw new Error(`Seed collision for ${email}: password/account unavailable; resolve locally without changing credentials.`, { cause }); } }
    }
    const now = new Date();
    const userRows = await resource.database.select().from(schema.user);
    const byEmail = new Map<string, UserRow>(userRows.map((user) => [user.email, user]));
    for (const [id,slug,name] of orgs) {
      const [org] = await resource.database.insert(schema.organization).values({ id, slug, name, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.organization.slug, set: { name, updatedAt: now } }).returning();
      const members = slug === 'acme-studio' ? [['owner@amidala.local','owner','田中 彩'],['sato@amidala.local','manager','佐藤 花子'],['mori@amidala.local','member','森 ハル']] : [['owner@amidala.local','owner','田中 彩'],['suzuki@amidala.local','member','鈴木 健']];
      for (const [email,role,displayName] of members) {
        const user = byEmail.get(email);
        if (!user) throw new Error(`Seed fixture incomplete: user ${email} is missing.`);
        await resource.database.insert(schema.membership).values({ id: `${slug}-${email.split('@')[0]}`, userId:user.id, organizationId:org.id, displayName, role, status:'active', createdAt:now, updatedAt:now }).onConflictDoUpdate({ target:[schema.membership.userId,schema.membership.organizationId], set:{displayName,role,status:'active',updatedAt:now} });
      }
      const membershipRows = await resource.database.select().from(schema.membership);
      const memberId = (email: string) => { const user = byEmail.get(email); if (!user) throw new Error(`Seed fixture incomplete: user ${email} is missing.`); return requireMembershipId(membershipRows, org.id, user.id, email); };
      const relation = slug === 'acme-studio' ? ['sato@amidala.local','manager_report'] : ['suzuki@amidala.local','peer'];
      await resource.database.insert(schema.relationship).values({ id: `${slug}-owner-${relation[0].split('@')[0]}`, organizationId: org.id, sourceMembershipId: memberId('owner@amidala.local'), targetMembershipId: memberId(relation[0]), kind: relation[1], createdAt: now, updatedAt: now }).onConflictDoUpdate({ target:[schema.relationship.organizationId,schema.relationship.sourceMembershipId,schema.relationship.targetMembershipId,schema.relationship.kind], set:{updatedAt: now} });
    }
    await resource.database.insert(schema.todo).values({ id:'todo-demo-customer-interview', organizationId:'org_acme_studio', contextMembershipId:'acme-studio-mori', creatorMembershipId:'acme-studio-owner', assigneeMembershipId:'acme-studio-owner', title:'顧客インタビューの論点を整理する', description:'次回の検証で確かめたい仮説を3つに絞る', status:'open', createdAt:DEMO_STORY_TIME, updatedAt:DEMO_STORY_TIME }).onConflictDoUpdate({ target:schema.todo.id, set:{ assigneeMembershipId:'acme-studio-owner', title:'顧客インタビューの論点を整理する', description:'次回の検証で確かめたい仮説を3つに絞る', status:'open', updatedAt:DEMO_STORY_TIME } });
  } finally { await resource.client.end(); }
}
