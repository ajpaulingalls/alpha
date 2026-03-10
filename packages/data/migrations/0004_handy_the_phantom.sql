CREATE TABLE "cached_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_embedding" vector(1536),
	"response_text" text,
	"audio_filename" varchar(255),
	"source_summary" text,
	"content_type" varchar(20),
	"expires_at" timestamp,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "podcast_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_name" varchar(255),
	"title" varchar(255),
	"description" text,
	"published_at" timestamp,
	"source_url" varchar(500),
	"audio_filename" varchar(255),
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"timezone" varchar(50),
	"catch_up_depth" varchar(20) DEFAULT 'standard',
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"catch_up_delivered" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listen_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"content_id" uuid NOT NULL,
	"listened_at" timestamp DEFAULT now() NOT NULL,
	"completed_percent" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "phone_number" TO "email";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_phone_number_unique";--> statement-breakpoint
ALTER TABLE "podcast_topics" ADD COLUMN "episode_id" uuid;--> statement-breakpoint
ALTER TABLE "podcast_topics" ADD COLUMN "start_time" integer;--> statement-breakpoint
ALTER TABLE "podcast_topics" ADD COLUMN "end_time" integer;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listen_history" ADD CONSTRAINT "listen_history_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listen_history" ADD CONSTRAINT "listen_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cachedResponseEmbeddingIndex" ON "cached_responses" USING hnsw ("query_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "cached_responses_expires_at_idx" ON "cached_responses" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "podcast_episodes_show_name_idx" ON "podcast_episodes" USING btree ("show_name");--> statement-breakpoint
CREATE INDEX "podcast_episodes_published_at_idx" ON "podcast_episodes" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "listen_history_user_id_idx" ON "listen_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "listen_history_session_id_idx" ON "listen_history" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "podcast_topics" ADD CONSTRAINT "podcast_topics_episode_id_podcast_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."podcast_episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "podcast_topics_episode_id_idx" ON "podcast_topics" USING btree ("episode_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");