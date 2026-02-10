import { db } from './index.js';
import { sql } from 'drizzle-orm';

async function migrate() {
    console.log('Applying AI usage tracking migration...');

    await db.execute(sql`
        DO $$ BEGIN 
            CREATE TYPE "ai_feature" AS ENUM('chatbot','radiograph','transcription','voice_notes','email_template','stock_image','assistant'); 
        EXCEPTION WHEN duplicate_object THEN null; END $$
    `);

    await db.execute(sql`
        DO $$ BEGIN 
            CREATE TYPE "ai_model" AS ENUM('gpt-4o-mini','gpt-4o','whisper-1','dall-e-3'); 
        EXCEPTION WHEN duplicate_object THEN null; END $$
    `);

    await db.execute(sql`ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "ai_enabled" boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "ai_monthly_token_limit" integer DEFAULT 100000`);

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
            "feature" "ai_feature" NOT NULL,
            "model" "ai_model" NOT NULL,
            "prompt_tokens" integer DEFAULT 0 NOT NULL,
            "completion_tokens" integer DEFAULT 0 NOT NULL,
            "total_tokens" integer DEFAULT 0 NOT NULL,
            "estimated_cost" numeric(10,6) DEFAULT '0',
            "metadata" jsonb,
            "created_at" timestamp DEFAULT now() NOT NULL
        )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "ai_usage_logs_clinic_idx" ON "ai_usage_logs"("clinic_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "ai_usage_logs_feature_idx" ON "ai_usage_logs"("feature")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "ai_usage_logs_created_at_idx" ON "ai_usage_logs"("created_at")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "ai_usage_logs_clinic_created_idx" ON "ai_usage_logs"("clinic_id", "created_at")`);

    console.log('✅ Migration complete!');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
