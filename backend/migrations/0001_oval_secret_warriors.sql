CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"prescribed_by_id" uuid NOT NULL,
	"items" jsonb NOT NULL,
	"diagnosis" text,
	"notes" text,
	"pdf_storage_key" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "signature_image" text;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_prescribed_by_id_users_id_fk" FOREIGN KEY ("prescribed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prescriptions_clinic_id_idx" ON "prescriptions" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "prescriptions_patient_id_idx" ON "prescriptions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "prescriptions_prescribed_by_idx" ON "prescriptions" USING btree ("prescribed_by_id");--> statement-breakpoint
CREATE INDEX "prescriptions_created_at_idx" ON "prescriptions" USING btree ("created_at");