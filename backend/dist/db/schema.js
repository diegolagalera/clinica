"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRelations = exports.invoicesRelations = exports.appointmentStockUsageRelations = exports.stockPackItemsRelations = exports.stockPacksRelations = exports.stockMovementsRelations = exports.inventoryItemsRelations = exports.radiographAiResultsRelations = exports.radiographsRelations = exports.clinicalRecordsRelations = exports.appointmentWorkersRelations = exports.appointmentsRelations = exports.patientsRelations = exports.workerClinicsRelations = exports.staffProfilesRelations = exports.usersRelations = exports.clinicsRelations = exports.organizationsRelations = exports.refreshTokens = exports.documentEmbeddings = exports.auditLogs = exports.expenses = exports.payments = exports.invoices = exports.appointmentStockUsage = exports.stockPackItems = exports.stockPacks = exports.stockMovements = exports.inventoryItems = exports.radiographAiResults = exports.radiographs = exports.clinicalRecords = exports.appointmentWorkers = exports.appointments = exports.patients = exports.workerClinics = exports.staffProfiles = exports.users = exports.clinics = exports.organizations = exports.auditActionEnum = exports.paymentMethodEnum = exports.invoiceStatusEnum = exports.toothSurfaceEnum = exports.dentalConditionEnum = exports.stockMovementTypeEnum = exports.aiAnalysisStatusEnum = exports.appointmentStatusEnum = exports.appointmentTypeEnum = exports.roleEnum = void 0;
exports.workerRatingsRelations = exports.visitRatingsRelations = exports.ratingRequestsRelations = exports.workerRatings = exports.visitRatings = exports.ratingRequests = exports.ratingRequestStatusEnum = exports.smsTemplatesRelations = exports.smsSettingsRelations = exports.smsTemplates = exports.smsSettings = exports.smsTemplateTypeEnum = exports.pendingNotificationsRelations = exports.pendingNotifications = exports.notificationLogsRelations = exports.emailTemplatesRelations = exports.emailSettingsRelations = exports.notificationLogs = exports.emailTemplates = exports.emailSettings = exports.notificationStatusEnum = exports.emailTemplateTypeEnum = exports.odontogramSnapshotsRelations = exports.odontogramSnapshots = exports.odontogramHistoryRelations = exports.odontogramTeethRelations = exports.odontogramsRelations = exports.odontogramHistory = exports.odontogramTeeth = exports.odontograms = exports.refreshTokensRelations = exports.expensesRelations = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// ============================================================================
// ENUMS
// ============================================================================
exports.roleEnum = (0, pg_core_1.pgEnum)('role', ['SUPERADMIN', 'ADMIN', 'WORKER', 'USER']);
exports.appointmentTypeEnum = (0, pg_core_1.pgEnum)('appointment_type', [
    'VISIT',
    'SURGERY',
    'REVIEW',
    'EMERGENCY',
    'FOLLOWUP',
]);
exports.appointmentStatusEnum = (0, pg_core_1.pgEnum)('appointment_status', [
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
]);
exports.aiAnalysisStatusEnum = (0, pg_core_1.pgEnum)('ai_analysis_status', [
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'REVIEWED',
    'REJECTED',
]);
exports.stockMovementTypeEnum = (0, pg_core_1.pgEnum)('stock_movement_type', [
    'IN',
    'OUT',
    'ADJUSTMENT',
    'EXPIRED',
]);
exports.dentalConditionEnum = (0, pg_core_1.pgEnum)('dental_condition', [
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
exports.toothSurfaceEnum = (0, pg_core_1.pgEnum)('tooth_surface', [
    'MESIAL',
    'DISTAL',
    'OCCLUSAL',
    'VESTIBULAR',
    'PALATINO',
]);
exports.invoiceStatusEnum = (0, pg_core_1.pgEnum)('invoice_status', [
    'DRAFT',
    'SENT',
    'PAID',
    'PARTIAL',
    'OVERDUE',
    'CANCELLED',
]);
exports.paymentMethodEnum = (0, pg_core_1.pgEnum)('payment_method', [
    'CASH',
    'CARD',
    'TRANSFER',
    'INSURANCE',
    'OTHER',
]);
exports.auditActionEnum = (0, pg_core_1.pgEnum)('audit_action', [
    'CREATE',
    'READ',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'EXPORT',
    'AI_ANALYSIS',
]);
// ============================================================================
// ORGANIZATIONS
// ============================================================================
exports.organizations = (0, pg_core_1.pgTable)('organizations', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    slug: (0, pg_core_1.varchar)('slug', { length: 100 }).notNull().unique(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }),
    phone: (0, pg_core_1.varchar)('phone', { length: 50 }),
    address: (0, pg_core_1.text)('address'),
    logoUrl: (0, pg_core_1.varchar)('logo_url', { length: 500 }),
    settings: (0, pg_core_1.jsonb)('settings').default({}),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    slugIdx: (0, pg_core_1.uniqueIndex)('organizations_slug_idx').on(table.slug),
}));
// ============================================================================
// CLINICS
// ============================================================================
exports.clinics = (0, pg_core_1.pgTable)('clinics', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)('organization_id')
        .notNull()
        .references(() => exports.organizations.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    slug: (0, pg_core_1.varchar)('slug', { length: 100 }).notNull(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }),
    phone: (0, pg_core_1.varchar)('phone', { length: 50 }),
    address: (0, pg_core_1.text)('address'),
    city: (0, pg_core_1.varchar)('city', { length: 100 }),
    postalCode: (0, pg_core_1.varchar)('postal_code', { length: 20 }),
    country: (0, pg_core_1.varchar)('country', { length: 2 }).default('ES'),
    timezone: (0, pg_core_1.varchar)('timezone', { length: 50 }).default('Europe/Madrid'),
    settings: (0, pg_core_1.jsonb)('settings').default({}),
    workingHours: (0, pg_core_1.jsonb)('working_hours').default({}),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    orgIdIdx: (0, pg_core_1.index)('clinics_organization_id_idx').on(table.organizationId),
    slugOrgIdx: (0, pg_core_1.uniqueIndex)('clinics_slug_org_idx').on(table.slug, table.organizationId),
}));
// ============================================================================
// USERS
// ============================================================================
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    passwordHash: (0, pg_core_1.varchar)('password_hash', { length: 255 }).notNull(),
    firstName: (0, pg_core_1.varchar)('first_name', { length: 100 }).notNull(),
    lastName: (0, pg_core_1.varchar)('last_name', { length: 100 }).notNull(),
    phone: (0, pg_core_1.varchar)('phone', { length: 50 }),
    avatarUrl: (0, pg_core_1.varchar)('avatar_url', { length: 500 }),
    role: (0, exports.roleEnum)('role').notNull().default('USER'),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id, {
        onDelete: 'set null',
    }),
    clinicId: (0, pg_core_1.uuid)('clinic_id').references(() => exports.clinics.id, { onDelete: 'set null' }),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    emailVerified: (0, pg_core_1.boolean)('email_verified').default(false).notNull(),
    emailVerificationToken: (0, pg_core_1.varchar)('email_verification_token', { length: 255 }),
    passwordResetToken: (0, pg_core_1.varchar)('password_reset_token', { length: 255 }),
    passwordResetExpires: (0, pg_core_1.timestamp)('password_reset_expires'),
    twoFactorEnabled: (0, pg_core_1.boolean)('two_factor_enabled').default(false).notNull(),
    twoFactorSecret: (0, pg_core_1.varchar)('two_factor_secret', { length: 255 }),
    tokenVersion: (0, pg_core_1.integer)('token_version').default(0).notNull(),
    lastLoginAt: (0, pg_core_1.timestamp)('last_login_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    emailIdx: (0, pg_core_1.uniqueIndex)('users_email_idx').on(table.email),
    orgIdIdx: (0, pg_core_1.index)('users_organization_id_idx').on(table.organizationId),
    clinicIdIdx: (0, pg_core_1.index)('users_clinic_id_idx').on(table.clinicId),
    roleIdx: (0, pg_core_1.index)('users_role_idx').on(table.role),
}));
// ============================================================================
// STAFF PROFILES (additional info for WORKER/ADMIN roles)
// ============================================================================
exports.staffProfiles = (0, pg_core_1.pgTable)('staff_profiles', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .unique()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    licenseNumber: (0, pg_core_1.varchar)('license_number', { length: 100 }),
    specialty: (0, pg_core_1.varchar)('specialty', { length: 100 }),
    bio: (0, pg_core_1.text)('bio'),
    color: (0, pg_core_1.varchar)('color', { length: 7 }), // For calendar display
    workingDays: (0, pg_core_1.jsonb)('working_days').default([]),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: (0, pg_core_1.uniqueIndex)('staff_profiles_user_id_idx').on(table.userId),
}));
// ============================================================================
// WORKER-CLINIC ASSIGNMENTS (many-to-many for workers across clinics)
// ============================================================================
exports.workerClinics = (0, pg_core_1.pgTable)('worker_clinics', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    role: (0, pg_core_1.varchar)('role', { length: 50 }), // Optional specific role in this clinic
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    userClinicIdx: (0, pg_core_1.uniqueIndex)('worker_clinics_user_clinic_idx').on(table.userId, table.clinicId),
    userIdIdx: (0, pg_core_1.index)('worker_clinics_user_id_idx').on(table.userId),
    clinicIdIdx: (0, pg_core_1.index)('worker_clinics_clinic_id_idx').on(table.clinicId),
}));
// ============================================================================
// PATIENTS
// ============================================================================
exports.patients = (0, pg_core_1.pgTable)('patients', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'set null' }),
    externalId: (0, pg_core_1.varchar)('external_id', { length: 100 }), // For linking existing records
    firstName: (0, pg_core_1.varchar)('first_name', { length: 100 }).notNull(),
    lastName: (0, pg_core_1.varchar)('last_name', { length: 100 }).notNull(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }),
    phone: (0, pg_core_1.varchar)('phone', { length: 50 }),
    dateOfBirth: (0, pg_core_1.timestamp)('date_of_birth'),
    gender: (0, pg_core_1.varchar)('gender', { length: 20 }),
    idNumber: (0, pg_core_1.varchar)('id_number', { length: 50 }), // DNI/NIE/Passport
    address: (0, pg_core_1.text)('address'),
    city: (0, pg_core_1.varchar)('city', { length: 100 }),
    postalCode: (0, pg_core_1.varchar)('postal_code', { length: 20 }),
    emergencyContact: (0, pg_core_1.varchar)('emergency_contact', { length: 255 }),
    emergencyPhone: (0, pg_core_1.varchar)('emergency_phone', { length: 50 }),
    allergies: (0, pg_core_1.text)('allergies'),
    medicalHistory: (0, pg_core_1.text)('medical_history'),
    notes: (0, pg_core_1.text)('notes'),
    insuranceProvider: (0, pg_core_1.varchar)('insurance_provider', { length: 100 }),
    insuranceNumber: (0, pg_core_1.varchar)('insurance_number', { length: 100 }),
    consentGiven: (0, pg_core_1.boolean)('consent_given').default(false).notNull(),
    consentDate: (0, pg_core_1.timestamp)('consent_date'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('patients_clinic_id_idx').on(table.clinicId),
    userIdIdx: (0, pg_core_1.index)('patients_user_id_idx').on(table.userId),
    emailIdx: (0, pg_core_1.index)('patients_email_idx').on(table.email),
    nameIdx: (0, pg_core_1.index)('patients_name_idx').on(table.firstName, table.lastName),
}));
// ============================================================================
// APPOINTMENTS
// ============================================================================
exports.appointments = (0, pg_core_1.pgTable)('appointments', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id')
        .notNull()
        .references(() => exports.patients.id, { onDelete: 'cascade' }),
    workerId: (0, pg_core_1.uuid)('worker_id')
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    type: (0, exports.appointmentTypeEnum)('type').notNull().default('VISIT'),
    status: (0, exports.appointmentStatusEnum)('status').notNull().default('SCHEDULED'),
    title: (0, pg_core_1.varchar)('title', { length: 255 }),
    description: (0, pg_core_1.text)('description'),
    startTime: (0, pg_core_1.timestamp)('start_time').notNull(),
    endTime: (0, pg_core_1.timestamp)('end_time').notNull(),
    duration: (0, pg_core_1.integer)('duration').notNull(), // In minutes (planned)
    // Real-time tracking fields
    realStartTime: (0, pg_core_1.timestamp)('real_start_time'), // Actual start time
    realEndTime: (0, pg_core_1.timestamp)('real_end_time'), // Actual end time
    pausedDuration: (0, pg_core_1.integer)('paused_duration').default(0), // Paused minutes
    startedById: (0, pg_core_1.uuid)('started_by_id').references(() => exports.users.id), // Who started
    notes: (0, pg_core_1.text)('notes'),
    reminderSent: (0, pg_core_1.boolean)('reminder_sent').default(false).notNull(),
    createdById: (0, pg_core_1.uuid)('created_by_id').references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('appointments_clinic_id_idx').on(table.clinicId),
    patientIdIdx: (0, pg_core_1.index)('appointments_patient_id_idx').on(table.patientId),
    workerIdIdx: (0, pg_core_1.index)('appointments_worker_id_idx').on(table.workerId),
    startTimeIdx: (0, pg_core_1.index)('appointments_start_time_idx').on(table.startTime),
    statusIdx: (0, pg_core_1.index)('appointments_status_idx').on(table.status),
}));
// ============================================================================
// APPOINTMENT WORKERS (Many-to-Many junction table)
// ============================================================================
exports.appointmentWorkers = (0, pg_core_1.pgTable)('appointment_workers', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    appointmentId: (0, pg_core_1.uuid)('appointment_id')
        .notNull()
        .references(() => exports.appointments.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    isPrimary: (0, pg_core_1.boolean)('is_primary').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    appointmentUserIdx: (0, pg_core_1.uniqueIndex)('appointment_workers_apt_user_idx').on(table.appointmentId, table.userId),
    appointmentIdIdx: (0, pg_core_1.index)('appointment_workers_appointment_id_idx').on(table.appointmentId),
    userIdIdx: (0, pg_core_1.index)('appointment_workers_user_id_idx').on(table.userId),
}));
// ============================================================================
// CLINICAL RECORDS
// ============================================================================
exports.clinicalRecords = (0, pg_core_1.pgTable)('clinical_records', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id')
        .notNull()
        .references(() => exports.patients.id, { onDelete: 'cascade' }),
    appointmentId: (0, pg_core_1.uuid)('appointment_id').references(() => exports.appointments.id, {
        onDelete: 'set null',
    }),
    createdById: (0, pg_core_1.uuid)('created_by_id')
        .notNull()
        .references(() => exports.users.id),
    recordType: (0, pg_core_1.varchar)('record_type', { length: 50 }).notNull(), // note, procedure, diagnosis, etc.
    title: (0, pg_core_1.varchar)('title', { length: 255 }),
    content: (0, pg_core_1.text)('content'),
    vitalSigns: (0, pg_core_1.jsonb)('vital_signs'),
    procedures: (0, pg_core_1.jsonb)('procedures'), // Array of procedures performed
    diagnosis: (0, pg_core_1.text)('diagnosis'),
    treatment: (0, pg_core_1.text)('treatment'),
    prescriptions: (0, pg_core_1.jsonb)('prescriptions'),
    toothChart: (0, pg_core_1.jsonb)('tooth_chart'), // Dental chart data
    attachments: (0, pg_core_1.jsonb)('attachments'), // Array of file references
    isSigned: (0, pg_core_1.boolean)('is_signed').default(false).notNull(),
    signedAt: (0, pg_core_1.timestamp)('signed_at'),
    signedById: (0, pg_core_1.uuid)('signed_by_id').references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('clinical_records_clinic_id_idx').on(table.clinicId),
    patientIdIdx: (0, pg_core_1.index)('clinical_records_patient_id_idx').on(table.patientId),
    appointmentIdIdx: (0, pg_core_1.index)('clinical_records_appointment_id_idx').on(table.appointmentId),
    createdAtIdx: (0, pg_core_1.index)('clinical_records_created_at_idx').on(table.createdAt),
}));
// ============================================================================
// RADIOGRAPHS
// ============================================================================
exports.radiographs = (0, pg_core_1.pgTable)('radiographs', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id')
        .notNull()
        .references(() => exports.patients.id, { onDelete: 'cascade' }),
    clinicalRecordId: (0, pg_core_1.uuid)('clinical_record_id').references(() => exports.clinicalRecords.id, {
        onDelete: 'set null',
    }),
    uploadedById: (0, pg_core_1.uuid)('uploaded_by_id')
        .notNull()
        .references(() => exports.users.id),
    filename: (0, pg_core_1.varchar)('filename', { length: 255 }).notNull(),
    originalFilename: (0, pg_core_1.varchar)('original_filename', { length: 255 }).notNull(),
    mimeType: (0, pg_core_1.varchar)('mime_type', { length: 100 }).notNull(),
    fileSize: (0, pg_core_1.integer)('file_size').notNull(),
    storageKey: (0, pg_core_1.varchar)('storage_key', { length: 500 }).notNull(),
    radiographType: (0, pg_core_1.varchar)('radiograph_type', { length: 50 }), // panoramic, periapical, bitewing, etc.
    toothNumbers: (0, pg_core_1.jsonb)('tooth_numbers'), // Array of tooth numbers if applicable
    notes: (0, pg_core_1.text)('notes'),
    annotations: (0, pg_core_1.jsonb)('annotations'), // User annotations on the image
    metadata: (0, pg_core_1.jsonb)('metadata'), // DICOM metadata, etc.
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('radiographs_clinic_id_idx').on(table.clinicId),
    patientIdIdx: (0, pg_core_1.index)('radiographs_patient_id_idx').on(table.patientId),
    uploadedByIdIdx: (0, pg_core_1.index)('radiographs_uploaded_by_id_idx').on(table.uploadedById),
}));
// ============================================================================
// RADIOGRAPH AI RESULTS
// ============================================================================
exports.radiographAiResults = (0, pg_core_1.pgTable)('radiograph_ai_results', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    radiographId: (0, pg_core_1.uuid)('radiograph_id')
        .notNull()
        .unique()
        .references(() => exports.radiographs.id, { onDelete: 'cascade' }),
    status: (0, exports.aiAnalysisStatusEnum)('status').notNull().default('PENDING'),
    modelVersion: (0, pg_core_1.varchar)('model_version', { length: 50 }),
    processingTimeMs: (0, pg_core_1.integer)('processing_time_ms'),
    suspiciousAreas: (0, pg_core_1.jsonb)('suspicious_areas').default([]),
    summary: (0, pg_core_1.text)('summary'),
    confidence: (0, pg_core_1.decimal)('confidence', { precision: 5, scale: 4 }),
    rawResponse: (0, pg_core_1.jsonb)('raw_response'),
    reviewedById: (0, pg_core_1.uuid)('reviewed_by_id').references(() => exports.users.id),
    reviewedAt: (0, pg_core_1.timestamp)('reviewed_at'),
    reviewNotes: (0, pg_core_1.text)('review_notes'),
    isAccepted: (0, pg_core_1.boolean)('is_accepted'),
    errorMessage: (0, pg_core_1.text)('error_message'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    radiographIdIdx: (0, pg_core_1.uniqueIndex)('radiograph_ai_results_radiograph_id_idx').on(table.radiographId),
    statusIdx: (0, pg_core_1.index)('radiograph_ai_results_status_idx').on(table.status),
}));
// ============================================================================
// INVENTORY ITEMS
// ============================================================================
exports.inventoryItems = (0, pg_core_1.pgTable)('inventory_items', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    sku: (0, pg_core_1.varchar)('sku', { length: 100 }),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    category: (0, pg_core_1.varchar)('category', { length: 100 }),
    unit: (0, pg_core_1.varchar)('unit', { length: 50 }).default('units'),
    currentStock: (0, pg_core_1.integer)('current_stock').default(0).notNull(),
    minStock: (0, pg_core_1.integer)('min_stock').default(0).notNull(),
    maxStock: (0, pg_core_1.integer)('max_stock'),
    costPrice: (0, pg_core_1.decimal)('cost_price', { precision: 10, scale: 2 }),
    sellPrice: (0, pg_core_1.decimal)('sell_price', { precision: 10, scale: 2 }),
    supplier: (0, pg_core_1.varchar)('supplier', { length: 255 }),
    supplierCode: (0, pg_core_1.varchar)('supplier_code', { length: 100 }),
    expirationDate: (0, pg_core_1.timestamp)('expiration_date'),
    location: (0, pg_core_1.varchar)('location', { length: 100 }),
    imageUrl: (0, pg_core_1.varchar)('image_url', { length: 500 }), // URL de imagen del producto
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('inventory_items_clinic_id_idx').on(table.clinicId),
    skuIdx: (0, pg_core_1.index)('inventory_items_sku_idx').on(table.sku),
    categoryIdx: (0, pg_core_1.index)('inventory_items_category_idx').on(table.category),
    lowStockIdx: (0, pg_core_1.index)('inventory_items_low_stock_idx').on(table.currentStock, table.minStock),
}));
// ============================================================================
// STOCK MOVEMENTS
// ============================================================================
exports.stockMovements = (0, pg_core_1.pgTable)('stock_movements', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    itemId: (0, pg_core_1.uuid)('item_id')
        .notNull()
        .references(() => exports.inventoryItems.id, { onDelete: 'cascade' }),
    type: (0, exports.stockMovementTypeEnum)('type').notNull(),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    previousStock: (0, pg_core_1.integer)('previous_stock').notNull(),
    newStock: (0, pg_core_1.integer)('new_stock').notNull(),
    reason: (0, pg_core_1.text)('reason'),
    reference: (0, pg_core_1.varchar)('reference', { length: 255 }), // PO number, procedure ID, etc.
    performedById: (0, pg_core_1.uuid)('performed_by_id')
        .notNull()
        .references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('stock_movements_clinic_id_idx').on(table.clinicId),
    itemIdIdx: (0, pg_core_1.index)('stock_movements_item_id_idx').on(table.itemId),
    createdAtIdx: (0, pg_core_1.index)('stock_movements_created_at_idx').on(table.createdAt),
}));
// ============================================================================
// STOCK PACKS (Predefined material packages)
// ============================================================================
exports.stockPacks = (0, pg_core_1.pgTable)('stock_packs', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    category: (0, pg_core_1.varchar)('category', { length: 100 }),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdById: (0, pg_core_1.uuid)('created_by_id').references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('stock_packs_clinic_id_idx').on(table.clinicId),
    nameIdx: (0, pg_core_1.index)('stock_packs_name_idx').on(table.name),
}));
// ============================================================================
// STOCK PACK ITEMS (Items within a pack)
// ============================================================================
exports.stockPackItems = (0, pg_core_1.pgTable)('stock_pack_items', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    packId: (0, pg_core_1.uuid)('pack_id')
        .notNull()
        .references(() => exports.stockPacks.id, { onDelete: 'cascade' }),
    itemId: (0, pg_core_1.uuid)('item_id')
        .notNull()
        .references(() => exports.inventoryItems.id, { onDelete: 'cascade' }),
    quantity: (0, pg_core_1.integer)('quantity').notNull().default(1),
}, (table) => ({
    packIdIdx: (0, pg_core_1.index)('stock_pack_items_pack_id_idx').on(table.packId),
    packItemIdx: (0, pg_core_1.uniqueIndex)('stock_pack_items_pack_item_idx').on(table.packId, table.itemId),
}));
// ============================================================================
// APPOINTMENT STOCK USAGE (Stock consumed in appointments)
// ============================================================================
exports.appointmentStockUsage = (0, pg_core_1.pgTable)('appointment_stock_usage', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    appointmentId: (0, pg_core_1.uuid)('appointment_id')
        .notNull()
        .references(() => exports.appointments.id, { onDelete: 'cascade' }),
    itemId: (0, pg_core_1.uuid)('item_id')
        .notNull()
        .references(() => exports.inventoryItems.id, { onDelete: 'restrict' }),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    unitCost: (0, pg_core_1.decimal)('unit_cost', { precision: 10, scale: 2 }),
    notes: (0, pg_core_1.text)('notes'),
    registeredById: (0, pg_core_1.uuid)('registered_by_id')
        .notNull()
        .references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('appointment_stock_usage_clinic_id_idx').on(table.clinicId),
    appointmentIdIdx: (0, pg_core_1.index)('appointment_stock_usage_appointment_id_idx').on(table.appointmentId),
    itemIdIdx: (0, pg_core_1.index)('appointment_stock_usage_item_id_idx').on(table.itemId),
    createdAtIdx: (0, pg_core_1.index)('appointment_stock_usage_created_at_idx').on(table.createdAt),
}));
// ============================================================================
// INVOICES
// ============================================================================
exports.invoices = (0, pg_core_1.pgTable)('invoices', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id')
        .notNull()
        .references(() => exports.patients.id, { onDelete: 'cascade' }),
    invoiceNumber: (0, pg_core_1.varchar)('invoice_number', { length: 50 }).notNull(),
    status: (0, exports.invoiceStatusEnum)('status').notNull().default('DRAFT'),
    issueDate: (0, pg_core_1.timestamp)('issue_date').notNull(),
    dueDate: (0, pg_core_1.timestamp)('due_date'),
    subtotal: (0, pg_core_1.decimal)('subtotal', { precision: 10, scale: 2 }).notNull(),
    taxRate: (0, pg_core_1.decimal)('tax_rate', { precision: 5, scale: 2 }).default('21'),
    taxAmount: (0, pg_core_1.decimal)('tax_amount', { precision: 10, scale: 2 }).notNull(),
    discount: (0, pg_core_1.decimal)('discount', { precision: 10, scale: 2 }).default('0'),
    total: (0, pg_core_1.decimal)('total', { precision: 10, scale: 2 }).notNull(),
    paidAmount: (0, pg_core_1.decimal)('paid_amount', { precision: 10, scale: 2 }).default('0'),
    items: (0, pg_core_1.jsonb)('items').notNull(), // Array of invoice line items
    notes: (0, pg_core_1.text)('notes'),
    createdById: (0, pg_core_1.uuid)('created_by_id')
        .notNull()
        .references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('invoices_clinic_id_idx').on(table.clinicId),
    patientIdIdx: (0, pg_core_1.index)('invoices_patient_id_idx').on(table.patientId),
    invoiceNumberIdx: (0, pg_core_1.uniqueIndex)('invoices_number_clinic_idx').on(table.invoiceNumber, table.clinicId),
    statusIdx: (0, pg_core_1.index)('invoices_status_idx').on(table.status),
}));
// ============================================================================
// PAYMENTS
// ============================================================================
exports.payments = (0, pg_core_1.pgTable)('payments', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    invoiceId: (0, pg_core_1.uuid)('invoice_id')
        .notNull()
        .references(() => exports.invoices.id, { onDelete: 'cascade' }),
    amount: (0, pg_core_1.decimal)('amount', { precision: 10, scale: 2 }).notNull(),
    method: (0, exports.paymentMethodEnum)('method').notNull(),
    reference: (0, pg_core_1.varchar)('reference', { length: 255 }),
    notes: (0, pg_core_1.text)('notes'),
    paymentDate: (0, pg_core_1.timestamp)('payment_date').notNull(),
    recordedById: (0, pg_core_1.uuid)('recorded_by_id')
        .notNull()
        .references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('payments_clinic_id_idx').on(table.clinicId),
    invoiceIdIdx: (0, pg_core_1.index)('payments_invoice_id_idx').on(table.invoiceId),
    paymentDateIdx: (0, pg_core_1.index)('payments_payment_date_idx').on(table.paymentDate),
}));
// ============================================================================
// EXPENSES
// ============================================================================
exports.expenses = (0, pg_core_1.pgTable)('expenses', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    category: (0, pg_core_1.varchar)('category', { length: 100 }).notNull(),
    description: (0, pg_core_1.text)('description').notNull(),
    amount: (0, pg_core_1.decimal)('amount', { precision: 10, scale: 2 }).notNull(),
    taxAmount: (0, pg_core_1.decimal)('tax_amount', { precision: 10, scale: 2 }),
    expenseDate: (0, pg_core_1.timestamp)('expense_date').notNull(),
    vendor: (0, pg_core_1.varchar)('vendor', { length: 255 }),
    invoiceReference: (0, pg_core_1.varchar)('invoice_reference', { length: 100 }),
    attachmentUrl: (0, pg_core_1.varchar)('attachment_url', { length: 500 }),
    notes: (0, pg_core_1.text)('notes'),
    recordedById: (0, pg_core_1.uuid)('recorded_by_id')
        .notNull()
        .references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('expenses_clinic_id_idx').on(table.clinicId),
    categoryIdx: (0, pg_core_1.index)('expenses_category_idx').on(table.category),
    expenseDateIdx: (0, pg_core_1.index)('expenses_expense_date_idx').on(table.expenseDate),
}));
// ============================================================================
// AUDIT LOGS
// ============================================================================
exports.auditLogs = (0, pg_core_1.pgTable)('audit_logs', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id, {
        onDelete: 'set null',
    }),
    clinicId: (0, pg_core_1.uuid)('clinic_id').references(() => exports.clinics.id, { onDelete: 'set null' }),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'set null' }),
    action: (0, exports.auditActionEnum)('action').notNull(),
    entityType: (0, pg_core_1.varchar)('entity_type', { length: 50 }).notNull(),
    entityId: (0, pg_core_1.uuid)('entity_id'),
    oldValues: (0, pg_core_1.jsonb)('old_values'),
    newValues: (0, pg_core_1.jsonb)('new_values'),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    userAgent: (0, pg_core_1.text)('user_agent'),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    organizationIdIdx: (0, pg_core_1.index)('audit_logs_organization_id_idx').on(table.organizationId),
    clinicIdIdx: (0, pg_core_1.index)('audit_logs_clinic_id_idx').on(table.clinicId),
    userIdIdx: (0, pg_core_1.index)('audit_logs_user_id_idx').on(table.userId),
    actionIdx: (0, pg_core_1.index)('audit_logs_action_idx').on(table.action),
    entityTypeIdx: (0, pg_core_1.index)('audit_logs_entity_type_idx').on(table.entityType),
    createdAtIdx: (0, pg_core_1.index)('audit_logs_created_at_idx').on(table.createdAt),
}));
// ============================================================================
// DOCUMENT EMBEDDINGS (for RAG)
// ============================================================================
exports.documentEmbeddings = (0, pg_core_1.pgTable)('document_embeddings', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id').references(() => exports.patients.id, { onDelete: 'cascade' }),
    sourceType: (0, pg_core_1.varchar)('source_type', { length: 50 }).notNull(), // clinical_record, radiograph_note, etc.
    sourceId: (0, pg_core_1.uuid)('source_id').notNull(),
    content: (0, pg_core_1.text)('content').notNull(),
    // Note: embedding vector stored as text for now, will use pgvector extension
    embedding: (0, pg_core_1.text)('embedding'),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdIdx: (0, pg_core_1.index)('document_embeddings_clinic_id_idx').on(table.clinicId),
    patientIdIdx: (0, pg_core_1.index)('document_embeddings_patient_id_idx').on(table.patientId),
    sourceIdx: (0, pg_core_1.index)('document_embeddings_source_idx').on(table.sourceType, table.sourceId),
}));
// ============================================================================
// REFRESH TOKENS
// ============================================================================
exports.refreshTokens = (0, pg_core_1.pgTable)('refresh_tokens', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    token: (0, pg_core_1.varchar)('token', { length: 500 }).notNull().unique(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    revokedAt: (0, pg_core_1.timestamp)('revoked_at'),
    replacedByToken: (0, pg_core_1.varchar)('replaced_by_token', { length: 500 }),
}, (table) => ({
    userIdIdx: (0, pg_core_1.index)('refresh_tokens_user_id_idx').on(table.userId),
    tokenIdx: (0, pg_core_1.uniqueIndex)('refresh_tokens_token_idx').on(table.token),
    expiresAtIdx: (0, pg_core_1.index)('refresh_tokens_expires_at_idx').on(table.expiresAt),
}));
// ============================================================================
// RELATIONS
// ============================================================================
exports.organizationsRelations = (0, drizzle_orm_1.relations)(exports.organizations, ({ many }) => ({
    clinics: many(exports.clinics),
    users: many(exports.users),
}));
exports.clinicsRelations = (0, drizzle_orm_1.relations)(exports.clinics, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.clinics.organizationId],
        references: [exports.organizations.id],
    }),
    users: many(exports.users),
    patients: many(exports.patients),
    appointments: many(exports.appointments),
    clinicalRecords: many(exports.clinicalRecords),
    radiographs: many(exports.radiographs),
    inventoryItems: many(exports.inventoryItems),
    invoices: many(exports.invoices),
}));
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.users.organizationId],
        references: [exports.organizations.id],
    }),
    clinic: one(exports.clinics, {
        fields: [exports.users.clinicId],
        references: [exports.clinics.id],
    }),
    staffProfile: one(exports.staffProfiles),
    workerClinics: many(exports.workerClinics),
    appointments: many(exports.appointments),
    refreshTokens: many(exports.refreshTokens),
}));
exports.staffProfilesRelations = (0, drizzle_orm_1.relations)(exports.staffProfiles, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.staffProfiles.userId],
        references: [exports.users.id],
    }),
}));
exports.workerClinicsRelations = (0, drizzle_orm_1.relations)(exports.workerClinics, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.workerClinics.userId],
        references: [exports.users.id],
    }),
    clinic: one(exports.clinics, {
        fields: [exports.workerClinics.clinicId],
        references: [exports.clinics.id],
    }),
}));
exports.patientsRelations = (0, drizzle_orm_1.relations)(exports.patients, ({ one, many }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.patients.clinicId],
        references: [exports.clinics.id],
    }),
    user: one(exports.users, {
        fields: [exports.patients.userId],
        references: [exports.users.id],
    }),
    appointments: many(exports.appointments),
    clinicalRecords: many(exports.clinicalRecords),
    radiographs: many(exports.radiographs),
    invoices: many(exports.invoices),
}));
exports.appointmentsRelations = (0, drizzle_orm_1.relations)(exports.appointments, ({ one, many }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.appointments.clinicId],
        references: [exports.clinics.id],
    }),
    patient: one(exports.patients, {
        fields: [exports.appointments.patientId],
        references: [exports.patients.id],
    }),
    worker: one(exports.users, {
        fields: [exports.appointments.workerId],
        references: [exports.users.id],
    }),
    clinicalRecords: many(exports.clinicalRecords),
    appointmentWorkers: many(exports.appointmentWorkers),
    stockUsage: many(exports.appointmentStockUsage),
}));
exports.appointmentWorkersRelations = (0, drizzle_orm_1.relations)(exports.appointmentWorkers, ({ one }) => ({
    appointment: one(exports.appointments, {
        fields: [exports.appointmentWorkers.appointmentId],
        references: [exports.appointments.id],
    }),
    user: one(exports.users, {
        fields: [exports.appointmentWorkers.userId],
        references: [exports.users.id],
    }),
}));
exports.clinicalRecordsRelations = (0, drizzle_orm_1.relations)(exports.clinicalRecords, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.clinicalRecords.clinicId],
        references: [exports.clinics.id],
    }),
    patient: one(exports.patients, {
        fields: [exports.clinicalRecords.patientId],
        references: [exports.patients.id],
    }),
    appointment: one(exports.appointments, {
        fields: [exports.clinicalRecords.appointmentId],
        references: [exports.appointments.id],
    }),
    createdBy: one(exports.users, {
        relationName: 'recordCreator',
        fields: [exports.clinicalRecords.createdById],
        references: [exports.users.id],
    }),
    signedBy: one(exports.users, {
        relationName: 'recordSigner',
        fields: [exports.clinicalRecords.signedById],
        references: [exports.users.id],
    }),
}));
exports.radiographsRelations = (0, drizzle_orm_1.relations)(exports.radiographs, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.radiographs.clinicId],
        references: [exports.clinics.id],
    }),
    patient: one(exports.patients, {
        fields: [exports.radiographs.patientId],
        references: [exports.patients.id],
    }),
    clinicalRecord: one(exports.clinicalRecords, {
        fields: [exports.radiographs.clinicalRecordId],
        references: [exports.clinicalRecords.id],
    }),
    uploadedBy: one(exports.users, {
        fields: [exports.radiographs.uploadedById],
        references: [exports.users.id],
    }),
    aiResult: one(exports.radiographAiResults),
}));
exports.radiographAiResultsRelations = (0, drizzle_orm_1.relations)(exports.radiographAiResults, ({ one }) => ({
    radiograph: one(exports.radiographs, {
        fields: [exports.radiographAiResults.radiographId],
        references: [exports.radiographs.id],
    }),
    reviewedBy: one(exports.users, {
        fields: [exports.radiographAiResults.reviewedById],
        references: [exports.users.id],
    }),
}));
exports.inventoryItemsRelations = (0, drizzle_orm_1.relations)(exports.inventoryItems, ({ one, many }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.inventoryItems.clinicId],
        references: [exports.clinics.id],
    }),
    movements: many(exports.stockMovements),
    packItems: many(exports.stockPackItems),
    appointmentUsage: many(exports.appointmentStockUsage),
}));
exports.stockMovementsRelations = (0, drizzle_orm_1.relations)(exports.stockMovements, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.stockMovements.clinicId],
        references: [exports.clinics.id],
    }),
    item: one(exports.inventoryItems, {
        fields: [exports.stockMovements.itemId],
        references: [exports.inventoryItems.id],
    }),
    performedBy: one(exports.users, {
        fields: [exports.stockMovements.performedById],
        references: [exports.users.id],
    }),
}));
exports.stockPacksRelations = (0, drizzle_orm_1.relations)(exports.stockPacks, ({ one, many }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.stockPacks.clinicId],
        references: [exports.clinics.id],
    }),
    createdBy: one(exports.users, {
        fields: [exports.stockPacks.createdById],
        references: [exports.users.id],
    }),
    items: many(exports.stockPackItems),
}));
exports.stockPackItemsRelations = (0, drizzle_orm_1.relations)(exports.stockPackItems, ({ one }) => ({
    pack: one(exports.stockPacks, {
        fields: [exports.stockPackItems.packId],
        references: [exports.stockPacks.id],
    }),
    item: one(exports.inventoryItems, {
        fields: [exports.stockPackItems.itemId],
        references: [exports.inventoryItems.id],
    }),
}));
exports.appointmentStockUsageRelations = (0, drizzle_orm_1.relations)(exports.appointmentStockUsage, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.appointmentStockUsage.clinicId],
        references: [exports.clinics.id],
    }),
    appointment: one(exports.appointments, {
        fields: [exports.appointmentStockUsage.appointmentId],
        references: [exports.appointments.id],
    }),
    item: one(exports.inventoryItems, {
        fields: [exports.appointmentStockUsage.itemId],
        references: [exports.inventoryItems.id],
    }),
    registeredBy: one(exports.users, {
        fields: [exports.appointmentStockUsage.registeredById],
        references: [exports.users.id],
    }),
}));
exports.invoicesRelations = (0, drizzle_orm_1.relations)(exports.invoices, ({ one, many }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.invoices.clinicId],
        references: [exports.clinics.id],
    }),
    patient: one(exports.patients, {
        fields: [exports.invoices.patientId],
        references: [exports.patients.id],
    }),
    createdBy: one(exports.users, {
        fields: [exports.invoices.createdById],
        references: [exports.users.id],
    }),
    payments: many(exports.payments),
}));
exports.paymentsRelations = (0, drizzle_orm_1.relations)(exports.payments, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.payments.clinicId],
        references: [exports.clinics.id],
    }),
    invoice: one(exports.invoices, {
        fields: [exports.payments.invoiceId],
        references: [exports.invoices.id],
    }),
    recordedBy: one(exports.users, {
        fields: [exports.payments.recordedById],
        references: [exports.users.id],
    }),
}));
exports.expensesRelations = (0, drizzle_orm_1.relations)(exports.expenses, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.expenses.clinicId],
        references: [exports.clinics.id],
    }),
    recordedBy: one(exports.users, {
        fields: [exports.expenses.recordedById],
        references: [exports.users.id],
    }),
}));
exports.refreshTokensRelations = (0, drizzle_orm_1.relations)(exports.refreshTokens, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.refreshTokens.userId],
        references: [exports.users.id],
    }),
}));
// ============================================================================
// ODONTOGRAM (Dental Chart)
// ============================================================================
exports.odontograms = (0, pg_core_1.pgTable)('odontograms', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id')
        .notNull()
        .references(() => exports.patients.id, { onDelete: 'cascade' }),
    isChild: (0, pg_core_1.boolean)('is_child').default(false), // true = 20 teeth, false = 32 teeth
    notes: (0, pg_core_1.text)('notes'),
    lastUpdatedById: (0, pg_core_1.uuid)('last_updated_by_id').references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdx: (0, pg_core_1.index)('odontograms_clinic_idx').on(table.clinicId),
    patientIdx: (0, pg_core_1.uniqueIndex)('odontograms_patient_unique_idx').on(table.patientId),
}));
exports.odontogramTeeth = (0, pg_core_1.pgTable)('odontogram_teeth', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    odontogramId: (0, pg_core_1.uuid)('odontogram_id')
        .notNull()
        .references(() => exports.odontograms.id, { onDelete: 'cascade' }),
    toothNumber: (0, pg_core_1.integer)('tooth_number').notNull(), // FDI notation: 11-18, 21-28, 31-38, 41-48
    generalCondition: (0, exports.dentalConditionEnum)('general_condition').default('HEALTHY'),
    // Surface-specific conditions (JSON for flexibility)
    surfaces: (0, pg_core_1.jsonb)('surfaces').default({
        mesial: 'HEALTHY',
        distal: 'HEALTHY',
        occlusal: 'HEALTHY',
        vestibular: 'HEALTHY',
        palatino: 'HEALTHY',
    }),
    notes: (0, pg_core_1.text)('notes'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    odontogramIdx: (0, pg_core_1.index)('odontogram_teeth_odontogram_idx').on(table.odontogramId),
    toothIdx: (0, pg_core_1.uniqueIndex)('odontogram_teeth_unique_idx').on(table.odontogramId, table.toothNumber),
}));
exports.odontogramHistory = (0, pg_core_1.pgTable)('odontogram_history', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    odontogramId: (0, pg_core_1.uuid)('odontogram_id')
        .notNull()
        .references(() => exports.odontograms.id, { onDelete: 'cascade' }),
    toothNumber: (0, pg_core_1.integer)('tooth_number').notNull(),
    surface: (0, pg_core_1.varchar)('surface', { length: 20 }), // null = whole tooth
    previousCondition: (0, pg_core_1.varchar)('previous_condition', { length: 50 }),
    newCondition: (0, pg_core_1.varchar)('new_condition', { length: 50 }).notNull(),
    changedById: (0, pg_core_1.uuid)('changed_by_id')
        .notNull()
        .references(() => exports.users.id),
    notes: (0, pg_core_1.text)('notes'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    odontogramIdx: (0, pg_core_1.index)('odontogram_history_odontogram_idx').on(table.odontogramId),
    toothIdx: (0, pg_core_1.index)('odontogram_history_tooth_idx').on(table.odontogramId, table.toothNumber),
}));
// Odontogram Relations
exports.odontogramsRelations = (0, drizzle_orm_1.relations)(exports.odontograms, ({ one, many }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.odontograms.clinicId],
        references: [exports.clinics.id],
    }),
    patient: one(exports.patients, {
        fields: [exports.odontograms.patientId],
        references: [exports.patients.id],
    }),
    lastUpdatedBy: one(exports.users, {
        fields: [exports.odontograms.lastUpdatedById],
        references: [exports.users.id],
    }),
    teeth: many(exports.odontogramTeeth),
    history: many(exports.odontogramHistory),
}));
exports.odontogramTeethRelations = (0, drizzle_orm_1.relations)(exports.odontogramTeeth, ({ one }) => ({
    odontogram: one(exports.odontograms, {
        fields: [exports.odontogramTeeth.odontogramId],
        references: [exports.odontograms.id],
    }),
}));
exports.odontogramHistoryRelations = (0, drizzle_orm_1.relations)(exports.odontogramHistory, ({ one }) => ({
    odontogram: one(exports.odontograms, {
        fields: [exports.odontogramHistory.odontogramId],
        references: [exports.odontograms.id],
    }),
    changedBy: one(exports.users, {
        fields: [exports.odontogramHistory.changedById],
        references: [exports.users.id],
    }),
}));
// Odontogram Snapshots (Before/After Treatment)
exports.odontogramSnapshots = (0, pg_core_1.pgTable)('odontogram_snapshots', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    odontogramId: (0, pg_core_1.uuid)('odontogram_id')
        .notNull()
        .references(() => exports.odontograms.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(), // e.g. "Estado inicial", "Post-tratamiento"
    description: (0, pg_core_1.text)('description'),
    teethState: (0, pg_core_1.jsonb)('teeth_state').notNull(), // Full state of all teeth at snapshot time
    createdById: (0, pg_core_1.uuid)('created_by_id')
        .notNull()
        .references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    odontogramIdx: (0, pg_core_1.index)('odontogram_snapshots_odontogram_idx').on(table.odontogramId),
}));
exports.odontogramSnapshotsRelations = (0, drizzle_orm_1.relations)(exports.odontogramSnapshots, ({ one }) => ({
    odontogram: one(exports.odontograms, {
        fields: [exports.odontogramSnapshots.odontogramId],
        references: [exports.odontograms.id],
    }),
    createdBy: one(exports.users, {
        fields: [exports.odontogramSnapshots.createdById],
        references: [exports.users.id],
    }),
}));
// ============================================================================
// EMAIL/NOTIFICATION SYSTEM
// ============================================================================
exports.emailTemplateTypeEnum = (0, pg_core_1.pgEnum)('email_template_type', [
    'APPOINTMENT_CREATED',
    'APPOINTMENT_REMINDER_24H',
    'APPOINTMENT_REMINDER_1H',
    'APPOINTMENT_CANCELLED',
    'DOCUMENT_SIGNED',
    'VISIT_RATING_REQUEST',
    'CUSTOM',
]);
exports.notificationStatusEnum = (0, pg_core_1.pgEnum)('notification_status', [
    'PENDING',
    'SENT',
    'FAILED',
    'BOUNCED',
]);
// Email Settings (SMTP configuration per clinic)
exports.emailSettings = (0, pg_core_1.pgTable)('email_settings', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .unique()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    smtpHost: (0, pg_core_1.varchar)('smtp_host', { length: 255 }).default('smtp.gmail.com'),
    smtpPort: (0, pg_core_1.integer)('smtp_port').default(587),
    smtpUser: (0, pg_core_1.varchar)('smtp_user', { length: 255 }),
    smtpPass: (0, pg_core_1.varchar)('smtp_pass', { length: 500 }), // Encrypted
    fromName: (0, pg_core_1.varchar)('from_name', { length: 100 }),
    fromEmail: (0, pg_core_1.varchar)('from_email', { length: 255 }),
    isEnabled: (0, pg_core_1.boolean)('is_enabled').default(false).notNull(),
    isConfigured: (0, pg_core_1.boolean)('is_configured').default(false).notNull(),
    // Notification toggles
    sendOnCreate: (0, pg_core_1.boolean)('send_on_create').default(true).notNull(),
    sendOnCancel: (0, pg_core_1.boolean)('send_on_cancel').default(true).notNull(),
    reminder24hEnabled: (0, pg_core_1.boolean)('reminder_24h_enabled').default(true).notNull(),
    reminder1hEnabled: (0, pg_core_1.boolean)('reminder_1h_enabled').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Email Templates
exports.emailTemplates = (0, pg_core_1.pgTable)('email_templates', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    type: (0, exports.emailTemplateTypeEnum)('type').notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    subject: (0, pg_core_1.varchar)('subject', { length: 255 }).notNull(),
    blocks: (0, pg_core_1.jsonb)('blocks').notNull().default([]), // Visual editor blocks
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    isDefault: (0, pg_core_1.boolean)('is_default').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicTypeIdx: (0, pg_core_1.index)('email_templates_clinic_type_idx').on(table.clinicId, table.type),
}));
// Notification Logs
exports.notificationLogs = (0, pg_core_1.pgTable)('notification_logs', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id').references(() => exports.patients.id, { onDelete: 'set null' }),
    appointmentId: (0, pg_core_1.uuid)('appointment_id').references(() => exports.appointments.id, { onDelete: 'set null' }),
    templateId: (0, pg_core_1.uuid)('template_id').references(() => exports.emailTemplates.id, { onDelete: 'set null' }),
    templateType: (0, exports.emailTemplateTypeEnum)('template_type').notNull(),
    channel: (0, pg_core_1.varchar)('channel', { length: 20 }).default('email').notNull(),
    recipient: (0, pg_core_1.varchar)('recipient', { length: 255 }).notNull(),
    subject: (0, pg_core_1.varchar)('subject', { length: 255 }),
    status: (0, exports.notificationStatusEnum)('status').default('PENDING').notNull(),
    errorMessage: (0, pg_core_1.text)('error_message'),
    sentAt: (0, pg_core_1.timestamp)('sent_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdx: (0, pg_core_1.index)('notification_logs_clinic_idx').on(table.clinicId),
    patientIdx: (0, pg_core_1.index)('notification_logs_patient_idx').on(table.patientId),
    statusIdx: (0, pg_core_1.index)('notification_logs_status_idx').on(table.status),
    createdAtIdx: (0, pg_core_1.index)('notification_logs_created_at_idx').on(table.createdAt),
}));
// Relations
exports.emailSettingsRelations = (0, drizzle_orm_1.relations)(exports.emailSettings, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.emailSettings.clinicId],
        references: [exports.clinics.id],
    }),
}));
exports.emailTemplatesRelations = (0, drizzle_orm_1.relations)(exports.emailTemplates, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.emailTemplates.clinicId],
        references: [exports.clinics.id],
    }),
}));
exports.notificationLogsRelations = (0, drizzle_orm_1.relations)(exports.notificationLogs, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.notificationLogs.clinicId],
        references: [exports.clinics.id],
    }),
    patient: one(exports.patients, {
        fields: [exports.notificationLogs.patientId],
        references: [exports.patients.id],
    }),
    appointment: one(exports.appointments, {
        fields: [exports.notificationLogs.appointmentId],
        references: [exports.appointments.id],
    }),
    template: one(exports.emailTemplates, {
        fields: [exports.notificationLogs.templateId],
        references: [exports.emailTemplates.id],
    }),
}));
// Pending Notifications (for debounced sending)
exports.pendingNotifications = (0, pg_core_1.pgTable)('pending_notifications', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    appointmentId: (0, pg_core_1.uuid)('appointment_id')
        .notNull()
        .references(() => exports.appointments.id, { onDelete: 'cascade' }),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id')
        .notNull()
        .references(() => exports.patients.id, { onDelete: 'cascade' }),
    type: (0, exports.emailTemplateTypeEnum)('type').notNull(),
    scheduledFor: (0, pg_core_1.timestamp)('scheduled_for').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    // Only one pending notification per appointment
    appointmentIdx: (0, pg_core_1.uniqueIndex)('pending_notifications_appointment_idx').on(table.appointmentId),
    scheduledForIdx: (0, pg_core_1.index)('pending_notifications_scheduled_for_idx').on(table.scheduledFor),
}));
exports.pendingNotificationsRelations = (0, drizzle_orm_1.relations)(exports.pendingNotifications, ({ one }) => ({
    appointment: one(exports.appointments, {
        fields: [exports.pendingNotifications.appointmentId],
        references: [exports.appointments.id],
    }),
    clinic: one(exports.clinics, {
        fields: [exports.pendingNotifications.clinicId],
        references: [exports.clinics.id],
    }),
    patient: one(exports.patients, {
        fields: [exports.pendingNotifications.patientId],
        references: [exports.patients.id],
    }),
}));
// ============================================================================
// SMS NOTIFICATIONS (Twilio)
// ============================================================================
// SMS Template Types Enum
exports.smsTemplateTypeEnum = (0, pg_core_1.pgEnum)('sms_template_type', [
    'APPOINTMENT_CREATED',
    'APPOINTMENT_REMINDER_24H',
    'APPOINTMENT_REMINDER_1H',
    'APPOINTMENT_CANCELLED',
    'CUSTOM',
]);
// SMS Settings (Twilio configuration per clinic)
exports.smsSettings = (0, pg_core_1.pgTable)('sms_settings', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .unique()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    accountSid: (0, pg_core_1.varchar)('account_sid', { length: 100 }),
    authToken: (0, pg_core_1.varchar)('auth_token', { length: 100 }), // Should be encrypted
    fromNumber: (0, pg_core_1.varchar)('from_number', { length: 20 }), // Twilio phone number (+34...)
    isEnabled: (0, pg_core_1.boolean)('is_enabled').default(false).notNull(),
    isConfigured: (0, pg_core_1.boolean)('is_configured').default(false).notNull(),
    // Notification toggles
    sendOnCreate: (0, pg_core_1.boolean)('send_on_create').default(true).notNull(),
    sendOnCancel: (0, pg_core_1.boolean)('send_on_cancel').default(true).notNull(),
    reminder24hEnabled: (0, pg_core_1.boolean)('reminder_24h_enabled').default(true).notNull(),
    reminder1hEnabled: (0, pg_core_1.boolean)('reminder_1h_enabled').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// SMS Templates
exports.smsTemplates = (0, pg_core_1.pgTable)('sms_templates', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    type: (0, exports.smsTemplateTypeEnum)('type').notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    content: (0, pg_core_1.text)('content').notNull(), // SMS text (recommend max 160 chars)
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    isDefault: (0, pg_core_1.boolean)('is_default').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    clinicTypeIdx: (0, pg_core_1.index)('sms_templates_clinic_type_idx').on(table.clinicId, table.type),
}));
// SMS Relations
exports.smsSettingsRelations = (0, drizzle_orm_1.relations)(exports.smsSettings, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.smsSettings.clinicId],
        references: [exports.clinics.id],
    }),
}));
exports.smsTemplatesRelations = (0, drizzle_orm_1.relations)(exports.smsTemplates, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.smsTemplates.clinicId],
        references: [exports.clinics.id],
    }),
}));
// ============================================================================
// VISIT RATING SYSTEM
// ============================================================================
// Enum for rating request status
exports.ratingRequestStatusEnum = (0, pg_core_1.pgEnum)('rating_request_status', [
    'PENDING', // Waiting for 24h to pass
    'SENT', // Email sent
    'COMPLETED', // Rating received
    'EXPIRED', // Token expired (1 week)
    'SKIPPED', // Patient has no email
]);
// Rating Requests (tracking for cron job scheduling)
exports.ratingRequests = (0, pg_core_1.pgTable)('rating_requests', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    appointmentId: (0, pg_core_1.uuid)('appointment_id')
        .notNull()
        .references(() => exports.appointments.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id')
        .notNull()
        .references(() => exports.patients.id, { onDelete: 'cascade' }),
    token: (0, pg_core_1.varchar)('token', { length: 64 }).notNull().unique(),
    status: (0, exports.ratingRequestStatusEnum)('status').default('PENDING').notNull(),
    scheduledFor: (0, pg_core_1.timestamp)('scheduled_for').notNull(), // completedAt + 24h
    expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull(), // scheduledFor + 7 days
    sentAt: (0, pg_core_1.timestamp)('sent_at'),
    completedAt: (0, pg_core_1.timestamp)('completed_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdx: (0, pg_core_1.index)('rating_requests_clinic_idx').on(table.clinicId),
    appointmentIdx: (0, pg_core_1.uniqueIndex)('rating_requests_appointment_idx').on(table.appointmentId),
    tokenIdx: (0, pg_core_1.uniqueIndex)('rating_requests_token_idx').on(table.token),
    statusIdx: (0, pg_core_1.index)('rating_requests_status_idx').on(table.status),
    scheduledForIdx: (0, pg_core_1.index)('rating_requests_scheduled_for_idx').on(table.scheduledFor),
}));
// Visit Ratings (actual patient submissions)
exports.visitRatings = (0, pg_core_1.pgTable)('visit_ratings', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clinicId: (0, pg_core_1.uuid)('clinic_id')
        .notNull()
        .references(() => exports.clinics.id, { onDelete: 'cascade' }),
    appointmentId: (0, pg_core_1.uuid)('appointment_id')
        .notNull()
        .unique()
        .references(() => exports.appointments.id, { onDelete: 'cascade' }),
    ratingRequestId: (0, pg_core_1.uuid)('rating_request_id')
        .notNull()
        .references(() => exports.ratingRequests.id, { onDelete: 'cascade' }),
    patientId: (0, pg_core_1.uuid)('patient_id').references(() => exports.patients.id, { onDelete: 'set null' }),
    rating: (0, pg_core_1.integer)('rating').notNull(), // 1-5 stars
    comment: (0, pg_core_1.text)('comment'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    clinicIdx: (0, pg_core_1.index)('visit_ratings_clinic_idx').on(table.clinicId),
    appointmentIdx: (0, pg_core_1.uniqueIndex)('visit_ratings_appointment_idx').on(table.appointmentId),
    ratingIdx: (0, pg_core_1.index)('visit_ratings_rating_idx').on(table.rating),
}));
// Worker Ratings (N:M - replicated to all assigned workers)
exports.workerRatings = (0, pg_core_1.pgTable)('worker_ratings', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    visitRatingId: (0, pg_core_1.uuid)('visit_rating_id')
        .notNull()
        .references(() => exports.visitRatings.id, { onDelete: 'cascade' }),
    workerId: (0, pg_core_1.uuid)('worker_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    appointmentId: (0, pg_core_1.uuid)('appointment_id')
        .notNull()
        .references(() => exports.appointments.id, { onDelete: 'cascade' }),
    rating: (0, pg_core_1.integer)('rating').notNull(), // Same rating as visitRating (for fast queries)
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    visitRatingIdx: (0, pg_core_1.index)('worker_ratings_visit_rating_idx').on(table.visitRatingId),
    workerIdx: (0, pg_core_1.index)('worker_ratings_worker_idx').on(table.workerId),
    workerAppointmentIdx: (0, pg_core_1.uniqueIndex)('worker_ratings_worker_apt_idx').on(table.workerId, table.appointmentId),
}));
// Rating System Relations
exports.ratingRequestsRelations = (0, drizzle_orm_1.relations)(exports.ratingRequests, ({ one }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.ratingRequests.clinicId],
        references: [exports.clinics.id],
    }),
    appointment: one(exports.appointments, {
        fields: [exports.ratingRequests.appointmentId],
        references: [exports.appointments.id],
    }),
    patient: one(exports.patients, {
        fields: [exports.ratingRequests.patientId],
        references: [exports.patients.id],
    }),
}));
exports.visitRatingsRelations = (0, drizzle_orm_1.relations)(exports.visitRatings, ({ one, many }) => ({
    clinic: one(exports.clinics, {
        fields: [exports.visitRatings.clinicId],
        references: [exports.clinics.id],
    }),
    appointment: one(exports.appointments, {
        fields: [exports.visitRatings.appointmentId],
        references: [exports.appointments.id],
    }),
    ratingRequest: one(exports.ratingRequests, {
        fields: [exports.visitRatings.ratingRequestId],
        references: [exports.ratingRequests.id],
    }),
    patient: one(exports.patients, {
        fields: [exports.visitRatings.patientId],
        references: [exports.patients.id],
    }),
    workerRatings: many(exports.workerRatings),
}));
exports.workerRatingsRelations = (0, drizzle_orm_1.relations)(exports.workerRatings, ({ one }) => ({
    visitRating: one(exports.visitRatings, {
        fields: [exports.workerRatings.visitRatingId],
        references: [exports.visitRatings.id],
    }),
    worker: one(exports.users, {
        fields: [exports.workerRatings.workerId],
        references: [exports.users.id],
    }),
    appointment: one(exports.appointments, {
        fields: [exports.workerRatings.appointmentId],
        references: [exports.appointments.id],
    }),
}));
//# sourceMappingURL=schema.js.map