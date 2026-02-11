import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config/env.js';
import * as centralSchema from './central-schema.js';

// Dedicated connection to the central database (cuspia_central)
// This DB stores: superadmins, tenants, global_users
// It is always available and used for login routing + tenant management

const centralConnectionString = config.database.centralUrl;

const centralQueryClient = postgres(centralConnectionString, {
    max: 5, // Low pool — central DB has minimal load
    idle_timeout: 30,
    connect_timeout: 10,
});

export const centralDb = drizzle(centralQueryClient, { schema: centralSchema });

export type CentralDatabase = typeof centralDb;
