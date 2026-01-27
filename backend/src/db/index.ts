import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config/env.js';
import * as schema from './schema.js';

const connectionString = config.database.url;

// Connection for migrations and seeding
export const migrationClient = postgres(connectionString, { max: 1 });

// Connection pool for queries
const queryClient = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
