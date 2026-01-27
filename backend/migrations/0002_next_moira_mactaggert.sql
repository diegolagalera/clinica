ALTER TABLE "email_settings" ADD COLUMN "send_on_create" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "send_on_cancel" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "reminder_24h_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "reminder_1h_enabled" boolean DEFAULT true NOT NULL;