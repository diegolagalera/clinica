import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    integer,
    decimal,
    jsonb,
    pgEnum,
    index,
    uniqueIndex,
    customType,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// CUSTOM TYPES (pgvector)
// ============================================================================

const vector = customType<{ data: number[]; driverData: string }>({
    dataType() {
        return 'vector(1536)';
    },
    toDriver(value: number[]): string {
        return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
        return value
            .slice(1, -1)
            .split(',')
            .map(Number);
    },
});

// ============================================================================
// ENUMS
// ============================================================================

export const roleEnum = pgEnum('role', ['SUPERADMIN', 'ADMIN', 'WORKER', 'USER']);
export const appointmentTypeEnum = pgEnum('appointment_type', [
    'VISIT',
    'SURGERY',
    'REVIEW',
    'EMERGENCY',
    'FOLLOWUP',
]);
export const appointmentStatusEnum = pgEnum('appointment_status', [
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
]);
export const aiAnalysisStatusEnum = pgEnum('ai_analysis_status', [
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'REVIEWED',
    'REJECTED',
]);
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
    'IN',
    'OUT',
    'ADJUSTMENT',
    'EXPIRED',
]);
export const dentalConditionEnum = pgEnum('dental_condition', [
    'HEALTHY',
    'CARIES',
    'FILLING',
    'CROWN',
    'EXTRACTION_INDICATED',
    'MISSING',
    'IMPLANT',
    'ROOT_CANAL',
    'FRACTURE',
    'BRIDGE',
    'VENEER',
    'SEALANT',
]);
export const toothSurfaceEnum = pgEnum('tooth_surface', [
    'MESIAL',
    'DISTAL',
    'OCCLUSAL',
    'VESTIBULAR',
    'PALATINO',
]);
export const invoiceStatusEnum = pgEnum('invoice_status', [
    'DRAFT',
    'SENT',
    'PAID',
    'PARTIAL',
    'OVERDUE',
    'CANCELLED',
]);
export const paymentMethodEnum = pgEnum('payment_method', [
    'CASH',
    'CARD',
    'TRANSFER',
    'INSURANCE',
    'OTHER',
]);
export const auditActionEnum = pgEnum('audit_action', [
    'CREATE',
    'READ',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'EXPORT',
    'AI_ANALYSIS',
]);

export const bugReportCategoryEnum = pgEnum('bug_report_category', [
    'UI',
    'FUNCTIONALITY',
    'DATA',
    'PERFORMANCE',
    'OTHER',
]);

export const bugReportStatusEnum = pgEnum('bug_report_status', [
    'PENDING',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
]);

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export const organizations = pgTable(
    'organizations',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        name: varchar('name', { length: 255 }).notNull(),
        slug: varchar('slug', { length: 100 }).notNull().unique(),
        email: varchar('email', { length: 255 }),
        phone: varchar('phone', { length: 50 }),
        address: text('address'),
        logoUrl: varchar('logo_url', { length: 500 }),
        settings: jsonb('settings').default({}),
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
    })
);

// ============================================================================
// CLINICS
// ============================================================================

export const clinics = pgTable(
    'clinics',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        organizationId: uuid('organization_id')
            .notNull()
            .references(() => organizations.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 255 }).notNull(),
        slug: varchar('slug', { length: 100 }).notNull(),
        email: varchar('email', { length: 255 }),
        phone: varchar('phone', { length: 50 }),
        address: text('address'),
        city: varchar('city', { length: 100 }),
        postalCode: varchar('postal_code', { length: 20 }),
        country: varchar('country', { length: 2 }).default('ES'),
        timezone: varchar('timezone', { length: 50 }).default('Europe/Madrid'),
        settings: jsonb('settings').default({}),
        workingHours: jsonb('working_hours').default({}),
        // AI configuration
        aiEnabled: boolean('ai_enabled').default(false).notNull(),
        aiMonthlyTokenLimit: integer('ai_monthly_token_limit').default(100000),
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        orgIdIdx: index('clinics_organization_id_idx').on(table.organizationId),
        slugOrgIdx: uniqueIndex('clinics_slug_org_idx').on(table.slug, table.organizationId),
    })
);

// ============================================================================
// USERS
// ============================================================================

export const users = pgTable(
    'users',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        email: varchar('email', { length: 255 }).notNull().unique(),
        passwordHash: varchar('password_hash', { length: 255 }).notNull(),
        firstName: varchar('first_name', { length: 100 }).notNull(),
        lastName: varchar('last_name', { length: 100 }).notNull(),
        phone: varchar('phone', { length: 50 }),
        avatarUrl: varchar('avatar_url', { length: 500 }),
        role: roleEnum('role').notNull().default('USER'),
        organizationId: uuid('organization_id').references(() => organizations.id, {
            onDelete: 'set null',
        }),
        clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'set null' }),
        isActive: boolean('is_active').default(true).notNull(),
        emailVerified: boolean('email_verified').default(false).notNull(),
        emailVerificationToken: varchar('email_verification_token', { length: 255 }),
        passwordResetToken: varchar('password_reset_token', { length: 255 }),
        passwordResetExpires: timestamp('password_reset_expires'),
        twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
        twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
        tokenVersion: integer('token_version').default(0).notNull(),
        lastLoginAt: timestamp('last_login_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        emailIdx: uniqueIndex('users_email_idx').on(table.email),
        orgIdIdx: index('users_organization_id_idx').on(table.organizationId),
        clinicIdIdx: index('users_clinic_id_idx').on(table.clinicId),
        roleIdx: index('users_role_idx').on(table.role),
    })
);

// ============================================================================
// STAFF PROFILES (additional info for WORKER/ADMIN roles)
// ============================================================================

export const staffProfiles = pgTable(
    'staff_profiles',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .unique()
            .references(() => users.id, { onDelete: 'cascade' }),
        licenseNumber: varchar('license_number', { length: 100 }),
        specialty: varchar('specialty', { length: 100 }),
        bio: text('bio'),
        color: varchar('color', { length: 7 }), // For calendar display
        workingDays: jsonb('working_days').default([]),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        userIdIdx: uniqueIndex('staff_profiles_user_id_idx').on(table.userId),
    })
);

// ============================================================================
// WORKER-CLINIC ASSIGNMENTS (many-to-many for workers across clinics)
// ============================================================================

export const workerClinics = pgTable(
    'worker_clinics',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        role: varchar('role', { length: 50 }), // Optional specific role in this clinic
        permissions: jsonb('permissions').$type<string[]>().default([]).notNull(), // Module permissions: whatsapp, ratings, marketing, staff, settings
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        userClinicIdx: uniqueIndex('worker_clinics_user_clinic_idx').on(table.userId, table.clinicId),
        userIdIdx: index('worker_clinics_user_id_idx').on(table.userId),
        clinicIdIdx: index('worker_clinics_clinic_id_idx').on(table.clinicId),
    })
);

// ============================================================================
// PATIENTS
// ============================================================================

export const patients = pgTable(
    'patients',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
        externalId: varchar('external_id', { length: 100 }), // For linking existing records
        firstName: varchar('first_name', { length: 100 }).notNull(),
        lastName: varchar('last_name', { length: 100 }).notNull(),
        email: varchar('email', { length: 255 }),
        phone: varchar('phone', { length: 50 }),
        dateOfBirth: timestamp('date_of_birth'),
        gender: varchar('gender', { length: 20 }),
        idNumber: varchar('id_number', { length: 50 }), // DNI/NIE/Passport
        address: text('address'),
        city: varchar('city', { length: 100 }),
        postalCode: varchar('postal_code', { length: 20 }),
        emergencyContact: varchar('emergency_contact', { length: 255 }),
        emergencyPhone: varchar('emergency_phone', { length: 50 }),
        allergies: text('allergies'),
        medicalHistory: text('medical_history'),
        notes: text('notes'),
        insuranceProvider: varchar('insurance_provider', { length: 100 }),
        insuranceNumber: varchar('insurance_number', { length: 100 }),
        consentGiven: boolean('consent_given').default(false).notNull(),
        consentDate: timestamp('consent_date'),
        // Marketing preferences
        acceptsMarketing: boolean('accepts_marketing').default(true).notNull(),
        acceptsBirthdayEmails: boolean('accepts_birthday_emails').default(true).notNull(),
        marketingUnsubscribeToken: varchar('marketing_unsubscribe_token', { length: 64 }),
        // WhatsApp availability (null = unknown, true = confirmed, false = not on WA)
        whatsappAvailable: boolean('whatsapp_available'),
        whatsappCheckedAt: timestamp('whatsapp_checked_at'),
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('patients_clinic_id_idx').on(table.clinicId),
        userIdIdx: index('patients_user_id_idx').on(table.userId),
        emailIdx: index('patients_email_idx').on(table.email),
        nameIdx: index('patients_name_idx').on(table.firstName, table.lastName),
    })
);

// ============================================================================
// APPOINTMENTS
// ============================================================================

