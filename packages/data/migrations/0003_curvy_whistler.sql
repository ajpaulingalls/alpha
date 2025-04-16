ALTER TABLE "users" ADD COLUMN "verification_code" varchar(6);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "validated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "validation_timeout" timestamp;