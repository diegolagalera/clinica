DO $$ BEGIN
 CREATE TYPE "email_template_type" AS ENUM('APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER_24H', 'APPOINTMENT_REMINDER_1H', 'APPOINTMENT_CANCELLED', 'DOCUMENT_SIGNED', 'CUSTOM');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notification_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'BOUNCED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_settings" (
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_settings_clinic_id_unique" UNIQUE("clinic_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_templates" (
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
CREATE TABLE IF NOT EXISTS "notification_logs" (
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
CREATE TABLE IF NOT EXISTS "odontogram_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"odontogram_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"teeth_state" jsonb NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_templates_clinic_type_idx" ON "email_templates" ("clinic_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_logs_clinic_idx" ON "notification_logs" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_logs_patient_idx" ON "notification_logs" ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_logs_status_idx" ON "notification_logs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_logs_created_at_idx" ON "notification_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "odontogram_snapshots_odontogram_idx" ON "odontogram_snapshots" ("odontogram_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "odontogram_snapshots" ADD CONSTRAINT "odontogram_snapshots_odontogram_id_odontograms_id_fk" FOREIGN KEY ("odontogram_id") REFERENCES "odontograms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "odontogram_snapshots" ADD CONSTRAINT "odontogram_snapshots_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