export const appointments = pgTable(
    'appointments',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id')
            .notNull()
            .references(() => patients.id, { onDelete: 'cascade' }),
        workerId: uuid('worker_id')
            .references(() => users.id, { onDelete: 'cascade' }),
        type: appointmentTypeEnum('type').notNull().default('VISIT'),
        status: appointmentStatusEnum('status').notNull().default('SCHEDULED'),
        title: varchar('title', { length: 255 }),
        description: text('description'),
        startTime: timestamp('start_time').notNull(),
        endTime: timestamp('end_time').notNull(),
        duration: integer('duration').notNull(), // In minutes (planned)
        // Real-time tracking fields
        realStartTime: timestamp('real_start_time'),  // Actual start time
        realEndTime: timestamp('real_end_time'),      // Actual end time
        pausedDuration: integer('paused_duration').default(0), // Paused minutes
        startedById: uuid('started_by_id').references(() => users.id), // Who started
        notes: text('notes'),
        reminderSent: boolean('reminder_sent').default(false).notNull(),
        waNotificationSentAt: timestamp('wa_notification_sent_at'),
        createdById: uuid('created_by_id').references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('appointments_clinic_id_idx').on(table.clinicId),
        patientIdIdx: index('appointments_patient_id_idx').on(table.patientId),
        workerIdIdx: index('appointments_worker_id_idx').on(table.workerId),
        startTimeIdx: index('appointments_start_time_idx').on(table.startTime),
        statusIdx: index('appointments_status_idx').on(table.status),
    })
);

// ============================================================================
// APPOINTMENT WORKERS (Many-to-Many junction table)
// ============================================================================

export const appointmentWorkers = pgTable(
    'appointment_workers',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        appointmentId: uuid('appointment_id')
            .notNull()
            .references(() => appointments.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        isPrimary: boolean('is_primary').default(false).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        appointmentUserIdx: uniqueIndex('appointment_workers_apt_user_idx').on(
            table.appointmentId,
            table.userId
        ),
        appointmentIdIdx: index('appointment_workers_appointment_id_idx').on(table.appointmentId),
        userIdIdx: index('appointment_workers_user_id_idx').on(table.userId),
    })
);

// ============================================================================
// CLINICAL RECORDS
// ============================================================================

export const clinicalRecords = pgTable(
    'clinical_records',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id')
            .notNull()
            .references(() => patients.id, { onDelete: 'cascade' }),
        appointmentId: uuid('appointment_id').references(() => appointments.id, {
            onDelete: 'set null',
        }),
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id),
        recordType: varchar('record_type', { length: 50 }).notNull(), // note, procedure, diagnosis, etc.
        title: varchar('title', { length: 255 }),
        content: text('content'),
        vitalSigns: jsonb('vital_signs'),
        procedures: jsonb('procedures'), // Array of procedures performed
        diagnosis: text('diagnosis'),
        treatment: text('treatment'),
        prescriptions: jsonb('prescriptions'),
        toothChart: jsonb('tooth_chart'), // Dental chart data
        attachments: jsonb('attachments'), // Array of file references
        isSigned: boolean('is_signed').default(false).notNull(),
        signedAt: timestamp('signed_at'),
        signedById: uuid('signed_by_id').references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('clinical_records_clinic_id_idx').on(table.clinicId),
        patientIdIdx: index('clinical_records_patient_id_idx').on(table.patientId),
        appointmentIdIdx: index('clinical_records_appointment_id_idx').on(table.appointmentId),
        createdAtIdx: index('clinical_records_created_at_idx').on(table.createdAt),
    })
);

// ============================================================================
// RADIOGRAPHS
// ============================================================================

export const radiographs = pgTable(
    'radiographs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id')
            .notNull()
            .references(() => patients.id, { onDelete: 'cascade' }),
        clinicalRecordId: uuid('clinical_record_id').references(() => clinicalRecords.id, {
            onDelete: 'set null',
        }),
        uploadedById: uuid('uploaded_by_id')
            .notNull()
            .references(() => users.id),
        filename: varchar('filename', { length: 255 }).notNull(),
        originalFilename: varchar('original_filename', { length: 255 }).notNull(),
        mimeType: varchar('mime_type', { length: 100 }).notNull(),
        fileSize: integer('file_size').notNull(),
        storageKey: varchar('storage_key', { length: 500 }).notNull(),
        radiographType: varchar('radiograph_type', { length: 50 }), // panoramic, periapical, bitewing, etc.
        toothNumbers: jsonb('tooth_numbers'), // Array of tooth numbers if applicable
        notes: text('notes'),
        annotations: jsonb('annotations'), // User annotations on the image
        metadata: jsonb('metadata'), // DICOM metadata, etc.
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('radiographs_clinic_id_idx').on(table.clinicId),
        patientIdIdx: index('radiographs_patient_id_idx').on(table.patientId),
        uploadedByIdIdx: index('radiographs_uploaded_by_id_idx').on(table.uploadedById),
    })
);

// ============================================================================
// RADIOGRAPH AI RESULTS
// ============================================================================

export const radiographAiResults = pgTable(
    'radiograph_ai_results',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        radiographId: uuid('radiograph_id')
            .notNull()
            .unique()
            .references(() => radiographs.id, { onDelete: 'cascade' }),
        status: aiAnalysisStatusEnum('status').notNull().default('PENDING'),
        modelVersion: varchar('model_version', { length: 50 }),
        processingTimeMs: integer('processing_time_ms'),
        suspiciousAreas: jsonb('suspicious_areas').default([]),
        summary: text('summary'),
        confidence: decimal('confidence', { precision: 5, scale: 4 }),
        rawResponse: jsonb('raw_response'),
        reviewedById: uuid('reviewed_by_id').references(() => users.id),
        reviewedAt: timestamp('reviewed_at'),
        reviewNotes: text('review_notes'),
        isAccepted: boolean('is_accepted'),
        errorMessage: text('error_message'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        radiographIdIdx: uniqueIndex('radiograph_ai_results_radiograph_id_idx').on(table.radiographId),
        statusIdx: index('radiograph_ai_results_status_idx').on(table.status),
    })
);

// ============================================================================
// SUPPLIERS
// ============================================================================

export const suppliers = pgTable(
    'suppliers',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 255 }).notNull(),
        contactPerson: varchar('contact_person', { length: 255 }),
        email: varchar('email', { length: 255 }),
        phone: varchar('phone', { length: 50 }),
        phone2: varchar('phone2', { length: 50 }),
        website: varchar('website', { length: 500 }),
        address: text('address'),
        notes: text('notes'),
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('suppliers_clinic_id_idx').on(table.clinicId),
        nameIdx: index('suppliers_name_idx').on(table.name),
    })
);

// ============================================================================
// INVENTORY ITEMS
// ============================================================================

export const inventoryItems = pgTable(
    'inventory_items',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        supplierId: uuid('supplier_id')
            .references(() => suppliers.id, { onDelete: 'set null' }),
        sku: varchar('sku', { length: 100 }),
        name: varchar('name', { length: 255 }).notNull(),
        description: text('description'),
        category: varchar('category', { length: 100 }),
        unit: varchar('unit', { length: 50 }).default('units'),
        currentStock: integer('current_stock').default(0).notNull(),
        minStock: integer('min_stock').default(0).notNull(),
        maxStock: integer('max_stock'),
        costPrice: decimal('cost_price', { precision: 10, scale: 2 }),
        sellPrice: decimal('sell_price', { precision: 10, scale: 2 }),
        supplier: varchar('supplier', { length: 255 }), // Legacy field, keep for backwards compatibility
        supplierCode: varchar('supplier_code', { length: 100 }),
        expirationDate: timestamp('expiration_date'),
        location: varchar('location', { length: 100 }),
        imageUrl: varchar('image_url', { length: 500 }),
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('inventory_items_clinic_id_idx').on(table.clinicId),
        supplierIdIdx: index('inventory_items_supplier_id_idx').on(table.supplierId),
        skuIdx: index('inventory_items_sku_idx').on(table.sku),
        categoryIdx: index('inventory_items_category_idx').on(table.category),
        lowStockIdx: index('inventory_items_low_stock_idx').on(table.currentStock, table.minStock),
    })
);

// ============================================================================
// STOCK MOVEMENTS
// ============================================================================

export const stockMovements = pgTable(
    'stock_movements',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        itemId: uuid('item_id')
            .notNull()
            .references(() => inventoryItems.id, { onDelete: 'cascade' }),
        type: stockMovementTypeEnum('type').notNull(),
        quantity: integer('quantity').notNull(),
        unitCost: decimal('unit_cost', { precision: 10, scale: 2 }), // Cost per unit for IN movements
        previousStock: integer('previous_stock').notNull(),
        newStock: integer('new_stock').notNull(),
        reason: text('reason'),
        reference: varchar('reference', { length: 255 }), // PO number, procedure ID, etc.
        performedById: uuid('performed_by_id')
            .notNull()
            .references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('stock_movements_clinic_id_idx').on(table.clinicId),
        itemIdIdx: index('stock_movements_item_id_idx').on(table.itemId),
        createdAtIdx: index('stock_movements_created_at_idx').on(table.createdAt),
    })
);

