CREATE TABLE "clinic_medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"medication" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"default_dosage" varchar(255) NOT NULL,
	"default_frequency" varchar(255) NOT NULL,
	"default_duration" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinic_medications" ADD CONSTRAINT "clinic_medications_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clinic_medications_clinic_id_idx" ON "clinic_medications" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "clinic_medications_category_idx" ON "clinic_medications" USING btree ("category");