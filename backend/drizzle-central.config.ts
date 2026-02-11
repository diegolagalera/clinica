import type { Config } from 'drizzle-kit';

export default {
    schema: './src/db/central-schema.ts',
    out: './migrations-central',
    driver: 'pg',
    dbCredentials: {
        connectionString: process.env['CENTRAL_DATABASE_URL']!,
    },
    verbose: true,
    strict: true,
} satisfies Config;