// ============================================================================
// STOCK PACKS (Predefined material packages)
// ============================================================================

export const stockPacks = pgTable(
    'stock_packs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 255 }).notNull(),
        description: text('description'),
        category: varchar('category', { length: 100 }),
        isActive: boolean('is_active').default(true).notNull(),
        createdById: uuid('created_by_id').references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('stock_packs_clinic_id_idx').on(table.clinicId),
        nameIdx: index('stock_packs_name_idx').on(table.name),
    })
);

// ============================================================================
// STOCK PACK ITEMS (Items within a pack)
// ============================================================================

export const stockPackItems = pgTable(
    'stock_pack_items',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        packId: uuid('pack_id')
            .notNull()
            .references(() => stockPacks.id, { onDelete: 'cascade' }),
        itemId: uuid('item_id')
            .notNull()
            .references(() => inventoryItems.id, { onDelete: 'cascade' }),
        quantity: integer('quantity').notNull().default(1),
    },
    (table) => ({
        packIdIdx: index('stock_pack_items_pack_id_idx').on(table.packId),
        packItemIdx: uniqueIndex('stock_pack_items_pack_item_idx').on(table.packId, table.itemId),
    })
);

// ============================================================================
// APPOINTMENT STOCK USAGE (Stock consumed in appointments)
// ============================================================================

export const appointmentStockUsage = pgTable(
    'appointment_stock_usage',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        appointmentId: uuid('appointment_id')
            .notNull()
            .references(() => appointments.id, { onDelete: 'cascade' }),
        itemId: uuid('item_id')
            .notNull()
            .references(() => inventoryItems.id, { onDelete: 'restrict' }),
        quantity: integer('quantity').notNull(),
        unitCost: decimal('unit_cost', { precision: 10, scale: 2 }),
        notes: text('notes'),
        registeredById: uuid('registered_by_id')
            .notNull()
            .references(() => users.id),
        // Deferred confirmation: stock is only deducted when confirmed (on appointment completion)
        isConfirmed: boolean('is_confirmed').default(false).notNull(),
        confirmedAt: timestamp('confirmed_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('appointment_stock_usage_clinic_id_idx').on(table.clinicId),
        appointmentIdIdx: index('appointment_stock_usage_appointment_id_idx').on(table.appointmentId),
        itemIdIdx: index('appointment_stock_usage_item_id_idx').on(table.itemId),
        createdAtIdx: index('appointment_stock_usage_created_at_idx').on(table.createdAt),
    })
);

// ============================================================================
// INVOICES
// ============================================================================

export const invoices = pgTable(
    'invoices',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id')
            .notNull()
            .references(() => patients.id, { onDelete: 'cascade' }),
        invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
        status: invoiceStatusEnum('status').notNull().default('DRAFT'),
        issueDate: timestamp('issue_date').notNull(),
        dueDate: timestamp('due_date'),
        subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
        taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('21'),
        taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).notNull(),
        discount: decimal('discount', { precision: 10, scale: 2 }).default('0'),
        total: decimal('total', { precision: 10, scale: 2 }).notNull(),
        paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).default('0'),
        items: jsonb('items').notNull(), // Array of invoice line items
        notes: text('notes'),
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('invoices_clinic_id_idx').on(table.clinicId),
        patientIdIdx: index('invoices_patient_id_idx').on(table.patientId),
        invoiceNumberIdx: uniqueIndex('invoices_number_clinic_idx').on(
            table.invoiceNumber,
            table.clinicId
        ),
        statusIdx: index('invoices_status_idx').on(table.status),
    })
);

// ============================================================================
// PAYMENTS
// ============================================================================

export const payments = pgTable(
    'payments',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        invoiceId: uuid('invoice_id')
            .notNull()
            .references(() => invoices.id, { onDelete: 'cascade' }),
        amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
        method: paymentMethodEnum('method').notNull(),
        reference: varchar('reference', { length: 255 }),
        notes: text('notes'),
        paymentDate: timestamp('payment_date').notNull(),
        recordedById: uuid('recorded_by_id')
            .notNull()
            .references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('payments_clinic_id_idx').on(table.clinicId),
        invoiceIdIdx: index('payments_invoice_id_idx').on(table.invoiceId),
        paymentDateIdx: index('payments_payment_date_idx').on(table.paymentDate),
    })
);

// ============================================================================
// EXPENSES
// ============================================================================

export const expenses = pgTable(
    'expenses',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        category: varchar('category', { length: 100 }).notNull(),
        description: text('description').notNull(),
        amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
        taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }),
        expenseDate: timestamp('expense_date').notNull(),
        vendor: varchar('vendor', { length: 255 }),
        invoiceReference: varchar('invoice_reference', { length: 100 }),
        attachmentUrl: varchar('attachment_url', { length: 500 }),
        notes: text('notes'),
        recordedById: uuid('recorded_by_id')
            .notNull()
            .references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('expenses_clinic_id_idx').on(table.clinicId),
        categoryIdx: index('expenses_category_idx').on(table.category),
        expenseDateIdx: index('expenses_expense_date_idx').on(table.expenseDate),
    })
);

// ============================================================================
// AUDIT LOGS
// ============================================================================

export const auditLogs = pgTable(
    'audit_logs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        organizationId: uuid('organization_id').references(() => organizations.id, {
            onDelete: 'set null',
        }),
        clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'set null' }),
        userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
        action: auditActionEnum('action').notNull(),
        entityType: varchar('entity_type', { length: 50 }).notNull(),
        entityId: uuid('entity_id'),
        oldValues: jsonb('old_values'),
        newValues: jsonb('new_values'),
        ipAddress: varchar('ip_address', { length: 45 }),
        userAgent: text('user_agent'),
        metadata: jsonb('metadata'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        organizationIdIdx: index('audit_logs_organization_id_idx').on(table.organizationId),
        clinicIdIdx: index('audit_logs_clinic_id_idx').on(table.clinicId),
        userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
        actionIdx: index('audit_logs_action_idx').on(table.action),
        entityTypeIdx: index('audit_logs_entity_type_idx').on(table.entityType),
        createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
    })
);

// ============================================================================
// DOCUMENT EMBEDDINGS (for RAG)
// ============================================================================

export const documentEmbeddings = pgTable(
    'document_embeddings',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
        sourceType: varchar('source_type', { length: 50 }).notNull(), // clinical_record, radiograph_note, etc.
        sourceId: uuid('source_id').notNull(),
        content: text('content').notNull(),
        // Note: embedding vector stored as text for now, will use pgvector extension
        embedding: text('embedding'),
        metadata: jsonb('metadata'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('document_embeddings_clinic_id_idx').on(table.clinicId),
        patientIdIdx: index('document_embeddings_patient_id_idx').on(table.patientId),
        sourceIdx: index('document_embeddings_source_idx').on(table.sourceType, table.sourceId),
    })
);

// ============================================================================
// REFRESH TOKENS
// ============================================================================

export const refreshTokens = pgTable(
    'refresh_tokens',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        token: varchar('token', { length: 500 }).notNull().unique(),
        expiresAt: timestamp('expires_at').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        revokedAt: timestamp('revoked_at'),
        replacedByToken: varchar('replaced_by_token', { length: 500 }),
    },
    (table) => ({
        userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
        tokenIdx: uniqueIndex('refresh_tokens_token_idx').on(table.token),
        expiresAtIdx: index('refresh_tokens_expires_at_idx').on(table.expiresAt),
    })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
    clinics: many(clinics),
    users: many(users),
}));

export const clinicsRelations = relations(clinics, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [clinics.organizationId],
        references: [organizations.id],
    }),
    users: many(users),
    patients: many(patients),
    appointments: many(appointments),
    clinicalRecords: many(clinicalRecords),
    radiographs: many(radiographs),
    inventoryItems: many(inventoryItems),
    invoices: many(invoices),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [users.organizationId],
        references: [organizations.id],
    }),
    clinic: one(clinics, {
        fields: [users.clinicId],
        references: [clinics.id],
    }),
    staffProfile: one(staffProfiles),
    workerClinics: many(workerClinics),
    appointments: many(appointments),
    refreshTokens: many(refreshTokens),
}));

export const staffProfilesRelations = relations(staffProfiles, ({ one }) => ({
    user: one(users, {
        fields: [staffProfiles.userId],
        references: [users.id],
    }),
}));

export const workerClinicsRelations = relations(workerClinics, ({ one }) => ({
    user: one(users, {
        fields: [workerClinics.userId],
        references: [users.id],
    }),
    clinic: one(clinics, {
        fields: [workerClinics.clinicId],
        references: [clinics.id],
    }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [patients.clinicId],
        references: [clinics.id],
    }),
    user: one(users, {
        fields: [patients.userId],
        references: [users.id],
    }),
    appointments: many(appointments),
    clinicalRecords: many(clinicalRecords),
    radiographs: many(radiographs),
    invoices: many(invoices),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [appointments.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [appointments.patientId],
        references: [patients.id],
    }),
    worker: one(users, {
        fields: [appointments.workerId],
        references: [users.id],
    }),
    clinicalRecords: many(clinicalRecords),
    appointmentWorkers: many(appointmentWorkers),
    stockUsage: many(appointmentStockUsage),
}));

