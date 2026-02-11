DO $$ BEGIN
 CREATE TYPE "ai_feature" AS ENUM('chatbot', 'radiograph', 'transcription', 'voice_notes', 'email_template', 'stock_image', 'assistant');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "ai_model" AS ENUM('gpt-4o-mini', 'gpt-4o', 'whisper-1', 'dall-e-3');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "lead_status" ADD VALUE 'LOST';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"feature" "ai_feature" NOT NULL,
	"model" "ai_model" NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost" numeric(10, 6) DEFAULT '0',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "wa_notification_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "ai_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "ai_monthly_token_limit" integer DEFAULT 100000;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_notify_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_created" varchar(255);--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_modified" varchar(255);--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_cancelled" varchar(255);--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_reminder_24h" varchar(255);--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_reminder_1h" varchar(255);--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_reminder_24h_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_reminder_1h_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "worker_clinics" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_logs_clinic_idx" ON "ai_usage_logs" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_logs_feature_idx" ON "ai_usage_logs" ("feature");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_logs_created_at_idx" ON "ai_usage_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_logs_clinic_created_idx" ON "ai_usage_logs" ("clinic_id","created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
