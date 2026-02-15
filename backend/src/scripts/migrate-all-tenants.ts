#!/usr/bin/env tsx
/**
 * CLI Script: Migrate all tenant databases
 *
 * Applies pending Drizzle migrations to every active tenant DB.
 * Use after generating new migrations with `npx drizzle-kit generate`.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-all-tenants.ts
 *   npx tsx src/scripts/migrate-all-tenants.ts --slug specific-tenant
 *   npx tsx src/scripts/migrate-all-tenants.ts --dry-run
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import { listTenants } from '../services/tenant-provisioning.service.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Parse CLI arguments
// ============================================================================

const args = process.argv.slice(2);
const slugFlagIndex = args.indexOf('--slug');
const targetSlug = slugFlagIndex !== -1 ? args[slugFlagIndex + 1] : undefined;
const dryRun = args.includes('--dry-run');

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   🔄 CUSPIA — Migrate Tenant Databases    ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    // 1. Get all active tenants from central DB
    const allTenants = await listTenants();
    const tenantsToMigrate = targetSlug
        ? allTenants.filter((t) => t.slug === targetSlug)
        : allTenants.filter((t) => t.isActive);

    if (tenantsToMigrate.length === 0) {
        if (targetSlug) {
            console.error(`❌ No tenant found with slug "${targetSlug}"`);
        } else {
            console.log('ℹ️  No active tenants found.');
        }
        process.exit(1);
    }

    console.log(`  Found ${tenantsToMigrate.length} tenant(s) to migrate:`);
    for (const t of tenantsToMigrate) {
        console.log(`    • ${t.name} (${t.slug})`);
    }
    console.log('');

    if (dryRun) {
        console.log('  🏃 Dry run — no changes will be made.');
        process.exit(0);
    }

    const migrationsFolder = path.resolve(process.cwd(), 'migrations');
    const results: { slug: string; status: 'ok' | 'error'; error?: string }[] = [];

    // 2. Iterate and migrate each tenant
    for (const tenant of tenantsToMigrate) {
        process.stdout.write(`  ⏳ Migrating ${tenant.slug}...`);

        try {
            const sqlClient = postgres(tenant.databaseUrl, { max: 1 });
            const db = drizzle(sqlClient);

            await migrate(db as any, { migrationsFolder });
            await sqlClient.end();

            console.log(' ✅');
            results.push({ slug: tenant.slug, status: 'ok' });
        } catch (err: any) {
            console.log(` ❌ ${err.message}`);
            logger.error({ err, slug: tenant.slug }, 'Migration failed for tenant');
            results.push({ slug: tenant.slug, status: 'error', error: err.message });
        }
    }

    // 3. Summary
    console.log('');
    const succeeded = results.filter((r) => r.status === 'ok').length;
    const failed = results.filter((r) => r.status === 'error').length;

    if (failed === 0) {
        console.log(`  ✅ All ${succeeded} tenant(s) migrated successfully!`);
    } else {
        console.log(`  ⚠️  ${succeeded} succeeded, ${failed} failed:`);
        for (const r of results.filter((r) => r.status === 'error')) {
            console.log(`    ❌ ${r.slug}: ${r.error}`);
        }
    }

    console.log('');
    process.exit(failed > 0 ? 1 : 0);
}

// ============================================================================
// Run
// ============================================================================

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
