ALTER TYPE "dental_condition" ADD VALUE 'TEMPORARY_FILLING';--> statement-breakpoint
ALTER TYPE "dental_condition" ADD VALUE 'EROSION';--> statement-breakpoint
ALTER TYPE "dental_condition" ADD VALUE 'ABRASION';--> statement-breakpoint
ALTER TYPE "dental_condition" ADD VALUE 'PERIAPICAL_LESION';--> statement-breakpoint
ALTER TYPE "dental_condition" ADD VALUE 'ROOT_RESORPTION';--> statement-breakpoint
ALTER TYPE "dental_condition" ADD VALUE 'ROOT_FRACTURE';--> statement-breakpoint
ALTER TABLE "odontogram_teeth" ADD COLUMN "root_condition" "dental_condition" DEFAULT 'HEALTHY';--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "whatsapp_available" boolean;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "whatsapp_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_mapping_created" jsonb;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_mapping_modified" jsonb;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_mapping_cancelled" jsonb;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_mapping_reminder_24h" jsonb;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD COLUMN "wa_template_mapping_reminder_1h" jsonb;