export const appointmentWorkersRelations = relations(appointmentWorkers, ({ one }) => ({
    appointment: one(appointments, {
        fields: [appointmentWorkers.appointmentId],
        references: [appointments.id],
    }),
    user: one(users, {
        fields: [appointmentWorkers.userId],
        references: [users.id],
    }),
}));


export const clinicalRecordsRelations = relations(clinicalRecords, ({ one }) => ({
    clinic: one(clinics, {
        fields: [clinicalRecords.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [clinicalRecords.patientId],
        references: [patients.id],
    }),
    appointment: one(appointments, {
        fields: [clinicalRecords.appointmentId],
        references: [appointments.id],
    }),
    createdBy: one(users, {
        relationName: 'recordCreator',
        fields: [clinicalRecords.createdById],
        references: [users.id],
    }),
    signedBy: one(users, {
        relationName: 'recordSigner',
        fields: [clinicalRecords.signedById],
        references: [users.id],
    }),
}));

export const radiographsRelations = relations(radiographs, ({ one }) => ({
    clinic: one(clinics, {
        fields: [radiographs.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [radiographs.patientId],
        references: [patients.id],
    }),
    clinicalRecord: one(clinicalRecords, {
        fields: [radiographs.clinicalRecordId],
        references: [clinicalRecords.id],
    }),
    uploadedBy: one(users, {
        fields: [radiographs.uploadedById],
        references: [users.id],
    }),
    aiResult: one(radiographAiResults),
}));

export const radiographAiResultsRelations = relations(radiographAiResults, ({ one }) => ({
    radiograph: one(radiographs, {
        fields: [radiographAiResults.radiographId],
        references: [radiographs.id],
    }),
    reviewedBy: one(users, {
        fields: [radiographAiResults.reviewedById],
        references: [users.id],
    }),
}));

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [suppliers.clinicId],
        references: [clinics.id],
    }),
    items: many(inventoryItems),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [inventoryItems.clinicId],
        references: [clinics.id],
    }),
    supplier: one(suppliers, {
        fields: [inventoryItems.supplierId],
        references: [suppliers.id],
    }),
    movements: many(stockMovements),
    packItems: many(stockPackItems),
    appointmentUsage: many(appointmentStockUsage),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
    clinic: one(clinics, {
        fields: [stockMovements.clinicId],
        references: [clinics.id],
    }),
    item: one(inventoryItems, {
        fields: [stockMovements.itemId],
        references: [inventoryItems.id],
    }),
    performedBy: one(users, {
        fields: [stockMovements.performedById],
        references: [users.id],
    }),
}));

export const stockPacksRelations = relations(stockPacks, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [stockPacks.clinicId],
        references: [clinics.id],
    }),
    createdBy: one(users, {
        fields: [stockPacks.createdById],
        references: [users.id],
    }),
    items: many(stockPackItems),
}));

export const stockPackItemsRelations = relations(stockPackItems, ({ one }) => ({
    pack: one(stockPacks, {
        fields: [stockPackItems.packId],
        references: [stockPacks.id],
    }),
    item: one(inventoryItems, {
        fields: [stockPackItems.itemId],
        references: [inventoryItems.id],
    }),
}));

export const appointmentStockUsageRelations = relations(appointmentStockUsage, ({ one }) => ({
    clinic: one(clinics, {
        fields: [appointmentStockUsage.clinicId],
        references: [clinics.id],
    }),
    appointment: one(appointments, {
        fields: [appointmentStockUsage.appointmentId],
        references: [appointments.id],
    }),
    item: one(inventoryItems, {
        fields: [appointmentStockUsage.itemId],
        references: [inventoryItems.id],
    }),
    registeredBy: one(users, {
        fields: [appointmentStockUsage.registeredById],
        references: [users.id],
    }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [invoices.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [invoices.patientId],
        references: [patients.id],
    }),
    createdBy: one(users, {
        fields: [invoices.createdById],
        references: [users.id],
    }),
    payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
    clinic: one(clinics, {
        fields: [payments.clinicId],
        references: [clinics.id],
    }),
    invoice: one(invoices, {
        fields: [payments.invoiceId],
        references: [invoices.id],
    }),
    recordedBy: one(users, {
        fields: [payments.recordedById],
        references: [users.id],
    }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
    clinic: one(clinics, {
        fields: [expenses.clinicId],
        references: [clinics.id],
    }),
    recordedBy: one(users, {
        fields: [expenses.recordedById],
        references: [users.id],
    }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
    user: one(users, {
        fields: [refreshTokens.userId],
        references: [users.id],
    }),
}));

// ============================================================================
// ODONTOGRAM (Dental Chart)
// ============================================================================

export const odontograms = pgTable(
    'odontograms',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id')
            .notNull()
            .references(() => patients.id, { onDelete: 'cascade' }),
        isChild: boolean('is_child').default(false), // true = 20 teeth, false = 32 teeth
        notes: text('notes'),
        lastUpdatedById: uuid('last_updated_by_id').references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdx: index('odontograms_clinic_idx').on(table.clinicId),
        patientIdx: uniqueIndex('odontograms_patient_unique_idx').on(table.patientId),
    })
);

export const odontogramTeeth = pgTable(
    'odontogram_teeth',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        odontogramId: uuid('odontogram_id')
            .notNull()
            .references(() => odontograms.id, { onDelete: 'cascade' }),
        toothNumber: integer('tooth_number').notNull(), // FDI notation: 11-18, 21-28, 31-38, 41-48
        generalCondition: dentalConditionEnum('general_condition').default('HEALTHY'),
        // Surface-specific conditions (JSON for flexibility)
        surfaces: jsonb('surfaces').default({
            mesial: 'HEALTHY',
            distal: 'HEALTHY',
            occlusal: 'HEALTHY',
            vestibular: 'HEALTHY',
            palatino: 'HEALTHY',
        }),
        notes: text('notes'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        odontogramIdx: index('odontogram_teeth_odontogram_idx').on(table.odontogramId),
        toothIdx: uniqueIndex('odontogram_teeth_unique_idx').on(table.odontogramId, table.toothNumber),
    })
);

export const odontogramHistory = pgTable(
    'odontogram_history',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        odontogramId: uuid('odontogram_id')
            .notNull()
            .references(() => odontograms.id, { onDelete: 'cascade' }),
        toothNumber: integer('tooth_number').notNull(),
        surface: varchar('surface', { length: 20 }), // null = whole tooth
        previousCondition: varchar('previous_condition', { length: 50 }),
        newCondition: varchar('new_condition', { length: 50 }).notNull(),
        changedById: uuid('changed_by_id')
            .notNull()
            .references(() => users.id),
        notes: text('notes'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        odontogramIdx: index('odontogram_history_odontogram_idx').on(table.odontogramId),
        toothIdx: index('odontogram_history_tooth_idx').on(table.odontogramId, table.toothNumber),
    })
);

// Odontogram Relations
export const odontogramsRelations = relations(odontograms, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [odontograms.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [odontograms.patientId],
        references: [patients.id],
    }),
    lastUpdatedBy: one(users, {
        fields: [odontograms.lastUpdatedById],
        references: [users.id],
    }),
    teeth: many(odontogramTeeth),
    history: many(odontogramHistory),
}));

export const odontogramTeethRelations = relations(odontogramTeeth, ({ one }) => ({
    odontogram: one(odontograms, {
        fields: [odontogramTeeth.odontogramId],
        references: [odontograms.id],
    }),
}));

export const odontogramHistoryRelations = relations(odontogramHistory, ({ one }) => ({
    odontogram: one(odontograms, {
        fields: [odontogramHistory.odontogramId],
        references: [odontograms.id],
    }),
    changedBy: one(users, {
        fields: [odontogramHistory.changedById],
        references: [users.id],
    }),
}));

// Odontogram Snapshots (Before/After Treatment)
export const odontogramSnapshots = pgTable(
    'odontogram_snapshots',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        odontogramId: uuid('odontogram_id')
            .notNull()
            .references(() => odontograms.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 100 }).notNull(), // e.g. "Estado inicial", "Post-tratamiento"
        description: text('description'),
        teethState: jsonb('teeth_state').notNull(), // Full state of all teeth at snapshot time
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        odontogramIdx: index('odontogram_snapshots_odontogram_idx').on(table.odontogramId),
    })
);

export const odontogramSnapshotsRelations = relations(odontogramSnapshots, ({ one }) => ({
    odontogram: one(odontograms, {
        fields: [odontogramSnapshots.odontogramId],
        references: [odontograms.id],
    }),
    createdBy: one(users, {
        fields: [odontogramSnapshots.createdById],
        references: [users.id],
    }),
}));

// ============================================================================
// EMAIL/NOTIFICATION SYSTEM
// ============================================================================

