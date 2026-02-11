import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function migrate() {
    try {
        // Appointments: tracking field
        await db.execute(sql`ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "wa_notification_sent_at" timestamp`);
        console.log('✅ appointments.wa_notification_sent_at added');

        // WhatsApp settings: notification config
        await db.execute(sql`ALTER TABLE "whatsapp_settings" ADD COLUMN IF NOT EXISTS "wa_notify_enabled" boolean DEFAULT false NOT NULL`);
        await db.execute(sql`ALTER TABLE "whatsapp_settings" ADD COLUMN IF NOT EXISTS "wa_template_created" varchar(255)`);
        await db.execute(sql`ALTER TABLE "whatsapp_settings" ADD COLUMN IF NOT EXISTS "wa_template_modified" varchar(255)`);
        await db.execute(sql`ALTER TABLE "whatsapp_settings" ADD COLUMN IF NOT EXISTS "wa_template_cancelled" varchar(255)`);
        await db.execute(sql`ALTER TABLE "whatsapp_settings" ADD COLUMN IF NOT EXISTS "wa_template_reminder_24h" varchar(255)`);
        await db.execute(sql`ALTER TABLE "whatsapp_settings" ADD COLUMN IF NOT EXISTS "wa_template_reminder_1h" varchar(255)`);
        await db.execute(sql`ALTER TABLE "whatsapp_settings" ADD COLUMN IF NOT EXISTS "wa_reminder_24h_enabled" boolean DEFAULT false NOT NULL`);
        await db.execute(sql`ALTER TABLE "whatsapp_settings" ADD COLUMN IF NOT EXISTS "wa_reminder_1h_enabled" boolean DEFAULT false NOT NULL`);
        console.log('✅ whatsapp_settings notification columns added');

        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

migrate();
