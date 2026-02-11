import { centralDb } from '../db/central-db.js';
import { tenants, globalUsers } from '../db/central-schema.js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';

const slugArg = process.argv[2];
if (!slugArg) {
    console.error('Usage: npx tsx src/scripts/cleanup-tenant.ts <slug>');
    process.exit(1);
}
const slug: string = slugArg;

async function cleanup() {
    console.log(`🧹 Cleaning up tenant "${slug}"...`);

    // Find tenant
    const tenant = await centralDb.query.tenants.findFirst({
        where: eq(tenants.slug, slug),
    });

    if (tenant) {
        // Delete from global_users first (FK)
        await centralDb.delete(globalUsers).where(eq(globalUsers.tenantId, tenant.id));
        await centralDb.delete(tenants).where(eq(tenants.slug, slug));
        console.log('✅ Deleted tenant from central DB');
    } else {
        console.log('⚠️  No tenant found in central DB');
    }

    // Drop the database
    const dbName = `cuspia_${slug.replace(/-/g, '_')}`;
    const maintenanceUrl = process.env.CENTRAL_DATABASE_URL?.replace(/\/[^/]+$/, '/postgres')
        || 'postgresql://postgres:postgres@localhost:5432/postgres';

    const maintenanceSql = postgres(maintenanceUrl, { max: 1 });
    try {
        await maintenanceSql.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
        console.log(`✅ Dropped database ${dbName}`);
    } finally {
        await maintenanceSql.end();
    }

    console.log('🧹 Cleanup complete!');
    process.exit(0);
}

cleanup().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