export const emailTemplateTypeEnum = pgEnum('email_template_type', [
    'APPOINTMENT_CREATED',
    'APPOINTMENT_REMINDER_24H',
    'APPOINTMENT_REMINDER_1H',
    'APPOINTMENT_CANCELLED',
    'DOCUMENT_SIGNED',
    'VISIT_RATING_REQUEST',
    'CUSTOM',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
    'PENDING',
    'SENT',
    'FAILED',
    'BOUNCED',
]);

// Email Settings (SMTP configuration per clinic)
export const emailSettings = pgTable('email_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
        .notNull()
        .unique()
        .references(() => clinics.id, { onDelete: 'cascade' }),
    smtpHost: varchar('smtp_host', { length: 255 }).default('smtp.gmail.com'),
    smtpPort: integer('smtp_port').default(587),
    smtpUser: varchar('smtp_user', { length: 255 }),
    smtpPass: varchar('smtp_pass', { length: 500 }), // Encrypted
    fromName: varchar('from_name', { length: 100 }),
    fromEmail: varchar('from_email', { length: 255 }),
    isEnabled: boolean('is_enabled').default(false).notNull(),
    isConfigured: boolean('is_configured').default(false).notNull(),
    // Notification toggles
    sendOnCreate: boolean('send_on_create').default(true).notNull(),
    sendOnCancel: boolean('send_on_cancel').default(true).notNull(),
    reminder24hEnabled: boolean('reminder_24h_enabled').default(true).notNull(),
    reminder1hEnabled: boolean('reminder_1h_enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Email Templates
export const emailTemplates = pgTable(
    'email_templates',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        type: emailTemplateTypeEnum('type').notNull(),
        name: varchar('name', { length: 100 }).notNull(),
        subject: varchar('subject', { length: 255 }).notNull(),
        blocks: jsonb('blocks').notNull().default([]), // Visual editor blocks
        isActive: boolean('is_active').default(true).notNull(),
        isDefault: boolean('is_default').default(false).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicTypeIdx: index('email_templates_clinic_type_idx').on(table.clinicId, table.type),
    })
);

// Notification Logs
export const notificationLogs = pgTable(
    'notification_logs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
        appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
        templateId: uuid('template_id').references(() => emailTemplates.id, { onDelete: 'set null' }),
        templateType: emailTemplateTypeEnum('template_type').notNull(),
        channel: varchar('channel', { length: 20 }).default('email').notNull(),
        recipient: varchar('recipient', { length: 255 }).notNull(),
        subject: varchar('subject', { length: 255 }),
        status: notificationStatusEnum('status').default('PENDING').notNull(),
        errorMessage: text('error_message'),
        sentAt: timestamp('sent_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdx: index('notification_logs_clinic_idx').on(table.clinicId),
        patientIdx: index('notification_logs_patient_idx').on(table.patientId),
        statusIdx: index('notification_logs_status_idx').on(table.status),
        createdAtIdx: index('notification_logs_created_at_idx').on(table.createdAt),
    })
);

// Relations
export const emailSettingsRelations = relations(emailSettings, ({ one }) => ({
    clinic: one(clinics, {
        fields: [emailSettings.clinicId],
        references: [clinics.id],
    }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
    clinic: one(clinics, {
        fields: [emailTemplates.clinicId],
        references: [clinics.id],
    }),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
    clinic: one(clinics, {
        fields: [notificationLogs.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [notificationLogs.patientId],
        references: [patients.id],
    }),
    appointment: one(appointments, {
        fields: [notificationLogs.appointmentId],
        references: [appointments.id],
    }),
    template: one(emailTemplates, {
        fields: [notificationLogs.templateId],
        references: [emailTemplates.id],
    }),
}));

// Pending Notifications (for debounced sending)
export const pendingNotifications = pgTable(
    'pending_notifications',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        appointmentId: uuid('appointment_id')
            .notNull()
            .references(() => appointments.id, { onDelete: 'cascade' }),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id')
            .notNull()
            .references(() => patients.id, { onDelete: 'cascade' }),
        type: emailTemplateTypeEnum('type').notNull(),
        scheduledFor: timestamp('scheduled_for').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        // Only one pending notification per appointment
        appointmentIdx: uniqueIndex('pending_notifications_appointment_idx').on(table.appointmentId),
        scheduledForIdx: index('pending_notifications_scheduled_for_idx').on(table.scheduledFor),
    })
);

export const pendingNotificationsRelations = relations(pendingNotifications, ({ one }) => ({
    appointment: one(appointments, {
        fields: [pendingNotifications.appointmentId],
        references: [appointments.id],
    }),
    clinic: one(clinics, {
        fields: [pendingNotifications.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [pendingNotifications.patientId],
        references: [patients.id],
    }),
}));

// ============================================================================
// SMS NOTIFICATIONS (Twilio)
// ============================================================================

// SMS Template Types Enum
export const smsTemplateTypeEnum = pgEnum('sms_template_type', [
    'APPOINTMENT_CREATED',
    'APPOINTMENT_REMINDER_24H',
    'APPOINTMENT_REMINDER_1H',
    'APPOINTMENT_CANCELLED',
    'CUSTOM',
]);

// SMS Settings (Twilio configuration per clinic)
export const smsSettings = pgTable('sms_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
        .notNull()
        .unique()
        .references(() => clinics.id, { onDelete: 'cascade' }),
    accountSid: varchar('account_sid', { length: 100 }),
    authToken: varchar('auth_token', { length: 100 }), // Should be encrypted
    fromNumber: varchar('from_number', { length: 20 }), // Twilio phone number (+34...)
    isEnabled: boolean('is_enabled').default(false).notNull(),
    isConfigured: boolean('is_configured').default(false).notNull(),
    // Notification toggles
    sendOnCreate: boolean('send_on_create').default(true).notNull(),
    sendOnCancel: boolean('send_on_cancel').default(true).notNull(),
    reminder24hEnabled: boolean('reminder_24h_enabled').default(true).notNull(),
    reminder1hEnabled: boolean('reminder_1h_enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// SMS Templates
export const smsTemplates = pgTable(
    'sms_templates',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        type: smsTemplateTypeEnum('type').notNull(),
        name: varchar('name', { length: 100 }).notNull(),
        content: text('content').notNull(), // SMS text (recommend max 160 chars)
        isActive: boolean('is_active').default(true).notNull(),
        isDefault: boolean('is_default').default(false).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicTypeIdx: index('sms_templates_clinic_type_idx').on(table.clinicId, table.type),
    })
);

// SMS Relations
export const smsSettingsRelations = relations(smsSettings, ({ one }) => ({
    clinic: one(clinics, {
        fields: [smsSettings.clinicId],
        references: [clinics.id],
    }),
}));

export const smsTemplatesRelations = relations(smsTemplates, ({ one }) => ({
    clinic: one(clinics, {
        fields: [smsTemplates.clinicId],
        references: [clinics.id],
    }),
}));

// ============================================================================
// VISIT RATING SYSTEM
// ============================================================================

// Enum for rating request status
export const ratingRequestStatusEnum = pgEnum('rating_request_status', [
    'PENDING',      // Waiting for 24h to pass
    'SENT',         // Email sent
    'COMPLETED',    // Rating received
    'EXPIRED',      // Token expired (1 week)
    'SKIPPED',      // Patient has no email
]);

// Rating Requests (tracking for cron job scheduling)
export const ratingRequests = pgTable(
    'rating_requests',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        appointmentId: uuid('appointment_id')
            .notNull()
            .references(() => appointments.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id')
            .notNull()
            .references(() => patients.id, { onDelete: 'cascade' }),
        token: varchar('token', { length: 64 }).notNull().unique(),
        status: ratingRequestStatusEnum('status').default('PENDING').notNull(),
        scheduledFor: timestamp('scheduled_for').notNull(), // completedAt + 24h
        expiresAt: timestamp('expires_at').notNull(), // scheduledFor + 7 days
        sentAt: timestamp('sent_at'),
        completedAt: timestamp('completed_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdx: index('rating_requests_clinic_idx').on(table.clinicId),
        appointmentIdx: uniqueIndex('rating_requests_appointment_idx').on(table.appointmentId),
        tokenIdx: uniqueIndex('rating_requests_token_idx').on(table.token),
        statusIdx: index('rating_requests_status_idx').on(table.status),
        scheduledForIdx: index('rating_requests_scheduled_for_idx').on(table.scheduledFor),
    })
);

// Visit Ratings (actual patient submissions)
export const visitRatings = pgTable(
    'visit_ratings',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        appointmentId: uuid('appointment_id')
            .notNull()
            .unique()
            .references(() => appointments.id, { onDelete: 'cascade' }),
        ratingRequestId: uuid('rating_request_id')
            .notNull()
            .references(() => ratingRequests.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
        rating: integer('rating').notNull(), // 1-5 stars
        comment: text('comment'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdx: index('visit_ratings_clinic_idx').on(table.clinicId),
        appointmentIdx: uniqueIndex('visit_ratings_appointment_idx').on(table.appointmentId),
        ratingIdx: index('visit_ratings_rating_idx').on(table.rating),
    })
);

// Worker Ratings (N:M - replicated to all assigned workers)
export const workerRatings = pgTable(
    'worker_ratings',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        visitRatingId: uuid('visit_rating_id')
            .notNull()
            .references(() => visitRatings.id, { onDelete: 'cascade' }),
        workerId: uuid('worker_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        appointmentId: uuid('appointment_id')
            .notNull()
            .references(() => appointments.id, { onDelete: 'cascade' }),
        rating: integer('rating').notNull(), // Same rating as visitRating (for fast queries)
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        visitRatingIdx: index('worker_ratings_visit_rating_idx').on(table.visitRatingId),
        workerIdx: index('worker_ratings_worker_idx').on(table.workerId),
        workerAppointmentIdx: uniqueIndex('worker_ratings_worker_apt_idx').on(
            table.workerId,
            table.appointmentId
        ),
    })
);

