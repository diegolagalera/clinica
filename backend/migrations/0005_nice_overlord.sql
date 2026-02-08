DO $$ BEGIN
 CREATE TYPE "bug_report_category" AS ENUM('UI', 'FUNCTIONALITY', 'DATA', 'PERFORMANCE', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "bug_report_status" AS ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "campaign_status" AS ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "marketing_template_category" AS ENUM('birthday', 'promo', 'seasonal', 'educational', 'reactivation', 'onboarding', 'newsletter', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "appointment_status" ADD VALUE 'IN_PROGRESS';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audience_segments" (
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
CREATE TABLE IF NOT EXISTS "birthday_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "birthday_settings" (
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
CREATE TABLE IF NOT EXISTS "bug_reports" (
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
CREATE TABLE IF NOT EXISTS "campaign_recipients" (
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
CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
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
CREATE TABLE IF NOT EXISTS "marketing_templates" (
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
CREATE TABLE IF NOT EXISTS "suppliers" (
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
ALTER TABLE "appointment_stock_usage" ADD COLUMN "is_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_stock_usage" ADD COLUMN "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "real_start_time" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "real_end_time" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "paused_duration" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "started_by_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "accepts_marketing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "accepts_birthday_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "marketing_unsubscribe_token" varchar(64);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "unit_cost" numeric(10, 2);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audience_segments_clinic_id_idx" ON "audience_segments" ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "birthday_email_log_unique_idx" ON "birthday_email_log" ("clinic_id","patient_id","year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_user_id_idx" ON "bug_reports" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_organization_id_idx" ON "bug_reports" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_clinic_id_idx" ON "bug_reports" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_status_idx" ON "bug_reports" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_created_at_idx" ON "bug_reports" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_recipients_campaign_id_idx" ON "campaign_recipients" ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_recipients_status_idx" ON "campaign_recipients" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_campaigns_clinic_id_idx" ON "marketing_campaigns" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_campaigns_status_idx" ON "marketing_campaigns" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_campaigns_scheduled_at_idx" ON "marketing_campaigns" ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_templates_clinic_id_idx" ON "marketing_templates" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_templates_category_idx" ON "marketing_templates" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_templates_system_idx" ON "marketing_templates" ("is_system_template");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_clinic_id_idx" ON "suppliers" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_name_idx" ON "suppliers" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_supplier_id_idx" ON "inventory_items" ("supplier_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_started_by_id_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audience_segments" ADD CONSTRAINT "audience_segments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audience_segments" ADD CONSTRAINT "audience_segments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_email_log" ADD CONSTRAINT "birthday_email_log_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_email_log" ADD CONSTRAINT "birthday_email_log_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_settings" ADD CONSTRAINT "birthday_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_settings" ADD CONSTRAINT "birthday_settings_template_id_marketing_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "marketing_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_template_id_marketing_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "marketing_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_segment_id_audience_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "audience_segments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing_templates" ADD CONSTRAINT "marketing_templates_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing_templates" ADD CONSTRAINT "marketing_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
