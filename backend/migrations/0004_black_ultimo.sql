DO $$ BEGIN
 CREATE TYPE "rating_request_status" AS ENUM('PENDING', 'SENT', 'COMPLETED', 'EXPIRED', 'SKIPPED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "email_template_type" ADD VALUE 'VISIT_RATING_REQUEST';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointment_stock_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 2),
	"notes" text,
	"registered_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_notifications" (
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
CREATE TABLE IF NOT EXISTS "rating_requests" (
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
CREATE TABLE IF NOT EXISTS "stock_pack_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_packs" (
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
CREATE TABLE IF NOT EXISTS "visit_ratings" (
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
CREATE TABLE IF NOT EXISTS "worker_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_rating_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "worker_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "image_url" varchar(500);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_stock_usage_clinic_id_idx" ON "appointment_stock_usage" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_stock_usage_appointment_id_idx" ON "appointment_stock_usage" ("appointment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_stock_usage_item_id_idx" ON "appointment_stock_usage" ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_stock_usage_created_at_idx" ON "appointment_stock_usage" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pending_notifications_appointment_idx" ON "pending_notifications" ("appointment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_notifications_scheduled_for_idx" ON "pending_notifications" ("scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rating_requests_clinic_idx" ON "rating_requests" ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rating_requests_appointment_idx" ON "rating_requests" ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rating_requests_token_idx" ON "rating_requests" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rating_requests_status_idx" ON "rating_requests" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rating_requests_scheduled_for_idx" ON "rating_requests" ("scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_pack_items_pack_id_idx" ON "stock_pack_items" ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_pack_items_pack_item_idx" ON "stock_pack_items" ("pack_id","item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_packs_clinic_id_idx" ON "stock_packs" ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_packs_name_idx" ON "stock_packs" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_ratings_clinic_idx" ON "visit_ratings" ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visit_ratings_appointment_idx" ON "visit_ratings" ("appointment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_ratings_rating_idx" ON "visit_ratings" ("rating");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_ratings_visit_rating_idx" ON "worker_ratings" ("visit_rating_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_ratings_worker_idx" ON "worker_ratings" ("worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "worker_ratings_worker_apt_idx" ON "worker_ratings" ("worker_id","appointment_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_stock_usage" ADD CONSTRAINT "appointment_stock_usage_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_stock_usage" ADD CONSTRAINT "appointment_stock_usage_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_stock_usage" ADD CONSTRAINT "appointment_stock_usage_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_stock_usage" ADD CONSTRAINT "appointment_stock_usage_registered_by_id_users_id_fk" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rating_requests" ADD CONSTRAINT "rating_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rating_requests" ADD CONSTRAINT "rating_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rating_requests" ADD CONSTRAINT "rating_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_pack_items" ADD CONSTRAINT "stock_pack_items_pack_id_stock_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "stock_packs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_pack_items" ADD CONSTRAINT "stock_pack_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_packs" ADD CONSTRAINT "stock_packs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_packs" ADD CONSTRAINT "stock_packs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_rating_request_id_rating_requests_id_fk" FOREIGN KEY ("rating_request_id") REFERENCES "rating_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_ratings" ADD CONSTRAINT "worker_ratings_visit_rating_id_visit_ratings_id_fk" FOREIGN KEY ("visit_rating_id") REFERENCES "visit_ratings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_ratings" ADD CONSTRAINT "worker_ratings_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_ratings" ADD CONSTRAINT "worker_ratings_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
