ALTER TABLE "todo" ADD CONSTRAINT "todo_id_organization_unique" UNIQUE("id","organization_id");--> statement-breakpoint
CREATE TABLE "todo_handoff" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"todo_id" text NOT NULL,
	"requester_membership_id" text NOT NULL,
	"recipient_membership_id" text NOT NULL,
	"request_message" text,
	"status" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "todo_handoff_status_check" CHECK ("todo_handoff"."status" in ('requested','accepted','rejected','canceled')),
	CONSTRAINT "todo_handoff_distinct_memberships_check" CHECK ("todo_handoff"."requester_membership_id" <> "todo_handoff"."recipient_membership_id"),
	CONSTRAINT "todo_handoff_request_message_check" CHECK ("todo_handoff"."request_message" is null or char_length("todo_handoff"."request_message") <= 500),
	CONSTRAINT "todo_handoff_resolution_consistency_check" CHECK (("todo_handoff"."status" = 'requested' and "todo_handoff"."resolved_at" is null) or ("todo_handoff"."status" <> 'requested' and "todo_handoff"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "todo_handoff" ADD CONSTRAINT "todo_handoff_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_handoff" ADD CONSTRAINT "todo_handoff_todo_organization_fk" FOREIGN KEY ("todo_id","organization_id") REFERENCES "public"."todo"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_handoff" ADD CONSTRAINT "todo_handoff_requester_membership_fk" FOREIGN KEY ("requester_membership_id","organization_id") REFERENCES "public"."membership"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_handoff" ADD CONSTRAINT "todo_handoff_recipient_membership_fk" FOREIGN KEY ("recipient_membership_id","organization_id") REFERENCES "public"."membership"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "todo_handoff_one_requested_per_todo_unique" ON "todo_handoff" USING btree ("organization_id","todo_id") WHERE "todo_handoff"."status" = 'requested';--> statement-breakpoint
CREATE INDEX "todo_handoff_recipient_requested_idx" ON "todo_handoff" USING btree ("organization_id","recipient_membership_id","requested_at");--> statement-breakpoint
CREATE INDEX "todo_handoff_requester_requested_idx" ON "todo_handoff" USING btree ("organization_id","requester_membership_id","requested_at");--> statement-breakpoint
CREATE INDEX "todo_handoff_todo_timeline_idx" ON "todo_handoff" USING btree ("organization_id","todo_id","requested_at");--> statement-breakpoint
