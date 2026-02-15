import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/db/central-schema.ts',
    out: './migrations-central',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env['CENTRAL_DATABASE_URL']!,
    },
    verbose: true,
    strict: true,
});