// Rating System Relations
export const ratingRequestsRelations = relations(ratingRequests, ({ one }) => ({
    clinic: one(clinics, {
        fields: [ratingRequests.clinicId],
        references: [clinics.id],
    }),
    appointment: one(appointments, {
        fields: [ratingRequests.appointmentId],
        references: [appointments.id],
    }),
    patient: one(patients, {
        fields: [ratingRequests.patientId],
        references: [patients.id],
    }),
}));

export const visitRatingsRelations = relations(visitRatings, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [visitRatings.clinicId],
        references: [clinics.id],
    }),
    appointment: one(appointments, {
        fields: [visitRatings.appointmentId],
        references: [appointments.id],
    }),
    ratingRequest: one(ratingRequests, {
        fields: [visitRatings.ratingRequestId],
        references: [ratingRequests.id],
    }),
    patient: one(patients, {
        fields: [visitRatings.patientId],
        references: [patients.id],
    }),
    workerRatings: many(workerRatings),
}));

export const workerRatingsRelations = relations(workerRatings, ({ one }) => ({
    visitRating: one(visitRatings, {
        fields: [workerRatings.visitRatingId],
        references: [visitRatings.id],
    }),
    worker: one(users, {
        fields: [workerRatings.workerId],
        references: [users.id],
    }),
    appointment: one(appointments, {
        fields: [workerRatings.appointmentId],
        references: [appointments.id],
    }),
}));

// ============================================================================
// EMAIL MARKETING
// ============================================================================

export const campaignStatusEnum = pgEnum('campaign_status', [
    'DRAFT',      // En edición
    'SCHEDULED',  // Programada para enviar
    'SENDING',    // Enviando
    'SENT',       // Enviada
    'PAUSED',     // Pausada
    'CANCELLED',  // Cancelada
]);

export const marketingTemplateCategoryEnum = pgEnum('marketing_template_category', [
    'birthday',
    'promo',
    'seasonal',
    'educational',
    'reactivation',
    'onboarding',
    'newsletter',
    'custom',
]);

// Marketing Templates (independent from notification templates)
export const marketingTemplates = pgTable(
    'marketing_templates',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'cascade' }), // null = system template
        name: varchar('name', { length: 100 }).notNull(),
        subject: varchar('subject', { length: 255 }).notNull(),
        category: marketingTemplateCategoryEnum('category').default('custom'),
        designJson: jsonb('design_json').notNull().default({}), // Unlayer JSON
        htmlContent: text('html_content'), // Rendered HTML cache
        previewText: varchar('preview_text', { length: 150 }),
        thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
        isSystemTemplate: boolean('is_system_template').default(false).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        createdById: uuid('created_by_id').references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('marketing_templates_clinic_id_idx').on(table.clinicId),
        categoryIdx: index('marketing_templates_category_idx').on(table.category),
        systemIdx: index('marketing_templates_system_idx').on(table.isSystemTemplate),
    })
);

// Audience Segments (saved patient filters)
export const audienceSegments = pgTable(
    'audience_segments',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 100 }).notNull(),
        description: text('description'),
        filters: jsonb('filters').notNull().default([]), // Array of filter conditions
        patientCount: integer('patient_count').default(0), // Cached count
        isActive: boolean('is_active').default(true).notNull(),
        createdById: uuid('created_by_id').references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('audience_segments_clinic_id_idx').on(table.clinicId),
    })
);

// Marketing Campaigns
export const marketingCampaigns = pgTable(
    'marketing_campaigns',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        templateId: uuid('template_id').references(() => marketingTemplates.id, { onDelete: 'set null' }),
        segmentId: uuid('segment_id').references(() => audienceSegments.id, { onDelete: 'set null' }),
        name: varchar('name', { length: 100 }).notNull(),
        subject: varchar('subject', { length: 255 }).notNull(),
        htmlContent: text('html_content'), // Rendered content at send time
        status: campaignStatusEnum('status').default('DRAFT').notNull(),
        scheduledAt: timestamp('scheduled_at'), // null = immediate
        sentAt: timestamp('sent_at'),
        totalRecipients: integer('total_recipients').default(0),
        sentCount: integer('sent_count').default(0),
        failedCount: integer('failed_count').default(0),
        createdById: uuid('created_by_id').references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdIdx: index('marketing_campaigns_clinic_id_idx').on(table.clinicId),
        statusIdx: index('marketing_campaigns_status_idx').on(table.status),
        scheduledAtIdx: index('marketing_campaigns_scheduled_at_idx').on(table.scheduledAt),
    })
);

// Campaign Recipients (email queue for batch sending)
export const campaignRecipients = pgTable(
    'campaign_recipients',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        campaignId: uuid('campaign_id')
            .notNull()
            .references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id')
            .notNull()
            .references(() => patients.id, { onDelete: 'cascade' }),
        email: varchar('email', { length: 255 }).notNull(),
        status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, sent, failed
        sentAt: timestamp('sent_at'),
        errorMessage: text('error_message'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        campaignIdIdx: index('campaign_recipients_campaign_id_idx').on(table.campaignId),
        statusIdx: index('campaign_recipients_status_idx').on(table.status),
    })
);

// Birthday Email Settings (per clinic)
export const birthdaySettings = pgTable('birthday_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
        .notNull()
        .unique()
        .references(() => clinics.id, { onDelete: 'cascade' }),
    isEnabled: boolean('is_enabled').default(false).notNull(),
    templateId: uuid('template_id').references(() => marketingTemplates.id, { onDelete: 'set null' }),
    sendHour: integer('send_hour').default(9).notNull(), // 0-23 (9 = 9:00 AM)
    daysInAdvance: integer('days_in_advance').default(0).notNull(), // 0 = same day
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Birthday Email Log (prevents duplicate emails)
export const birthdayEmailLog = pgTable(
    'birthday_email_log',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id')
            .notNull()
            .references(() => patients.id, { onDelete: 'cascade' }),
        year: integer('year').notNull(), // Birthday year
        sentAt: timestamp('sent_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicPatientYearIdx: uniqueIndex('birthday_email_log_unique_idx').on(
            table.clinicId,
            table.patientId,
            table.year
        ),
    })
);

// EMAIL MARKETING RELATIONS

export const marketingTemplatesRelations = relations(marketingTemplates, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [marketingTemplates.clinicId],
        references: [clinics.id],
    }),
    createdBy: one(users, {
        fields: [marketingTemplates.createdById],
        references: [users.id],
    }),
    campaigns: many(marketingCampaigns),
}));

export const audienceSegmentsRelations = relations(audienceSegments, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [audienceSegments.clinicId],
        references: [clinics.id],
    }),
    createdBy: one(users, {
        fields: [audienceSegments.createdById],
        references: [users.id],
    }),
    campaigns: many(marketingCampaigns),
}));

export const marketingCampaignsRelations = relations(marketingCampaigns, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [marketingCampaigns.clinicId],
        references: [clinics.id],
    }),
    template: one(marketingTemplates, {
        fields: [marketingCampaigns.templateId],
        references: [marketingTemplates.id],
    }),
    segment: one(audienceSegments, {
        fields: [marketingCampaigns.segmentId],
        references: [audienceSegments.id],
    }),
    createdBy: one(users, {
        fields: [marketingCampaigns.createdById],
        references: [users.id],
    }),
    recipients: many(campaignRecipients),
}));

export const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
    campaign: one(marketingCampaigns, {
        fields: [campaignRecipients.campaignId],
        references: [marketingCampaigns.id],
    }),
    patient: one(patients, {
        fields: [campaignRecipients.patientId],
        references: [patients.id],
    }),
}));

export const birthdaySettingsRelations = relations(birthdaySettings, ({ one }) => ({
    clinic: one(clinics, {
        fields: [birthdaySettings.clinicId],
        references: [clinics.id],
    }),
    template: one(marketingTemplates, {
        fields: [birthdaySettings.templateId],
        references: [marketingTemplates.id],
    }),
}));

