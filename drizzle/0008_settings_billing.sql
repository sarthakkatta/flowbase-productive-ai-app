CREATE TABLE "user_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"scope" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"preferences" jsonb NOT NULL,
	"notifications" jsonb NOT NULL,
	"privacy" jsonb NOT NULL,
	"ai" jsonb NOT NULL,
	"integrations" jsonb NOT NULL,
	"usage" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kanban_tasks" ADD COLUMN "category_name" text;
--> statement-breakpoint
ALTER TABLE "kanban_tasks" ADD COLUMN "category_color" text;
--> statement-breakpoint
ALTER TABLE "kanban_tasks" ADD COLUMN "category_icon" text;
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "category_name" text;
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "category_color" text;
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "category_icon" text;
--> statement-breakpoint
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_categories_user_scope_idx" ON "user_categories" USING btree ("user_id","scope");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_categories_user_scope_name_unique" ON "user_categories" USING btree ("user_id","scope","name");
