CREATE TABLE "process_lab_board" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "process_lab_board_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "process_lab_board_name_check" CHECK (char_length(btrim("process_lab_board"."name")) between 1 and 120),
	CONSTRAINT "process_lab_board_revision_check" CHECK ("process_lab_board"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "process_lab_dependency" (
	"board_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"predecessor_step_id" text NOT NULL,
	"successor_step_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "process_lab_dependency_pk" PRIMARY KEY("board_id","predecessor_step_id","successor_step_id"),
	CONSTRAINT "process_lab_dependency_distinct_steps_check" CHECK ("process_lab_dependency"."predecessor_step_id" <> "process_lab_dependency"."successor_step_id")
);
--> statement-breakpoint
CREATE TABLE "process_lab_step" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"assignee_membership_id" text,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "process_lab_step_identity_unique" UNIQUE("id","board_id","organization_id"),
	CONSTRAINT "process_lab_step_title_check" CHECK (char_length(btrim("process_lab_step"."title")) between 1 and 160),
	CONSTRAINT "process_lab_step_description_check" CHECK ("process_lab_step"."description" is null or char_length("process_lab_step"."description") <= 2000),
	CONSTRAINT "process_lab_step_status_check" CHECK ("process_lab_step"."status" in ('not_started', 'in_progress', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "process_lab_step_layout" (
	"board_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"step_id" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "process_lab_step_layout_pk" PRIMARY KEY("board_id","step_id"),
	CONSTRAINT "process_lab_step_layout_x_check" CHECK ("process_lab_step_layout"."x" between -100000 and 100000),
	CONSTRAINT "process_lab_step_layout_y_check" CHECK ("process_lab_step_layout"."y" between -100000 and 100000)
);
--> statement-breakpoint
ALTER TABLE "process_lab_board" ADD CONSTRAINT "process_lab_board_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_lab_dependency" ADD CONSTRAINT "process_lab_dependency_predecessor_fk" FOREIGN KEY ("predecessor_step_id","board_id","organization_id") REFERENCES "public"."process_lab_step"("id","board_id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_lab_dependency" ADD CONSTRAINT "process_lab_dependency_successor_fk" FOREIGN KEY ("successor_step_id","board_id","organization_id") REFERENCES "public"."process_lab_step"("id","board_id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_lab_step" ADD CONSTRAINT "process_lab_step_board_fk" FOREIGN KEY ("board_id","organization_id") REFERENCES "public"."process_lab_board"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_lab_step" ADD CONSTRAINT "process_lab_step_assignee_fk" FOREIGN KEY ("assignee_membership_id","organization_id") REFERENCES "public"."membership"("id","organization_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_lab_step_layout" ADD CONSTRAINT "process_lab_step_layout_step_fk" FOREIGN KEY ("step_id","board_id","organization_id") REFERENCES "public"."process_lab_step"("id","board_id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "process_lab_board_organization_idx" ON "process_lab_board" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_lab_dependency_successor_idx" ON "process_lab_dependency" USING btree ("board_id","successor_step_id");--> statement-breakpoint
CREATE INDEX "process_lab_step_board_idx" ON "process_lab_step" USING btree ("organization_id","board_id");