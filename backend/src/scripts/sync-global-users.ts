import { centralDb } from '../db/central-db.js';
import { tenants, globalUsers } from '../db/central-schema.js';
import { eq } from 'drizzle-orm';
import { syncTenantUsersToCentral } from '../services/tenant-provisioning.service.js';
import { tenantManager } from '../db/tenant-manager.js';

/**
 * Sync all tenant users to global_users.
 * Run this after enabling global_users sync to catch any users
 * that were created before the sync was implemented.
 * 
 * Usage: npx tsx src/scripts/sync-global-users.ts
 */
async function syncAll() {
    console.log('🔄 Syncing all tenant users to global_users...\n');

    const allTenants = await centralDb.query.tenants.findMany({
        where: eq(tenants.isActive, true),
    });

    console.log(`Found ${allTenants.length} active tenant(s)\n`);

    for (const tenant of allTenants) {
        console.log(`📦 Syncing "${tenant.slug}" (${tenant.id})...`);
        const tenantDb = await tenantManager.getConnection(tenant.slug);
        const result = await syncTenantUsersToCentral(tenantDb, tenant.id);
        console.log(`   ✅ Synced: ${result.synced}, Skipped: ${result.skipped}\n`);
    }

    // Show final state
    const allGlobal = await centralDb.query.globalUsers.findMany();
    console.log(`📊 Total global_users: ${allGlobal.length}`);
    for (const u of allGlobal) {
        console.log(`   ${u.email} (${u.role})`);
    }

    console.log('\n✅ Sync complete!');
    process.exit(0);
}

syncAll().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