export const birthdayEmailLogRelations = relations(birthdayEmailLog, ({ one }) => ({
    clinic: one(clinics, {
        fields: [birthdayEmailLog.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [birthdayEmailLog.patientId],
        references: [patients.id],
    }),
}));

// ============================================================================
// BUG REPORTS
// ============================================================================

export const bugReports = pgTable(
    'bug_reports',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        organizationId: uuid('organization_id')
            .references(() => organizations.id, { onDelete: 'set null' }),
        clinicId: uuid('clinic_id')
            .references(() => clinics.id, { onDelete: 'set null' }),
        title: varchar('title', { length: 200 }).notNull(),
        description: text('description').notNull(),
        category: bugReportCategoryEnum('category').notNull().default('OTHER'),
        status: bugReportStatusEnum('status').notNull().default('PENDING'),
        pageUrl: varchar('page_url', { length: 500 }),
        userAgent: varchar('user_agent', { length: 500 }),
        adminNotes: text('admin_notes'),
        resolvedAt: timestamp('resolved_at'),
        resolvedById: uuid('resolved_by_id').references(() => users.id),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        userIdIdx: index('bug_reports_user_id_idx').on(table.userId),
        organizationIdIdx: index('bug_reports_organization_id_idx').on(table.organizationId),
        clinicIdIdx: index('bug_reports_clinic_id_idx').on(table.clinicId),
        statusIdx: index('bug_reports_status_idx').on(table.status),
        createdAtIdx: index('bug_reports_created_at_idx').on(table.createdAt),
    })
);

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
    user: one(users, {
        fields: [bugReports.userId],
        references: [users.id],
    }),
    organization: one(organizations, {
        fields: [bugReports.organizationId],
        references: [organizations.id],
    }),
    clinic: one(clinics, {
        fields: [bugReports.clinicId],
        references: [clinics.id],
    }),
    resolvedBy: one(users, {
        fields: [bugReports.resolvedById],
        references: [users.id],
        relationName: 'bugReportResolvedBy',
    }),
}));

// ============================================================================
// WHATSAPP AI CHATBOT MODULE
// ============================================================================

// Enums
export const chatConversationStatusEnum = pgEnum('chat_conversation_status', [
    'ACTIVE',
    'CLOSED',
    'ARCHIVED',
]);

export const chatControlModeEnum = pgEnum('chat_control_mode', [
    'AI',
    'HUMAN',
    'PAUSED',
]);

export const chatMessageDirectionEnum = pgEnum('chat_message_direction', [
    'INBOUND',
    'OUTBOUND',
]);

export const chatMessageStatusEnum = pgEnum('chat_message_status', [
    'SENT',
    'DELIVERED',
    'READ',
    'FAILED',
]);

export const leadStatusEnum = pgEnum('lead_status', [
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'CONVERTED',
    'LOST',
]);

export const aiFeatureEnum = pgEnum('ai_feature', [
    'chatbot',
    'radiograph',
    'transcription',
    'voice_notes',
    'email_template',
    'stock_image',
    'assistant',
]);

export const aiModelEnum = pgEnum('ai_model', [
    'gpt-4o-mini',
    'gpt-4o',
    'whisper-1',
    'dall-e-3',
]);

// WhatsApp Settings (per clinic — 1:1)
export const whatsappSettings = pgTable('whatsapp_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
        .notNull()
        .unique()
        .references(() => clinics.id, { onDelete: 'cascade' }),
    phoneNumberId: varchar('phone_number_id', { length: 100 }),       // Meta Phone Number ID
    accessToken: text('access_token'),                                 // Encrypted (AES-256-GCM)
    businessAccountId: varchar('business_account_id', { length: 100 }),
    webhookVerifyToken: varchar('webhook_verify_token', { length: 100 }),
    systemPrompt: text('system_prompt'),                               // AI personality/instructions
    autoReplyEnabled: boolean('auto_reply_enabled').default(true).notNull(),
    inactivityTimeoutHours: integer('inactivity_timeout_hours').default(24).notNull(),
    isEnabled: boolean('is_enabled').default(false).notNull(),
    isConfigured: boolean('is_configured').default(false).notNull(),
    // WhatsApp appointment notification settings
    waNotifyEnabled: boolean('wa_notify_enabled').default(false).notNull(),
    waTemplateCreated: varchar('wa_template_created', { length: 255 }),
    waTemplateMappingCreated: jsonb('wa_template_mapping_created'),       // { "1": "patient_name", "2": "appointment_date", ... }
    waTemplateModified: varchar('wa_template_modified', { length: 255 }),
    waTemplateMappingModified: jsonb('wa_template_mapping_modified'),
    waTemplateCancelled: varchar('wa_template_cancelled', { length: 255 }),
    waTemplateMappingCancelled: jsonb('wa_template_mapping_cancelled'),
    waTemplateReminder24h: varchar('wa_template_reminder_24h', { length: 255 }),
    waTemplateMappingReminder24h: jsonb('wa_template_mapping_reminder_24h'),
    waTemplateReminder1h: varchar('wa_template_reminder_1h', { length: 255 }),
    waTemplateMappingReminder1h: jsonb('wa_template_mapping_reminder_1h'),
    waReminder24hEnabled: boolean('wa_reminder_24h_enabled').default(false).notNull(),
    waReminder1hEnabled: boolean('wa_reminder_1h_enabled').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Chat Conversations
export const chatConversations = pgTable(
    'chat_conversations',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
        leadId: uuid('lead_id'),  // References chat_leads (added after table def)
        waContactPhone: varchar('wa_contact_phone', { length: 50 }).notNull(),   // E.164 format
        waContactName: varchar('wa_contact_name', { length: 255 }),               // Push name from WhatsApp
        status: chatConversationStatusEnum('status').default('ACTIVE').notNull(),
        controlMode: chatControlModeEnum('control_mode').default('AI').notNull(),
        assignedToId: uuid('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
        lastMessageAt: timestamp('last_message_at'),
        unreadCount: integer('unread_count').default(0).notNull(),
        metadata: jsonb('metadata').default({}),
        closedAt: timestamp('closed_at'),
        closedById: uuid('closed_by_id').references(() => users.id, { onDelete: 'set null' }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdx: index('chat_conversations_clinic_idx').on(table.clinicId),
        patientIdx: index('chat_conversations_patient_idx').on(table.patientId),
        phoneIdx: index('chat_conversations_phone_idx').on(table.waContactPhone),
        statusIdx: index('chat_conversations_status_idx').on(table.status),
        controlModeIdx: index('chat_conversations_control_mode_idx').on(table.controlMode),
        lastMessageIdx: index('chat_conversations_last_message_idx').on(table.lastMessageAt),
        // One active conversation per phone per clinic
        activePhoneIdx: uniqueIndex('chat_conversations_active_phone_idx')
            .on(table.clinicId, table.waContactPhone)
            .where(sql`status = 'ACTIVE'`),
    })
);

// Chat Messages
export const chatMessages = pgTable(
    'chat_messages',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => chatConversations.id, { onDelete: 'cascade' }),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        direction: chatMessageDirectionEnum('direction').notNull(),
        content: text('content'),                                        // Message text
        messageType: varchar('message_type', { length: 20 }).default('text').notNull(), // text, image, document, audio, etc.
        mediaUrl: varchar('media_url', { length: 500 }),                 // URL for media messages
        wamid: varchar('wamid', { length: 255 }),                        // WhatsApp Message ID from Meta
        status: chatMessageStatusEnum('status').default('SENT'),
        isFromAi: boolean('is_from_ai').default(false).notNull(),        // true if AI generated
        sentById: uuid('sent_by_id').references(() => users.id, { onDelete: 'set null' }), // null for inbound & AI
        errorMessage: text('error_message'),
        metadata: jsonb('metadata').default({}),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        conversationIdx: index('chat_messages_conversation_idx').on(table.conversationId),
        clinicIdx: index('chat_messages_clinic_idx').on(table.clinicId),
        wamidIdx: uniqueIndex('chat_messages_wamid_idx').on(table.wamid),
        createdAtIdx: index('chat_messages_created_at_idx').on(table.createdAt),
    })
);

// Chat Knowledge Bases (collections)
export const chatKnowledgeBases = pgTable(
    'chat_knowledge_bases',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 255 }).notNull(),               // e.g. "Información General", "Precios"
        description: text('description'),
        icon: varchar('icon', { length: 50 }).default('📚'),
        isActive: boolean('is_active').default(true).notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdx: index('chat_knowledge_bases_clinic_idx').on(table.clinicId),
    })
);

// Chat Knowledge Articles
export const chatKnowledgeArticles = pgTable(
    'chat_knowledge_articles',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        knowledgeBaseId: uuid('knowledge_base_id')
            .notNull()
            .references(() => chatKnowledgeBases.id, { onDelete: 'cascade' }),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        title: varchar('title', { length: 255 }).notNull(),
        originalContent: text('original_content').notNull(),             // Full raw text / PDF extracted
        sourceType: varchar('source_type', { length: 20 }).default('text').notNull(), // text, pdf
        sourceFilename: varchar('source_filename', { length: 255 }),     // Original PDF filename
        chunkCount: integer('chunk_count').default(0).notNull(),         // Number of generated chunks
        isProcessed: boolean('is_processed').default(false).notNull(),   // Embedding generation complete
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        knowledgeBaseIdx: index('chat_knowledge_articles_kb_idx').on(table.knowledgeBaseId),
        clinicIdx: index('chat_knowledge_articles_clinic_idx').on(table.clinicId),
    })
);

