CREATE TABLE "kanban_board_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"user_id" integer,
	"email" text NOT NULL,
	"role" text DEFAULT 'collaborator' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kanban_board_shares" ADD CONSTRAINT "kanban_board_shares_board_id_kanban_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_board_shares" ADD CONSTRAINT "kanban_board_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_board_shares" ADD CONSTRAINT "kanban_board_shares_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kanban_board_shares_board_email_unique" ON "kanban_board_shares" USING btree ("board_id","email");