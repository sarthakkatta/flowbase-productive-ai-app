CREATE TABLE "page_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"target_title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_user_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"last_opened_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"user_id" integer,
	"email" text NOT NULL,
	"role" text DEFAULT 'collaborator' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_user_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"last_opened_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_onboarding" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"spaces_seeded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" jsonb DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb NOT NULL,
	"plain_text" text DEFAULT '' NOT NULL,
	"template" text DEFAULT 'blank' NOT NULL,
	"page_type" text DEFAULT 'Document' NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_page_id_workspace_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."workspace_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_user_states" ADD CONSTRAINT "page_user_states_page_id_workspace_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."workspace_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_user_states" ADD CONSTRAINT "page_user_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_shares" ADD CONSTRAINT "space_shares_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_shares" ADD CONSTRAINT "space_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_shares" ADD CONSTRAINT "space_shares_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_user_states" ADD CONSTRAINT "space_user_states_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_user_states" ADD CONSTRAINT "space_user_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_onboarding" ADD CONSTRAINT "workspace_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_pages" ADD CONSTRAINT "workspace_pages_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_pages" ADD CONSTRAINT "workspace_pages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_pages" ADD CONSTRAINT "workspace_pages_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "page_links_page_target_unique" ON "page_links" USING btree ("page_id","target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_user_states_page_user_unique" ON "page_user_states" USING btree ("page_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "space_shares_space_email_unique" ON "space_shares" USING btree ("space_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "space_user_states_space_user_unique" ON "space_user_states" USING btree ("space_id","user_id");--> statement-breakpoint
CREATE INDEX "spaces_owner_id_idx" ON "spaces" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "workspace_pages_space_id_idx" ON "workspace_pages" USING btree ("space_id");