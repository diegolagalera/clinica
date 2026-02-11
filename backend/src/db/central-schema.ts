import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    integer,
    index,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// SUPERADMINS — Platform-level administrators (only in central DB)
// ============================================================================

export const superadmins = pgTable(
    'superadmins',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        email: varchar('email', { length: 255 }).notNull().unique(),
        passwordHash: varchar('password_hash', { length: 255 }).notNull(),
        firstName: varchar('first_name', { length: 100 }).notNull(),
        lastName: varchar('last_name', { length: 100 }).notNull(),
        twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
        twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
        isActive: boolean('is_active').default(true).notNull(),
        lastLoginAt: timestamp('last_login_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
);

// ============================================================================
// TENANTS — One row per client company
// ============================================================================

export const tenants = pgTable(
    'tenants',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        name: varchar('name', { length: 255 }).notNull(),
        slug: varchar('slug', { length: 100 }).notNull().unique(),
        databaseUrl: text('database_url').notNull(),
        databaseName: varchar('database_name', { length: 100 }).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        plan: varchar('plan', { length: 50 }).default('basic').notNull(),
        maxClinics: integer('max_clinics').default(5).notNull(),
        contactEmail: varchar('contact_email', { length: 255 }),
        contactPhone: varchar('contact_phone', { length: 50 }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
);

// ============================================================================
// GLOBAL_USERS — Email-to-tenant routing for login
// UNIQUE(email, tenant_id) — allows a professional to work at multiple companies
// ============================================================================

export const globalUsers = pgTable(
    'global_users',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        email: varchar('email', { length: 255 }).notNull(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        userId: uuid('user_id'), // ID of the user within the tenant DB
        role: varchar('role', { length: 20 }).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        emailTenantIdx: uniqueIndex('global_users_email_tenant_idx').on(
            table.email,
            table.tenantId,
        ),
        emailIdx: index('global_users_email_idx').on(table.email),
    }),
);

// ============================================================================
// RELATIONS
// ============================================================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
    globalUsers: many(globalUsers),
}));

export const globalUsersRelations = relations(globalUsers, ({ one }) => ({
    tenant: one(tenants, {
        fields: [globalUsers.tenantId],
        references: [tenants.id],
    }),
}));
