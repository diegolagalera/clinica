#!/usr/bin/env tsx
/**
 * CLI Script: Provision a new tenant
 *
 * Usage:
 *   npx tsx src/scripts/provision-tenant.ts \
 *     --name "Vitaldent" \
 *     --slug "vitaldent" \
 *     --admin-email "admin@vitaldent.com" \
 *     --admin-password "SecurePass123!" \
 *     --admin-first "Carlos" \
 *     --admin-last "García" \
 *     --org-name "Vitaldent S.L."
 *
 * Optional flags:
 *     --clinic-name "Vitaldent Centro"
 *     --plan "premium"
 *     --max-clinics 10
 *     --db-host "localhost"
 *     --db-port 5432
 *     --db-user "postgres"
 *     --db-password "postgres"
 */

import { provisionTenant, provisionSuperadmin } from '../services/tenant-provisioning.service.js';

// ============================================================================
// Parse CLI arguments
// ============================================================================

function parseArgs(): Record<string, string> {
    const args: Record<string, string> = {};
    const argv = process.argv.slice(2);

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = argv[i + 1];
            if (value && !value.startsWith('--')) {
                args[key] = value;
                i++;
            } else {
                args[key] = 'true';
            }
        }
    }
    return args;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = parseArgs();

    // Check for --create-superadmin mode
    if (args['create-superadmin'] === 'true') {
        return createSuperadmin(args);
    }

    // Required fields
    const required = ['name', 'slug', 'admin-email', 'admin-password', 'admin-first', 'admin-last', 'org-name'];
    const missing = required.filter((k) => !args[k]);

    if (missing.length > 0) {
        console.error('❌ Missing required arguments:', missing.map((k) => `--${k}`).join(', '));
        console.log('\nUsage:');
        console.log('  npx tsx src/scripts/provision-tenant.ts \\');
        console.log('    --name "Company Name" \\');
        console.log('    --slug "company-slug" \\');
        console.log('    --admin-email "admin@company.com" \\');
        console.log('    --admin-password "SecurePass!" \\');
        console.log('    --admin-first "First" \\');
        console.log('    --admin-last "Last" \\');
        console.log('    --org-name "Organization Name"');
        console.log('\nOptional:');
        console.log('    --clinic-name "Clinic Name"');
        console.log('    --plan "basic|premium"');
        console.log('    --max-clinics 5');
        console.log('    --db-host localhost');
        console.log('    --db-port 5432');
        console.log('    --db-user postgres');
        console.log('    --db-password postgres');
        console.log('\nTo create a SUPERADMIN:');
        console.log('  npx tsx src/scripts/provision-tenant.ts --create-superadmin \\');
        console.log('    --admin-email "sa@cuspia.com" --admin-password "pass" \\');
        console.log('    --admin-first "Super" --admin-last "Admin"');
        process.exit(1);
    }

    // Build database URL for the new tenant
    // Auto-detect from DATABASE_URL env var (set by Docker) or use CLI args/defaults
    const envDbUrl = process.env.DATABASE_URL;
    let dbHost = args['db-host'] || 'localhost';
    let dbPort = args['db-port'] || '5432';
    let dbUser = args['db-user'] || 'postgres';
    let dbPassword = args['db-password'] || 'postgres';

    if (envDbUrl && !args['db-host'] && !args['db-password']) {
        try {
            const url = new URL(envDbUrl);
            dbHost = url.hostname;
            dbPort = url.port || '5432';
            dbUser = url.username || dbUser;
            dbPassword = url.password || dbPassword;
        } catch { /* ignore parse errors, use defaults */ }
    }

    const dbName = `cuspia_${args['slug']!.replace(/-/g, '_')}`;
    const databaseUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     🏢 CUSPIA — Tenant Provisioning       ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Company:    ${args['name']}`);
    console.log(`  Slug:       ${args['slug']}`);
    console.log(`  Database:   ${dbName}`);
    console.log(`  Admin:      ${args['admin-email']}`);
    console.log(`  Org:        ${args['org-name']}`);
    if (args['clinic-name']) {
        console.log(`  Clinic:     ${args['clinic-name']}`);
    }
    console.log(`  Plan:       ${args['plan'] || 'basic'}`);
    console.log('');

    const result = await provisionTenant({
        name: args['name']!,
        slug: args['slug']!,
        databaseUrl,
        databaseName: dbName,
        plan: args['plan'] || 'basic',
        maxClinics: args['max-clinics'] ? parseInt(args['max-clinics'], 10) : 5,
        ...(args['admin-email'] && { contactEmail: args['admin-email'] }),
        adminUser: {
            email: args['admin-email']!,
            password: args['admin-password']!,
            firstName: args['admin-first']!,
            lastName: args['admin-last']!,
        },
        organization: {
            name: args['org-name']!,
            ...(args['admin-email'] && { email: args['admin-email'] }),
        },
        ...(args['clinic-name'] && {
            clinic: {
                name: args['clinic-name'],
                timezone: 'Europe/Madrid',
            },
        }),
    });

    if (result.success) {
        console.log('╔════════════════════════════════════════════╗');
        console.log('║  ✅ Tenant provisioned successfully!       ║');
        console.log('╚════════════════════════════════════════════╝');
        console.log('');
        console.log(`  Tenant ID:    ${result.tenantId}`);
        console.log(`  Slug:         ${result.slug}`);
        console.log(`  Admin ID:     ${result.adminUserId}`);
        console.log('');
        console.log('  📧 Login credentials:');
        console.log(`     Email:     ${args['admin-email']}`);
        console.log(`     Password:  ${args['admin-password']}`);
        console.log('');
    } else {
        console.error(`❌ Provisioning failed: ${result.error}`);
        process.exit(1);
    }

    process.exit(0);
}

// ============================================================================
// Create Superadmin
// ============================================================================

async function createSuperadmin(args: Record<string, string>) {
    const required = ['admin-email', 'admin-password', 'admin-first', 'admin-last'];
    const missing = required.filter((k) => !args[k]);

    if (missing.length > 0) {
        console.error('❌ Missing required arguments for --create-superadmin:', missing.map((k) => `--${k}`).join(', '));
        process.exit(1);
    }

    console.log('');
    console.log('🔧 Creating SUPERADMIN...');

    const result = await provisionSuperadmin({
        email: args['admin-email']!,
        password: args['admin-password']!,
        firstName: args['admin-first']!,
        lastName: args['admin-last']!,
    });

    if (result.success) {
        console.log('✅ SUPERADMIN created!');
        console.log(`   ID:    ${result.id}`);
        console.log(`   Email: ${args['admin-email']}`);
    } else {
        console.error(`❌ Failed: ${result.error}`);
        process.exit(1);
    }

    process.exit(0);
}

// ============================================================================
// Run
// ============================================================================

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
