import { Pool } from 'pg';
import 'dotenv/config';

async function migrate() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const columns = [
        { name: 'wa_template_mapping_created', type: 'jsonb' },
        { name: 'wa_template_mapping_modified', type: 'jsonb' },
        { name: 'wa_template_mapping_cancelled', type: 'jsonb' },
        { name: 'wa_template_mapping_reminder_24h', type: 'jsonb' },
        { name: 'wa_template_mapping_reminder_1h', type: 'jsonb' },
    ];

    for (const col of columns) {
        try {
            await pool.query(`ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            console.log(`✅ Added column ${col.name}`);
        } catch (err: any) {
            console.log(`⚠️ Column ${col.name}: ${err.message}`);
        }
    }

    await pool.end();
    console.log('Migration complete');
}

migrate();
