import { createNodePgDatabase } from '@aimani-ai/db/client';
import { resolveDatabaseUrl, type ApiBindings } from '../config/env';
import * as schema from '@aimani-ai/db/schema';
import { createAuth } from '../auth/create-auth';
import { eq } from 'drizzle-orm';

const password = 'aimani-ai-demo-2026';
const users = [['owner@aimani-ai.local','田中 彩'],['sato@aimani-ai.local','佐藤 花子'],['suzuki@aimani-ai.local','鈴木 健'],['mori@aimani-ai.local','森 ハル']] as const;
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
      const members = slug === 'acme-studio' ? [['owner@aimani-ai.local','owner','田中 彩'],['sato@aimani-ai.local','manager','佐藤 花子'],['mori@aimani-ai.local','member','森 ハル']] : [['owner@aimani-ai.local','owner','田中 彩'],['suzuki@aimani-ai.local','member','鈴木 健']];
      for (const [email,role,displayName] of members) {
        const user = byEmail.get(email);
        if (!user) throw new Error(`Seed fixture incomplete: user ${email} is missing.`);
        await resource.database.insert(schema.membership).values({ id: `${slug}-${email.split('@')[0]}`, userId:user.id, organizationId:org.id, displayName, role, status:'active', createdAt:now, updatedAt:now }).onConflictDoUpdate({ target:[schema.membership.userId,schema.membership.organizationId], set:{displayName,role,status:'active',updatedAt:now} });
      }
      const membershipRows = await resource.database.select().from(schema.membership);
      const memberId = (email: string) => { const user = byEmail.get(email); if (!user) throw new Error(`Seed fixture incomplete: user ${email} is missing.`); return requireMembershipId(membershipRows, org.id, user.id, email); };
      const relation = slug === 'acme-studio' ? ['sato@aimani-ai.local','manager_report'] : ['suzuki@aimani-ai.local','peer'];
      await resource.database.insert(schema.relationship).values({ id: `${slug}-owner-${relation[0].split('@')[0]}`, organizationId: org.id, sourceMembershipId: memberId('owner@aimani-ai.local'), targetMembershipId: memberId(relation[0]), kind: relation[1], createdAt: now, updatedAt: now }).onConflictDoUpdate({ target:[schema.relationship.organizationId,schema.relationship.sourceMembershipId,schema.relationship.targetMembershipId,schema.relationship.kind], set:{updatedAt: now} });
    }
    await resource.database.insert(schema.todo).values({ id:'todo-demo-customer-interview', organizationId:'org_acme_studio', contextMembershipId:'acme-studio-mori', creatorMembershipId:'acme-studio-owner', assigneeMembershipId:'acme-studio-owner', title:'顧客インタビューの論点を整理する', description:'次回の検証で確かめたい仮説を3つに絞る', status:'open', createdAt:DEMO_STORY_TIME, updatedAt:DEMO_STORY_TIME }).onConflictDoUpdate({ target:schema.todo.id, set:{ assigneeMembershipId:'acme-studio-owner', title:'顧客インタビューの論点を整理する', description:'次回の検証で確かめたい仮説を3つに絞る', status:'open', updatedAt:DEMO_STORY_TIME } });

    const boardId = 'process-lab-acme-product-launch';
    await resource.database
      .insert(schema.processLabBoard)
      .values({
        id: boardId,
        organizationId: 'org_acme_studio',
        name: '新製品を顧客へ届ける',
        revision: 1,
        createdAt: DEMO_STORY_TIME,
        updatedAt: DEMO_STORY_TIME,
      })
      .onConflictDoUpdate({
        target: schema.processLabBoard.id,
        set: {
          name: '新製品を顧客へ届ける',
          revision: 1,
          updatedAt: DEMO_STORY_TIME,
        },
      });

    const processSteps = [
      {
        id: 'problem_discovery',
        assigneeMembershipId: 'acme-studio-owner',
        title: '課題を確かめる',
        description: '顧客が本当に困っている場面と言葉を集める。',
        dueDate: '2026-07-21',
        status: 'completed',
        x: 24,
        y: 180,
      },
      {
        id: 'experience_design',
        assigneeMembershipId: 'acme-studio-sato',
        title: '体験を設計する',
        description: '課題から、最短で価値を確かめられる体験を描く。',
        dueDate: '2026-07-24',
        status: 'completed',
        x: 320,
        y: 180,
      },
      {
        id: 'prototype_validation',
        assigneeMembershipId: 'acme-studio-mori',
        title: 'プロトタイプを触って確かめる',
        description: '実際に触れる画面で、迷いと期待を観察する。',
        dueDate: '2026-07-30',
        status: 'in_progress',
        x: 616,
        y: 180,
      },
      {
        id: 'launch_preparation',
        assigneeMembershipId: 'acme-studio-owner',
        title: '提供準備を整える',
        description: '提供開始に必要な運用とサポートを整える。',
        dueDate: '2026-08-03',
        status: 'not_started',
        x: 912,
        y: 64,
      },
      {
        id: 'customer_guidance',
        assigneeMembershipId: 'acme-studio-sato',
        title: '利用案内を用意する',
        description: '顧客が最初の価値へ迷わず到達できる案内を作る。',
        dueDate: '2026-08-03',
        status: 'not_started',
        x: 912,
        y: 296,
      },
      {
        id: 'product_launch',
        assigneeMembershipId: 'acme-studio-mori',
        title: '顧客へ届ける',
        description: '準備と案内が揃った状態で、新製品を顧客へ届ける。',
        dueDate: '2026-08-06',
        status: 'not_started',
        x: 1208,
        y: 180,
      },
    ] as const;

    for (const step of processSteps) {
      await resource.database
        .insert(schema.processLabStep)
        .values({
          id: step.id,
          boardId,
          organizationId: 'org_acme_studio',
          assigneeMembershipId: step.assigneeMembershipId,
          title: step.title,
          description: step.description,
          dueDate: step.dueDate,
          status: step.status,
          createdAt: DEMO_STORY_TIME,
          updatedAt: DEMO_STORY_TIME,
        })
        .onConflictDoUpdate({
          target: schema.processLabStep.id,
          set: {
            assigneeMembershipId: step.assigneeMembershipId,
            title: step.title,
            description: step.description,
            dueDate: step.dueDate,
            status: step.status,
            updatedAt: DEMO_STORY_TIME,
          },
        });
      await resource.database
        .insert(schema.processLabStepLayout)
        .values({
          boardId,
          organizationId: 'org_acme_studio',
          stepId: step.id,
          x: step.x,
          y: step.y,
          updatedAt: DEMO_STORY_TIME,
        })
        .onConflictDoUpdate({
          target: [
            schema.processLabStepLayout.boardId,
            schema.processLabStepLayout.stepId,
          ],
          set: { x: step.x, y: step.y, updatedAt: DEMO_STORY_TIME },
        });
    }

    const processDependencies = [
      ['problem_discovery', 'experience_design'],
      ['experience_design', 'prototype_validation'],
      ['prototype_validation', 'launch_preparation'],
      ['prototype_validation', 'customer_guidance'],
      ['launch_preparation', 'product_launch'],
      ['customer_guidance', 'product_launch'],
      ['experience_design', 'customer_guidance'],
    ] as const;
    for (const [predecessorStepId, successorStepId] of processDependencies) {
      await resource.database
        .insert(schema.processLabDependency)
        .values({
          boardId,
          organizationId: 'org_acme_studio',
          predecessorStepId,
          successorStepId,
          createdAt: DEMO_STORY_TIME,
        })
        .onConflictDoNothing();
    }
  } finally { await resource.client.end(); }
}
