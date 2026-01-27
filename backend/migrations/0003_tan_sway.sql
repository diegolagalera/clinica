DO $$ BEGIN
 CREATE TYPE "sms_template_type" AS ENUM('APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER_24H', 'APPOINTMENT_REMINDER_1H', 'APPOINTMENT_CANCELLED', 'CUSTOM');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_settings" (
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
CREATE TABLE IF NOT EXISTS "sms_templates" (
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
CREATE INDEX IF NOT EXISTS "sms_templates_clinic_type_idx" ON "sms_templates" ("clinic_id","type");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sms_settings" ADD CONSTRAINT "sms_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
