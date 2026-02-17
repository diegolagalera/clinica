CREATE TYPE "public"."document_template_category" AS ENUM('CONSENT', 'DATA_PROTECTION', 'SURGERY_AUTH', 'TREATMENT_PLAN', 'ORTHODONTICS', 'EXTRACTION', 'WHITENING', 'MINOR_AUTH', 'RADIOGRAPH_CONSENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."signing_method" AS ENUM('EMBEDDED', 'EMAIL');--> statement-breakpoint
CREATE TYPE "public"."signing_status" AS ENUM('DRAFT', 'PENDING', 'SIGNED', 'DECLINED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "document_template_category" DEFAULT 'OTHER' NOT NULL,
	"signnow_template_id" varchar(255),
	"file_storage_key" varchar(500),
	"fields" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"template_id" uuid,
	"name" varchar(255) NOT NULL,
	"signnow_document_id" varchar(255),
	"status" "signing_status" DEFAULT 'DRAFT' NOT NULL,
	"signing_method" "signing_method" DEFAULT 'EMBEDDED' NOT NULL,
	"signed_at" timestamp with time zone,
	"signer_ip" varchar(45),
	"signed_pdf_storage_key" varchar(500),
	"sent_by_id" uuid NOT NULL,
	"email_sent_to" varchar(255),
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_documents" ADD CONSTRAINT "signing_documents_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_documents" ADD CONSTRAINT "signing_documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_documents" ADD CONSTRAINT "signing_documents_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_documents" ADD CONSTRAINT "signing_documents_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_templates_clinic_id_idx" ON "document_templates" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "document_templates_category_idx" ON "document_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "signing_documents_clinic_id_idx" ON "signing_documents" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "signing_documents_patient_id_idx" ON "signing_documents" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "signing_documents_template_id_idx" ON "signing_documents" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "signing_documents_status_idx" ON "signing_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signing_documents_created_at_idx" ON "signing_documents" USING btree ("created_at");