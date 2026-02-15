CREATE TYPE "public"."ai_analysis_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVIEWED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ai_feature" AS ENUM('chatbot', 'radiograph', 'transcription', 'voice_notes', 'email_template', 'stock_image', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."ai_model" AS ENUM('gpt-4o-mini', 'gpt-4o', 'whisper-1', 'dall-e-3');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('VISIT', 'SURGERY', 'REVIEW', 'EMERGENCY', 'FOLLOWUP');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'AI_ANALYSIS');--> statement-breakpoint
CREATE TYPE "public"."bug_report_category" AS ENUM('UI', 'FUNCTIONALITY', 'DATA', 'PERFORMANCE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."bug_report_status" AS ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."chat_control_mode" AS ENUM('AI', 'HUMAN', 'PAUSED');--> statement-breakpoint
CREATE TYPE "public"."chat_conversation_status" AS ENUM('ACTIVE', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."chat_message_direction" AS ENUM('INBOUND', 'OUTBOUND');--> statement-breakpoint
CREATE TYPE "public"."chat_message_status" AS ENUM('SENT', 'DELIVERED', 'READ', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."dental_condition" AS ENUM('HEALTHY', 'CARIES', 'FILLING', 'TEMPORARY_FILLING', 'CROWN', 'EXTRACTION_INDICATED', 'MISSING', 'IMPLANT', 'ROOT_CANAL', 'FRACTURE', 'BRIDGE', 'VENEER', 'SEALANT', 'EROSION', 'ABRASION', 'PERIAPICAL_LESION', 'ROOT_RESORPTION', 'ROOT_FRACTURE');--> statement-breakpoint
CREATE TYPE "public"."email_template_type" AS ENUM('APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER_24H', 'APPOINTMENT_REMINDER_1H', 'APPOINTMENT_CANCELLED', 'DOCUMENT_SIGNED', 'VISIT_RATING_REQUEST', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."marketing_template_category" AS ENUM('birthday', 'promo', 'seasonal', 'educational', 'reactivation', 'onboarding', 'newsletter', 'custom');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'BOUNCED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'CARD', 'TRANSFER', 'INSURANCE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."rating_request_status" AS ENUM('PENDING', 'SENT', 'COMPLETED', 'EXPIRED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPERADMIN', 'ADMIN', 'WORKER', 'USER');--> statement-breakpoint
CREATE TYPE "public"."sms_template_type" AS ENUM('APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER_24H', 'APPOINTMENT_REMINDER_1H', 'APPOINTMENT_CANCELLED', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('IN', 'OUT', 'ADJUSTMENT', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."tooth_surface" AS ENUM('MESIAL', 'DISTAL', 'OCCLUSAL', 'VESTIBULAR', 'PALATINO');--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
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
CREATE TABLE "appointment_stock_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 2),
	"notes" text,
	"registered_by_id" uuid NOT NULL,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"worker_id" uuid,
	"type" "appointment_type" DEFAULT 'VISIT' NOT NULL,
	"status" "appointment_status" DEFAULT 'SCHEDULED' NOT NULL,
	"title" varchar(255),
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"duration" integer NOT NULL,
	"real_start_time" timestamp,
	"real_end_time" timestamp,
	"paused_duration" integer DEFAULT 0,
	"started_by_id" uuid,
	"notes" text,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"wa_notification_sent_at" timestamp,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audience_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"patient_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"clinic_id" uuid,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"template_id" uuid,
	"send_hour" integer DEFAULT 9 NOT NULL,
	"days_in_advance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "birthday_settings_clinic_id_unique" UNIQUE("clinic_id")
);
--> statement-breakpoint
CREATE TABLE "bug_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"clinic_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category" "bug_report_category" DEFAULT 'OTHER' NOT NULL,
	"status" "bug_report_status" DEFAULT 'PENDING' NOT NULL,
	"page_url" varchar(500),
	"user_agent" varchar(500),
	"admin_notes" text,
	"resolved_at" timestamp,
	"resolved_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_ai_logs" (
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
CREATE TABLE "chat_conversation_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
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
CREATE TABLE "chat_knowledge_articles" (
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
CREATE TABLE "chat_knowledge_bases" (
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
CREATE TABLE "chat_knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"embedding" vector(1536),
	"token_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_leads" (
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
CREATE TABLE "chat_messages" (
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
CREATE TABLE "chat_quick_replies" (
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
CREATE TABLE "clinical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"created_by_id" uuid NOT NULL,
	"record_type" varchar(50) NOT NULL,
	"title" varchar(255),
	"content" text,
	"vital_signs" jsonb,
	"procedures" jsonb,
	"diagnosis" text,
	"treatment" text,
	"prescriptions" jsonb,
	"tooth_chart" jsonb,
	"attachments" jsonb,
	"is_signed" boolean DEFAULT false NOT NULL,
	"signed_at" timestamp,
	"signed_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(2) DEFAULT 'ES',
	"timezone" varchar(50) DEFAULT 'Europe/Madrid',
	"settings" jsonb DEFAULT '{}'::jsonb,
	"working_hours" jsonb DEFAULT '{}'::jsonb,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"ai_monthly_token_limit" integer DEFAULT 100000,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid,
	"source_type" varchar(50) NOT NULL,
	"source_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"smtp_host" varchar(255) DEFAULT 'smtp.gmail.com',
	"smtp_port" integer DEFAULT 587,
	"smtp_user" varchar(255),
	"smtp_pass" varchar(500),
	"from_name" varchar(100),
	"from_email" varchar(255),
	"is_enabled" boolean DEFAULT false NOT NULL,
	"is_configured" boolean DEFAULT false NOT NULL,
	"send_on_create" boolean DEFAULT true NOT NULL,
	"send_on_cancel" boolean DEFAULT true NOT NULL,
	"reminder_24h_enabled" boolean DEFAULT true NOT NULL,
	"reminder_1h_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_settings_clinic_id_unique" UNIQUE("clinic_id")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"type" "email_template_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2),
	"expense_date" timestamp NOT NULL,
	"vendor" varchar(255),
	"invoice_reference" varchar(100),
	"attachment_url" varchar(500),
	"notes" text,
	"recorded_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"supplier_id" uuid,
	"sku" varchar(100),
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"unit" varchar(50) DEFAULT 'units',
	"current_stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"max_stock" integer,
	"cost_price" numeric(10, 2),
	"sell_price" numeric(10, 2),
	"supplier" varchar(255),
	"supplier_code" varchar(100),
	"expiration_date" timestamp,
	"location" varchar(100),
	"image_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '21',
	"tax_amount" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0',
	"items" jsonb NOT NULL,
	"notes" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"template_id" uuid,
	"segment_id" uuid,
	"name" varchar(100) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"html_content" text,
	"status" "campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"total_recipients" integer DEFAULT 0,
	"sent_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid,
	"name" varchar(100) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"category" "marketing_template_category" DEFAULT 'custom',
	"design_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"html_content" text,
	"preview_text" varchar(150),
	"thumbnail_url" varchar(500),
	"is_system_template" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid,
	"appointment_id" uuid,
	"template_id" uuid,
	"template_type" "email_template_type" NOT NULL,
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"subject" varchar(255),
	"status" "notification_status" DEFAULT 'PENDING' NOT NULL,
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odontogram_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"odontogram_id" uuid NOT NULL,
	"tooth_number" integer NOT NULL,
	"surface" varchar(20),
	"previous_condition" varchar(50),
	"new_condition" varchar(50) NOT NULL,
	"changed_by_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odontogram_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"odontogram_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"teeth_state" jsonb NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odontogram_teeth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"odontogram_id" uuid NOT NULL,
	"tooth_number" integer NOT NULL,
	"general_condition" "dental_condition" DEFAULT 'HEALTHY',
	"surfaces" jsonb DEFAULT '{"mesial":"HEALTHY","distal":"HEALTHY","occlusal":"HEALTHY","vestibular":"HEALTHY","palatino":"HEALTHY"}'::jsonb,
	"root_condition" "dental_condition" DEFAULT 'HEALTHY',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odontograms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"is_child" boolean DEFAULT false,
	"notes" text,
	"last_updated_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"logo_url" varchar(500),
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"user_id" uuid,
	"external_id" varchar(100),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"date_of_birth" timestamp,
	"gender" varchar(20),
	"id_number" varchar(50),
	"address" text,
	"city" varchar(100),
	"postal_code" varchar(20),
	"emergency_contact" varchar(255),
	"emergency_phone" varchar(50),
	"allergies" text,
	"medical_history" text,
	"notes" text,
	"insurance_provider" varchar(100),
	"insurance_number" varchar(100),
	"consent_given" boolean DEFAULT false NOT NULL,
	"consent_date" timestamp,
	"accepts_marketing" boolean DEFAULT true NOT NULL,
	"accepts_birthday_emails" boolean DEFAULT true NOT NULL,
	"marketing_unsubscribe_token" varchar(64),
	"whatsapp_available" boolean,
	"whatsapp_checked_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" varchar(255),
	"notes" text,
	"payment_date" timestamp NOT NULL,
	"recorded_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" "email_template_type" NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radiograph_ai_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"radiograph_id" uuid NOT NULL,
	"status" "ai_analysis_status" DEFAULT 'PENDING' NOT NULL,
	"model_version" varchar(50),
	"processing_time_ms" integer,
	"suspicious_areas" jsonb DEFAULT '[]'::jsonb,
	"summary" text,
	"confidence" numeric(5, 4),
	"raw_response" jsonb,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"is_accepted" boolean,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "radiograph_ai_results_radiograph_id_unique" UNIQUE("radiograph_id")
);
--> statement-breakpoint
CREATE TABLE "radiographs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinical_record_id" uuid,
	"uploaded_by_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"radiograph_type" varchar(50),
	"tooth_numbers" jsonb,
	"notes" text,
	"annotations" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" "rating_request_status" DEFAULT 'PENDING' NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rating_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(500) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"replaced_by_token" varchar(500),
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sms_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"account_sid" varchar(100),
	"auth_token" varchar(100),
	"from_number" varchar(20),
	"is_enabled" boolean DEFAULT false NOT NULL,
	"is_configured" boolean DEFAULT false NOT NULL,
	"send_on_create" boolean DEFAULT true NOT NULL,
	"send_on_cancel" boolean DEFAULT true NOT NULL,
	"reminder_24h_enabled" boolean DEFAULT true NOT NULL,
	"reminder_1h_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sms_settings_clinic_id_unique" UNIQUE("clinic_id")
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"type" "sms_template_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"license_number" varchar(100),
	"specialty" varchar(100),
	"bio" text,
	"color" varchar(7),
	"working_days" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 2),
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"reason" text,
	"reference" varchar(255),
	"performed_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_pack_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_person" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"phone2" varchar(50),
	"website" varchar(500),
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(50),
	"avatar_url" varchar(500),
	"role" "role" DEFAULT 'USER' NOT NULL,
	"organization_id" uuid,
	"clinic_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" varchar(255),
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" varchar(255),
	"token_version" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visit_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"rating_request_id" uuid NOT NULL,
	"patient_id" uuid,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "visit_ratings_appointment_id_unique" UNIQUE("appointment_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_settings" (
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
	"wa_notify_enabled" boolean DEFAULT false NOT NULL,
	"wa_template_created" varchar(255),
	"wa_template_mapping_created" jsonb,
	"wa_template_modified" varchar(255),
	"wa_template_mapping_modified" jsonb,
	"wa_template_cancelled" varchar(255),
	"wa_template_mapping_cancelled" jsonb,
	"wa_template_reminder_24h" varchar(255),
	"wa_template_mapping_reminder_24h" jsonb,
	"wa_template_reminder_1h" varchar(255),
	"wa_template_mapping_reminder_1h" jsonb,
	"wa_reminder_24h_enabled" boolean DEFAULT false NOT NULL,
	"wa_reminder_1h_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_settings_clinic_id_unique" UNIQUE("clinic_id")
);
--> statement-breakpoint
CREATE TABLE "worker_clinics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"role" varchar(50),
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_rating_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_stock_usage" ADD CONSTRAINT "appointment_stock_usage_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_stock_usage" ADD CONSTRAINT "appointment_stock_usage_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_stock_usage" ADD CONSTRAINT "appointment_stock_usage_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_stock_usage" ADD CONSTRAINT "appointment_stock_usage_registered_by_id_users_id_fk" FOREIGN KEY ("registered_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_workers" ADD CONSTRAINT "appointment_workers_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_workers" ADD CONSTRAINT "appointment_workers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_started_by_id_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_segments" ADD CONSTRAINT "audience_segments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_segments" ADD CONSTRAINT "audience_segments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_email_log" ADD CONSTRAINT "birthday_email_log_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_email_log" ADD CONSTRAINT "birthday_email_log_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_settings" ADD CONSTRAINT "birthday_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_settings" ADD CONSTRAINT "birthday_settings_template_id_marketing_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."marketing_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_ai_logs" ADD CONSTRAINT "chat_ai_logs_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_ai_logs" ADD CONSTRAINT "chat_ai_logs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_ai_logs" ADD CONSTRAINT "chat_ai_logs_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_notes" ADD CONSTRAINT "chat_conversation_notes_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_notes" ADD CONSTRAINT "chat_conversation_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_closed_by_id_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_knowledge_articles" ADD CONSTRAINT "chat_knowledge_articles_knowledge_base_id_chat_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."chat_knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_knowledge_articles" ADD CONSTRAINT "chat_knowledge_articles_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_knowledge_articles" ADD CONSTRAINT "chat_knowledge_articles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_knowledge_bases" ADD CONSTRAINT "chat_knowledge_bases_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_knowledge_bases" ADD CONSTRAINT "chat_knowledge_bases_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_knowledge_chunks" ADD CONSTRAINT "chat_knowledge_chunks_article_id_chat_knowledge_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."chat_knowledge_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_knowledge_chunks" ADD CONSTRAINT "chat_knowledge_chunks_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_leads" ADD CONSTRAINT "chat_leads_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_leads" ADD CONSTRAINT "chat_leads_converted_patient_id_patients_id_fk" FOREIGN KEY ("converted_patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_leads" ADD CONSTRAINT "chat_leads_converted_by_id_users_id_fk" FOREIGN KEY ("converted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_quick_replies" ADD CONSTRAINT "chat_quick_replies_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_signed_by_id_users_id_fk" FOREIGN KEY ("signed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_template_id_marketing_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."marketing_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_segment_id_audience_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."audience_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_templates" ADD CONSTRAINT "marketing_templates_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_templates" ADD CONSTRAINT "marketing_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_history" ADD CONSTRAINT "odontogram_history_odontogram_id_odontograms_id_fk" FOREIGN KEY ("odontogram_id") REFERENCES "public"."odontograms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_history" ADD CONSTRAINT "odontogram_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_snapshots" ADD CONSTRAINT "odontogram_snapshots_odontogram_id_odontograms_id_fk" FOREIGN KEY ("odontogram_id") REFERENCES "public"."odontograms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_snapshots" ADD CONSTRAINT "odontogram_snapshots_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_teeth" ADD CONSTRAINT "odontogram_teeth_odontogram_id_odontograms_id_fk" FOREIGN KEY ("odontogram_id") REFERENCES "public"."odontograms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograms" ADD CONSTRAINT "odontograms_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograms" ADD CONSTRAINT "odontograms_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograms" ADD CONSTRAINT "odontograms_last_updated_by_id_users_id_fk" FOREIGN KEY ("last_updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiograph_ai_results" ADD CONSTRAINT "radiograph_ai_results_radiograph_id_radiographs_id_fk" FOREIGN KEY ("radiograph_id") REFERENCES "public"."radiographs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiograph_ai_results" ADD CONSTRAINT "radiograph_ai_results_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_clinical_record_id_clinical_records_id_fk" FOREIGN KEY ("clinical_record_id") REFERENCES "public"."clinical_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_requests" ADD CONSTRAINT "rating_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_requests" ADD CONSTRAINT "rating_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_requests" ADD CONSTRAINT "rating_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_settings" ADD CONSTRAINT "sms_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_pack_items" ADD CONSTRAINT "stock_pack_items_pack_id_stock_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."stock_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_pack_items" ADD CONSTRAINT "stock_pack_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_packs" ADD CONSTRAINT "stock_packs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_packs" ADD CONSTRAINT "stock_packs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_rating_request_id_rating_requests_id_fk" FOREIGN KEY ("rating_request_id") REFERENCES "public"."rating_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_clinics" ADD CONSTRAINT "worker_clinics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_clinics" ADD CONSTRAINT "worker_clinics_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_ratings" ADD CONSTRAINT "worker_ratings_visit_rating_id_visit_ratings_id_fk" FOREIGN KEY ("visit_rating_id") REFERENCES "public"."visit_ratings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_ratings" ADD CONSTRAINT "worker_ratings_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_ratings" ADD CONSTRAINT "worker_ratings_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_logs_clinic_idx" ON "ai_usage_logs" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_feature_idx" ON "ai_usage_logs" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_clinic_created_idx" ON "ai_usage_logs" USING btree ("clinic_id","created_at");--> statement-breakpoint
CREATE INDEX "appointment_stock_usage_clinic_id_idx" ON "appointment_stock_usage" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "appointment_stock_usage_appointment_id_idx" ON "appointment_stock_usage" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_stock_usage_item_id_idx" ON "appointment_stock_usage" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "appointment_stock_usage_created_at_idx" ON "appointment_stock_usage" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_workers_apt_user_idx" ON "appointment_workers" USING btree ("appointment_id","user_id");--> statement-breakpoint
CREATE INDEX "appointment_workers_appointment_id_idx" ON "appointment_workers" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_workers_user_id_idx" ON "appointment_workers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "appointments_clinic_id_idx" ON "appointments" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "appointments_patient_id_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "appointments_worker_id_idx" ON "appointments" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "appointments_start_time_idx" ON "appointments" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audience_segments_clinic_id_idx" ON "audience_segments" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_logs_clinic_id_idx" ON "audit_logs" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "birthday_email_log_unique_idx" ON "birthday_email_log" USING btree ("clinic_id","patient_id","year");--> statement-breakpoint
CREATE INDEX "bug_reports_user_id_idx" ON "bug_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bug_reports_organization_id_idx" ON "bug_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bug_reports_clinic_id_idx" ON "bug_reports" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "bug_reports_status_idx" ON "bug_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bug_reports_created_at_idx" ON "bug_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "campaign_recipients_campaign_id_idx" ON "campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_recipients_status_idx" ON "campaign_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chat_ai_logs_conversation_idx" ON "chat_ai_logs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_ai_logs_clinic_idx" ON "chat_ai_logs" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "chat_ai_logs_created_at_idx" ON "chat_ai_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_conversation_notes_conv_idx" ON "chat_conversation_notes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_clinic_idx" ON "chat_conversations" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_patient_idx" ON "chat_conversations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_phone_idx" ON "chat_conversations" USING btree ("wa_contact_phone");--> statement-breakpoint
CREATE INDEX "chat_conversations_status_idx" ON "chat_conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chat_conversations_control_mode_idx" ON "chat_conversations" USING btree ("control_mode");--> statement-breakpoint
CREATE INDEX "chat_conversations_last_message_idx" ON "chat_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_active_phone_idx" ON "chat_conversations" USING btree ("clinic_id","wa_contact_phone") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "chat_knowledge_articles_kb_idx" ON "chat_knowledge_articles" USING btree ("knowledge_base_id");--> statement-breakpoint
CREATE INDEX "chat_knowledge_articles_clinic_idx" ON "chat_knowledge_articles" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "chat_knowledge_bases_clinic_idx" ON "chat_knowledge_bases" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "chat_knowledge_chunks_article_idx" ON "chat_knowledge_chunks" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "chat_knowledge_chunks_clinic_idx" ON "chat_knowledge_chunks" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "chat_leads_clinic_idx" ON "chat_leads" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "chat_leads_phone_idx" ON "chat_leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "chat_leads_status_idx" ON "chat_leads" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_leads_clinic_phone_idx" ON "chat_leads" USING btree ("clinic_id","phone");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_messages_clinic_idx" ON "chat_messages" USING btree ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_wamid_idx" ON "chat_messages" USING btree ("wamid");--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_quick_replies_clinic_idx" ON "chat_quick_replies" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "clinical_records_clinic_id_idx" ON "clinical_records" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "clinical_records_patient_id_idx" ON "clinical_records" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "clinical_records_appointment_id_idx" ON "clinical_records" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "clinical_records_created_at_idx" ON "clinical_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "clinics_organization_id_idx" ON "clinics" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clinics_slug_org_idx" ON "clinics" USING btree ("slug","organization_id");--> statement-breakpoint
CREATE INDEX "document_embeddings_clinic_id_idx" ON "document_embeddings" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "document_embeddings_patient_id_idx" ON "document_embeddings" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "document_embeddings_source_idx" ON "document_embeddings" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "email_templates_clinic_type_idx" ON "email_templates" USING btree ("clinic_id","type");--> statement-breakpoint
CREATE INDEX "expenses_clinic_id_idx" ON "expenses" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "expenses_expense_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "inventory_items_clinic_id_idx" ON "inventory_items" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "inventory_items_supplier_id_idx" ON "inventory_items" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "inventory_items_sku_idx" ON "inventory_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "inventory_items_category_idx" ON "inventory_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "inventory_items_low_stock_idx" ON "inventory_items" USING btree ("current_stock","min_stock");--> statement-breakpoint
CREATE INDEX "invoices_clinic_id_idx" ON "invoices" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "invoices_patient_id_idx" ON "invoices" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_clinic_idx" ON "invoices" USING btree ("invoice_number","clinic_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_clinic_id_idx" ON "marketing_campaigns" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_status_idx" ON "marketing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_scheduled_at_idx" ON "marketing_campaigns" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "marketing_templates_clinic_id_idx" ON "marketing_templates" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "marketing_templates_category_idx" ON "marketing_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "marketing_templates_system_idx" ON "marketing_templates" USING btree ("is_system_template");--> statement-breakpoint
CREATE INDEX "notification_logs_clinic_idx" ON "notification_logs" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "notification_logs_patient_idx" ON "notification_logs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "notification_logs_status_idx" ON "notification_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "odontogram_history_odontogram_idx" ON "odontogram_history" USING btree ("odontogram_id");--> statement-breakpoint
CREATE INDEX "odontogram_history_tooth_idx" ON "odontogram_history" USING btree ("odontogram_id","tooth_number");--> statement-breakpoint
CREATE INDEX "odontogram_snapshots_odontogram_idx" ON "odontogram_snapshots" USING btree ("odontogram_id");--> statement-breakpoint
CREATE INDEX "odontogram_teeth_odontogram_idx" ON "odontogram_teeth" USING btree ("odontogram_id");--> statement-breakpoint
CREATE UNIQUE INDEX "odontogram_teeth_unique_idx" ON "odontogram_teeth" USING btree ("odontogram_id","tooth_number");--> statement-breakpoint
CREATE INDEX "odontograms_clinic_idx" ON "odontograms" USING btree ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "odontograms_patient_unique_idx" ON "odontograms" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "patients_clinic_id_idx" ON "patients" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "patients_user_id_idx" ON "patients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "patients_email_idx" ON "patients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "patients_name_idx" ON "patients" USING btree ("first_name","last_name");--> statement-breakpoint
CREATE INDEX "payments_clinic_id_idx" ON "payments" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_payment_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_notifications_appointment_idx" ON "pending_notifications" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "pending_notifications_scheduled_for_idx" ON "pending_notifications" USING btree ("scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "radiograph_ai_results_radiograph_id_idx" ON "radiograph_ai_results" USING btree ("radiograph_id");--> statement-breakpoint
CREATE INDEX "radiograph_ai_results_status_idx" ON "radiograph_ai_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "radiographs_clinic_id_idx" ON "radiographs" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "radiographs_patient_id_idx" ON "radiographs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "radiographs_uploaded_by_id_idx" ON "radiographs" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX "rating_requests_clinic_idx" ON "rating_requests" USING btree ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_requests_appointment_idx" ON "rating_requests" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_requests_token_idx" ON "rating_requests" USING btree ("token");--> statement-breakpoint
CREATE INDEX "rating_requests_status_idx" ON "rating_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rating_requests_scheduled_for_idx" ON "rating_requests" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_idx" ON "refresh_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sms_templates_clinic_type_idx" ON "sms_templates" USING btree ("clinic_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_user_id_idx" ON "staff_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_movements_clinic_id_idx" ON "stock_movements" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "stock_movements_item_id_idx" ON "stock_movements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_pack_items_pack_id_idx" ON "stock_pack_items" USING btree ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_pack_items_pack_item_idx" ON "stock_pack_items" USING btree ("pack_id","item_id");--> statement-breakpoint
CREATE INDEX "stock_packs_clinic_id_idx" ON "stock_packs" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "stock_packs_name_idx" ON "stock_packs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "suppliers_clinic_id_idx" ON "suppliers" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_organization_id_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_clinic_id_idx" ON "users" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "visit_ratings_clinic_idx" ON "visit_ratings" USING btree ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "visit_ratings_appointment_idx" ON "visit_ratings" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "visit_ratings_rating_idx" ON "visit_ratings" USING btree ("rating");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_clinics_user_clinic_idx" ON "worker_clinics" USING btree ("user_id","clinic_id");--> statement-breakpoint
CREATE INDEX "worker_clinics_user_id_idx" ON "worker_clinics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "worker_clinics_clinic_id_idx" ON "worker_clinics" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "worker_ratings_visit_rating_idx" ON "worker_ratings" USING btree ("visit_rating_id");--> statement-breakpoint
CREATE INDEX "worker_ratings_worker_idx" ON "worker_ratings" USING btree ("worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_ratings_worker_apt_idx" ON "worker_ratings" USING btree ("worker_id","appointment_id");