// Chat Knowledge Chunks (with pgvector embeddings for semantic search)
export const chatKnowledgeChunks = pgTable(
    'chat_knowledge_chunks',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        articleId: uuid('article_id')
            .notNull()
            .references(() => chatKnowledgeArticles.id, { onDelete: 'cascade' }),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        content: text('content').notNull(),                              // Chunk text (~500 tokens)
        chunkIndex: integer('chunk_index').notNull(),                     // Position within article
        embedding: vector('embedding'),                                   // pgvector 1536-dim
        tokenCount: integer('token_count'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        articleIdx: index('chat_knowledge_chunks_article_idx').on(table.articleId),
        clinicIdx: index('chat_knowledge_chunks_clinic_idx').on(table.clinicId),
    })
);

// Chat Leads (potential new patients from WhatsApp)
export const chatLeads = pgTable(
    'chat_leads',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        phone: varchar('phone', { length: 50 }).notNull(),              // E.164 format
        firstName: varchar('first_name', { length: 100 }),
        lastName: varchar('last_name', { length: 100 }),
        email: varchar('email', { length: 255 }),
        notes: text('notes'),
        source: varchar('source', { length: 50 }).default('whatsapp').notNull(),
        status: leadStatusEnum('status').default('NEW').notNull(),
        convertedPatientId: uuid('converted_patient_id').references(() => patients.id, { onDelete: 'set null' }),
        convertedById: uuid('converted_by_id').references(() => users.id, { onDelete: 'set null' }),
        convertedAt: timestamp('converted_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdx: index('chat_leads_clinic_idx').on(table.clinicId),
        phoneIdx: index('chat_leads_phone_idx').on(table.phone),
        statusIdx: index('chat_leads_status_idx').on(table.status),
        clinicPhoneIdx: uniqueIndex('chat_leads_clinic_phone_idx').on(table.clinicId, table.phone),
    })
);

// Chat Conversation Notes (internal staff notes)
export const chatConversationNotes = pgTable(
    'chat_conversation_notes',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => chatConversations.id, { onDelete: 'cascade' }),
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        content: text('content').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        conversationIdx: index('chat_conversation_notes_conv_idx').on(table.conversationId),
    })
);

// Chat Quick Replies (predefined responses per clinic)
export const chatQuickReplies = pgTable(
    'chat_quick_replies',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        title: varchar('title', { length: 100 }).notNull(),             // Short label
        content: text('content').notNull(),                              // Full response text
        category: varchar('category', { length: 50 }),
        sortOrder: integer('sort_order').default(0).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdx: index('chat_quick_replies_clinic_idx').on(table.clinicId),
    })
);

// Chat AI Logs (detailed AI interaction tracking)
export const chatAiLogs = pgTable(
    'chat_ai_logs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => chatConversations.id, { onDelete: 'cascade' }),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        messageId: uuid('message_id').references(() => chatMessages.id, { onDelete: 'set null' }),
        promptTokens: integer('prompt_tokens'),
        completionTokens: integer('completion_tokens'),
        totalTokens: integer('total_tokens'),
        model: varchar('model', { length: 50 }),
        latencyMs: integer('latency_ms'),
        ragChunksUsed: integer('rag_chunks_used').default(0),
        ragContext: text('rag_context'),                                 // The context retrieved
        errorMessage: text('error_message'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        conversationIdx: index('chat_ai_logs_conversation_idx').on(table.conversationId),
        clinicIdx: index('chat_ai_logs_clinic_idx').on(table.clinicId),
        createdAtIdx: index('chat_ai_logs_created_at_idx').on(table.createdAt),
    })
);

// ============================================================================
// WHATSAPP CHATBOT RELATIONS
// ============================================================================

export const whatsappSettingsRelations = relations(whatsappSettings, ({ one }) => ({
    clinic: one(clinics, {
        fields: [whatsappSettings.clinicId],
        references: [clinics.id],
    }),
}));

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [chatConversations.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [chatConversations.patientId],
        references: [patients.id],
    }),
    lead: one(chatLeads, {
        fields: [chatConversations.leadId],
        references: [chatLeads.id],
    }),
    assignedTo: one(users, {
        fields: [chatConversations.assignedToId],
        references: [users.id],
        relationName: 'conversationAssignee',
    }),
    closedBy: one(users, {
        fields: [chatConversations.closedById],
        references: [users.id],
        relationName: 'conversationCloser',
    }),
    messages: many(chatMessages),
    notes: many(chatConversationNotes),
    aiLogs: many(chatAiLogs),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
    conversation: one(chatConversations, {
        fields: [chatMessages.conversationId],
        references: [chatConversations.id],
    }),
    clinic: one(clinics, {
        fields: [chatMessages.clinicId],
        references: [clinics.id],
    }),
    sentBy: one(users, {
        fields: [chatMessages.sentById],
        references: [users.id],
    }),
}));

export const chatKnowledgeBasesRelations = relations(chatKnowledgeBases, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [chatKnowledgeBases.clinicId],
        references: [clinics.id],
    }),
    createdBy: one(users, {
        fields: [chatKnowledgeBases.createdById],
        references: [users.id],
    }),
    articles: many(chatKnowledgeArticles),
}));

export const chatKnowledgeArticlesRelations = relations(chatKnowledgeArticles, ({ one, many }) => ({
    knowledgeBase: one(chatKnowledgeBases, {
        fields: [chatKnowledgeArticles.knowledgeBaseId],
        references: [chatKnowledgeBases.id],
    }),
    clinic: one(clinics, {
        fields: [chatKnowledgeArticles.clinicId],
        references: [clinics.id],
    }),
    createdBy: one(users, {
        fields: [chatKnowledgeArticles.createdById],
        references: [users.id],
    }),
    chunks: many(chatKnowledgeChunks),
}));

export const chatKnowledgeChunksRelations = relations(chatKnowledgeChunks, ({ one }) => ({
    article: one(chatKnowledgeArticles, {
        fields: [chatKnowledgeChunks.articleId],
        references: [chatKnowledgeArticles.id],
    }),
    clinic: one(clinics, {
        fields: [chatKnowledgeChunks.clinicId],
        references: [clinics.id],
    }),
}));

export const chatLeadsRelations = relations(chatLeads, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [chatLeads.clinicId],
        references: [clinics.id],
    }),
    convertedPatient: one(patients, {
        fields: [chatLeads.convertedPatientId],
        references: [patients.id],
    }),
    convertedBy: one(users, {
        fields: [chatLeads.convertedById],
        references: [users.id],
    }),
    conversations: many(chatConversations),
}));

export const chatConversationNotesRelations = relations(chatConversationNotes, ({ one }) => ({
    conversation: one(chatConversations, {
        fields: [chatConversationNotes.conversationId],
        references: [chatConversations.id],
    }),
    createdBy: one(users, {
        fields: [chatConversationNotes.createdById],
        references: [users.id],
    }),
}));

export const chatQuickRepliesRelations = relations(chatQuickReplies, ({ one }) => ({
    clinic: one(clinics, {
        fields: [chatQuickReplies.clinicId],
        references: [clinics.id],
    }),
}));

export const chatAiLogsRelations = relations(chatAiLogs, ({ one }) => ({
    conversation: one(chatConversations, {
        fields: [chatAiLogs.conversationId],
        references: [chatConversations.id],
    }),
    clinic: one(clinics, {
        fields: [chatAiLogs.clinicId],
        references: [clinics.id],
    }),
    message: one(chatMessages, {
        fields: [chatAiLogs.messageId],
        references: [chatMessages.id],
    }),
}));

// ============================================================================
// AI USAGE LOGS (per-clinic tracking for all AI features)
// ============================================================================

export const aiUsageLogs = pgTable(
    'ai_usage_logs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        clinicId: uuid('clinic_id')
            .notNull()
            .references(() => clinics.id, { onDelete: 'cascade' }),
        feature: aiFeatureEnum('feature').notNull(),
        model: aiModelEnum('model').notNull(),
        promptTokens: integer('prompt_tokens').default(0).notNull(),
        completionTokens: integer('completion_tokens').default(0).notNull(),
        totalTokens: integer('total_tokens').default(0).notNull(),
        estimatedCost: decimal('estimated_cost', { precision: 10, scale: 6 }).default('0'),
        metadata: jsonb('metadata'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        clinicIdx: index('ai_usage_logs_clinic_idx').on(table.clinicId),
        featureIdx: index('ai_usage_logs_feature_idx').on(table.feature),
        createdAtIdx: index('ai_usage_logs_created_at_idx').on(table.createdAt),
        clinicCreatedIdx: index('ai_usage_logs_clinic_created_idx').on(table.clinicId, table.createdAt),
    })
);

export const aiUsageLogsRelations = relations(aiUsageLogs, ({ one }) => ({
    clinic: one(clinics, {
        fields: [aiUsageLogs.clinicId],
        references: [clinics.id],
    }),
}));
