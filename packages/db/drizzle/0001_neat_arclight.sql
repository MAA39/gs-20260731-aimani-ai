CREATE TABLE "todo" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"context_membership_id" text NOT NULL,
	"creator_membership_id" text NOT NULL,
	"assignee_membership_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "todo_context_creator_distinct_check" CHECK ("todo"."context_membership_id" <> "todo"."creator_membership_id"),
	CONSTRAINT "todo_status_check" CHECK ("todo"."status" in ('open','completed')),
	CONSTRAINT "todo_title_check" CHECK (char_length(btrim("todo"."title")) between 1 and 160),
	CONSTRAINT "todo_description_check" CHECK ("todo"."description" is null or char_length("todo"."description") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_context_membership_fk" FOREIGN KEY ("context_membership_id","organization_id") REFERENCES "public"."membership"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_creator_membership_fk" FOREIGN KEY ("creator_membership_id","organization_id") REFERENCES "public"."membership"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_assignee_membership_fk" FOREIGN KEY ("assignee_membership_id","organization_id") REFERENCES "public"."membership"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todo_organization_creator_context_created_idx" ON "todo" USING btree ("organization_id","creator_membership_id","context_membership_id","created_at");--> statement-breakpoint
CREATE INDEX "todo_organization_context_creator_created_idx" ON "todo" USING btree ("organization_id","context_membership_id","creator_membership_id","created_at");--> statement-breakpoint
CREATE INDEX "todo_organization_assignee_status_idx" ON "todo" USING btree ("organization_id","assignee_membership_id","status");