ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number");