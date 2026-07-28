import { sql } from 'drizzle-orm';
import {
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { membership, organization } from './organization.js';

export const processLabBoard = pgTable(
  'process_lab_board',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('process_lab_board_id_organization_unique').on(
      table.id,
      table.organizationId,
    ),
    check(
      'process_lab_board_name_check',
      sql`char_length(btrim(${table.name})) between 1 and 120`,
    ),
    check('process_lab_board_revision_check', sql`${table.revision} >= 1`),
    index('process_lab_board_organization_idx').on(table.organizationId),
  ],
);

export const processLabStep = pgTable(
  'process_lab_step',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id').notNull(),
    organizationId: text('organization_id').notNull(),
    assigneeMembershipId: text('assignee_membership_id'),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: date('due_date'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('process_lab_step_identity_unique').on(
      table.id,
      table.boardId,
      table.organizationId,
    ),
    foreignKey({
      columns: [table.boardId, table.organizationId],
      foreignColumns: [processLabBoard.id, processLabBoard.organizationId],
      name: 'process_lab_step_board_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.assigneeMembershipId, table.organizationId],
      foreignColumns: [membership.id, membership.organizationId],
      name: 'process_lab_step_assignee_fk',
    }).onDelete('set null'),
    check(
      'process_lab_step_title_check',
      sql`char_length(btrim(${table.title})) between 1 and 160`,
    ),
    check(
      'process_lab_step_description_check',
      sql`${table.description} is null or char_length(${table.description}) <= 2000`,
    ),
    check(
      'process_lab_step_status_check',
      sql`${table.status} in ('not_started', 'in_progress', 'completed')`,
    ),
    index('process_lab_step_board_idx').on(
      table.organizationId,
      table.boardId,
    ),
  ],
);

export const processLabDependency = pgTable(
  'process_lab_dependency',
  {
    boardId: text('board_id').notNull(),
    organizationId: text('organization_id').notNull(),
    predecessorStepId: text('predecessor_step_id').notNull(),
    successorStepId: text('successor_step_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'process_lab_dependency_pk',
      columns: [
        table.boardId,
        table.predecessorStepId,
        table.successorStepId,
      ],
    }),
    foreignKey({
      columns: [
        table.predecessorStepId,
        table.boardId,
        table.organizationId,
      ],
      foreignColumns: [
        processLabStep.id,
        processLabStep.boardId,
        processLabStep.organizationId,
      ],
      name: 'process_lab_dependency_predecessor_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [
        table.successorStepId,
        table.boardId,
        table.organizationId,
      ],
      foreignColumns: [
        processLabStep.id,
        processLabStep.boardId,
        processLabStep.organizationId,
      ],
      name: 'process_lab_dependency_successor_fk',
    }).onDelete('cascade'),
    check(
      'process_lab_dependency_distinct_steps_check',
      sql`${table.predecessorStepId} <> ${table.successorStepId}`,
    ),
    index('process_lab_dependency_successor_idx').on(
      table.boardId,
      table.successorStepId,
    ),
  ],
);

export const processLabStepLayout = pgTable(
  'process_lab_step_layout',
  {
    boardId: text('board_id').notNull(),
    organizationId: text('organization_id').notNull(),
    stepId: text('step_id').notNull(),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'process_lab_step_layout_pk',
      columns: [table.boardId, table.stepId],
    }),
    foreignKey({
      columns: [table.stepId, table.boardId, table.organizationId],
      foreignColumns: [
        processLabStep.id,
        processLabStep.boardId,
        processLabStep.organizationId,
      ],
      name: 'process_lab_step_layout_step_fk',
    }).onDelete('cascade'),
    check(
      'process_lab_step_layout_x_check',
      sql`${table.x} between -100000 and 100000`,
    ),
    check(
      'process_lab_step_layout_y_check',
      sql`${table.y} between -100000 and 100000`,
    ),
  ],
);
