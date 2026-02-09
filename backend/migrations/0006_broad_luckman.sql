DO $$ BEGIN
 CREATE TYPE "chat_control_mode" AS ENUM('AI', 'HUMAN', 'PAUSED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "chat_conversation_status" AS ENUM('ACTIVE', 'CLOSED', 'ARCHIVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "chat_message_direction" AS ENUM('INBOUND', 'OUTBOUND');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "chat_message_status" AS ENUM('SENT', 'DELIVERED', 'READ', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "lead_status" AS ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_ai_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"message_id" uuid,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"model" varchar(50),
	"latency_ms" integer,
	"rag_chunks_used" integer DEFAULT 0,
	"rag_context" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_conversation_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid,
	"lead_id" uuid,
	"wa_contact_phone" varchar(50) NOT NULL,
	"wa_contact_name" varchar(255),
	"status" "chat_conversation_status" DEFAULT 'ACTIVE' NOT NULL,
	"control_mode" "chat_control_mode" DEFAULT 'AI' NOT NULL,
	"assigned_to_id" uuid,
	"last_message_at" timestamp,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"closed_at" timestamp,
	"closed_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_knowledge_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"original_content" text NOT NULL,
	"source_type" varchar(20) DEFAULT 'text' NOT NULL,
	"source_filename" varchar(255),
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_knowledge_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(50) DEFAULT '📚',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"embedding" "vector(1536)",
	"token_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"phone" varchar(50) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"email" varchar(255),
	"notes" text,
	"source" varchar(50) DEFAULT 'whatsapp' NOT NULL,
	"status" "lead_status" DEFAULT 'NEW' NOT NULL,
	"converted_patient_id" uuid,
	"converted_by_id" uuid,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"direction" "chat_message_direction" NOT NULL,
	"content" text,
	"message_type" varchar(20) DEFAULT 'text' NOT NULL,
	"media_url" varchar(500),
	"wamid" varchar(255),
	"status" "chat_message_status" DEFAULT 'SENT',
	"is_from_ai" boolean DEFAULT false NOT NULL,
	"sent_by_id" uuid,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_quick_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"title" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"phone_number_id" varchar(100),
	"access_token" text,
	"business_account_id" varchar(100),
	"webhook_verify_token" varchar(100),
	"system_prompt" text,
	"auto_reply_enabled" boolean DEFAULT true NOT NULL,
	"inactivity_timeout_hours" integer DEFAULT 24 NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"is_configured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_settings_clinic_id_unique" UNIQUE("clinic_id")
);
--> statement-breakpoint
ALTER TABLE "bug_reports" DROP CONSTRAINT "bug_reports_user_id_users_id_fk";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_ai_logs_conversation_idx" ON "chat_ai_logs" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_ai_logs_clinic_idx" ON "chat_ai_logs" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_ai_logs_created_at_idx" ON "chat_ai_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversation_notes_conv_idx" ON "chat_conversation_notes" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_clinic_idx" ON "chat_conversations" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_patient_idx" ON "chat_conversations" ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_phone_idx" ON "chat_conversations" ("wa_contact_phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_status_idx" ON "chat_conversations" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_control_mode_idx" ON "chat_conversations" ("control_mode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_last_message_idx" ON "chat_conversations" ("last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_active_phone_idx" ON "chat_conversations" ("clinic_id","wa_contact_phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_knowledge_articles_kb_idx" ON "chat_knowledge_articles" ("knowledge_base_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_knowledge_articles_clinic_idx" ON "chat_knowledge_articles" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_knowledge_bases_clinic_idx" ON "chat_knowledge_bases" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_knowledge_chunks_article_idx" ON "chat_knowledge_chunks" ("article_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_knowledge_chunks_clinic_idx" ON "chat_knowledge_chunks" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_leads_clinic_idx" ON "chat_leads" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_leads_phone_idx" ON "chat_leads" ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_leads_status_idx" ON "chat_leads" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_leads_clinic_phone_idx" ON "chat_leads" ("clinic_id","phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_conversation_idx" ON "chat_messages" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_clinic_idx" ON "chat_messages" ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_wamid_idx" ON "chat_messages" ("wamid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_created_at_idx" ON "chat_messages" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_quick_replies_clinic_idx" ON "chat_quick_replies" ("clinic_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_ai_logs" ADD CONSTRAINT "chat_ai_logs_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_ai_logs" ADD CONSTRAINT "chat_ai_logs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_ai_logs" ADD CONSTRAINT "chat_ai_logs_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_conversation_notes" ADD CONSTRAINT "chat_conversation_notes_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_conversation_notes" ADD CONSTRAINT "chat_conversation_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_closed_by_id_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_knowledge_articles" ADD CONSTRAINT "chat_knowledge_articles_knowledge_base_id_chat_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "chat_knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_knowledge_articles" ADD CONSTRAINT "chat_knowledge_articles_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_knowledge_articles" ADD CONSTRAINT "chat_knowledge_articles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_knowledge_bases" ADD CONSTRAINT "chat_knowledge_bases_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_knowledge_bases" ADD CONSTRAINT "chat_knowledge_bases_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_knowledge_chunks" ADD CONSTRAINT "chat_knowledge_chunks_article_id_chat_knowledge_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "chat_knowledge_articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_knowledge_chunks" ADD CONSTRAINT "chat_knowledge_chunks_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_leads" ADD CONSTRAINT "chat_leads_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_leads" ADD CONSTRAINT "chat_leads_converted_patient_id_patients_id_fk" FOREIGN KEY ("converted_patient_id") REFERENCES "patients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_leads" ADD CONSTRAINT "chat_leads_converted_by_id_users_id_fk" FOREIGN KEY ("converted_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_quick_replies" ADD CONSTRAINT "chat_quick_replies_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
