CREATE TABLE "generated_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"prompt" text NOT NULL,
	"app_name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"definition" jsonb NOT NULL,
	"runtime_data" jsonb NOT NULL,
	"sidebar_position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_apps" ADD CONSTRAINT "generated_apps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "generated_apps_user_id_idx" ON "generated_apps" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "generated_apps_user_sidebar_unique" ON "generated_apps" USING btree ("user_id","sidebar_position");
