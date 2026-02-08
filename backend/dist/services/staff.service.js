"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStaffProfile = exports.getAccessibleClinics = exports.getClinicsForWorker = exports.removeWorkerFromClinic = exports.assignWorkerToClinic = exports.getStaffByClinic = exports.getStaffByOrganization = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * Get staff members for an organization (all clinics)
 * Excludes USER role (patients)
 */
const getStaffByOrganization = async (organizationId) => {
    return index_js_1.db.query.users.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.users.organizationId, organizationId), (0, drizzle_orm_1.eq)(schema_js_1.users.isActive, true), 
        // Only include staff roles, not patients (USER role)
        (0, drizzle_orm_1.sql) `${schema_js_1.users.role} IN ('SUPERADMIN', 'ADMIN', 'WORKER')`),
        with: {
            staffProfile: true,
            workerClinics: {
                with: {
                    clinic: true,
                },
            },
        },
        columns: {
            passwordHash: false,
            twoFactorSecret: false,
        },
    });
};
exports.getStaffByOrganization = getStaffByOrganization;
/**
 * Get staff members for a specific clinic
 * This includes both workers assigned via workerClinics AND users with clinicId directly in their profile
 */
const getStaffByClinic = async (clinicId) => {
    // Get workers assigned via workerClinics table
    const assignments = await index_js_1.db.query.workerClinics.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.workerClinics.clinicId, clinicId), (0, drizzle_orm_1.eq)(schema_js_1.workerClinics.isActive, true)),
        with: {
            user: {
                with: {
                    staffProfile: true,
                },
                columns: {
                    passwordHash: false,
                    twoFactorSecret: false,
                },
            },
        },
    });
    const staffFromAssignments = assignments.map(a => ({
        ...a.user,
        clinicRole: a.role,
    }));
    // Get users who have this clinic directly in their profile (ADMIN, WORKER with direct clinicId)
    const directClinicUsers = await index_js_1.db.query.users.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.users.clinicId, clinicId), (0, drizzle_orm_1.eq)(schema_js_1.users.isActive, true), 
        // Explicitly filter for ADMIN or WORKER roles only
        (0, drizzle_orm_1.sql) `${schema_js_1.users.role} IN ('ADMIN', 'WORKER')`),
        with: {
            staffProfile: true,
        },
        columns: {
            passwordHash: false,
            twoFactorSecret: false,
        },
    });
    // Merge both lists, avoiding duplicates
    const staffIds = new Set(staffFromAssignments.map(s => s.id));
    const merged = [...staffFromAssignments];
    for (const user of directClinicUsers) {
        if (!staffIds.has(user.id)) {
            merged.push({
                ...user,
                clinicRole: user.role === 'ADMIN' ? 'Administrador' : 'Trabajador',
            });
        }
    }
    return merged;
};
exports.getStaffByClinic = getStaffByClinic;
/**
 * Assign a worker to a clinic
 */
const assignWorkerToClinic = async (userId, clinicId, role) => {
    // Check if already assigned
    const existing = await index_js_1.db.query.workerClinics.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.workerClinics.userId, userId), (0, drizzle_orm_1.eq)(schema_js_1.workerClinics.clinicId, clinicId)),
    });
    if (existing) {
        // Reactivate if was deactivated
        if (!existing.isActive) {
            const [updated] = await index_js_1.db
                .update(schema_js_1.workerClinics)
                .set({ isActive: true, role: role ?? null, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_js_1.workerClinics.id, existing.id))
                .returning();
            return updated;
        }
        throw new errors_js_1.ConflictError('Worker already assigned to this clinic');
    }
    const [assignment] = await index_js_1.db
        .insert(schema_js_1.workerClinics)
        .values({
        userId,
        clinicId,
        role: role ?? null,
    })
        .returning();
    return assignment;
};
exports.assignWorkerToClinic = assignWorkerToClinic;
/**
 * Remove a worker from a clinic
 */
const removeWorkerFromClinic = async (userId, clinicId) => {
    const existing = await index_js_1.db.query.workerClinics.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.workerClinics.userId, userId), (0, drizzle_orm_1.eq)(schema_js_1.workerClinics.clinicId, clinicId)),
    });
    if (!existing) {
        throw new errors_js_1.NotFoundError('Assignment not found');
    }
    await index_js_1.db
        .update(schema_js_1.workerClinics)
        .set({ isActive: false, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.workerClinics.id, existing.id));
    return true;
};
exports.removeWorkerFromClinic = removeWorkerFromClinic;
/**
 * Get clinics for a worker
 */
const getClinicsForWorker = async (userId) => {
    const assignments = await index_js_1.db.query.workerClinics.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.workerClinics.userId, userId), (0, drizzle_orm_1.eq)(schema_js_1.workerClinics.isActive, true)),
        with: {
            clinic: {
                with: {
                    organization: true,
                },
            },
        },
    });
    return assignments.map(a => ({
        ...a.clinic,
        role: a.role,
    }));
};
exports.getClinicsForWorker = getClinicsForWorker;
/**
 * Get accessible clinics for a user based on their role
 */
const getAccessibleClinics = async (userId, role, organizationId) => {
    // For SUPERADMIN, return all clinics
    if (role === 'SUPERADMIN') {
        return index_js_1.db.query.clinics.findMany({
            where: (0, drizzle_orm_1.eq)(schema_js_1.clinics.isActive, true),
            with: {
                organization: true,
            },
            orderBy: (c, { asc }) => [asc(c.name)],
        });
    }
    // For ADMIN, return all clinics in their organization
    if (role === 'ADMIN' && organizationId) {
        return index_js_1.db.query.clinics.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.clinics.organizationId, organizationId), (0, drizzle_orm_1.eq)(schema_js_1.clinics.isActive, true)),
            orderBy: (c, { asc }) => [asc(c.name)],
        });
    }
    // For WORKER, return assigned clinics from workerClinics table
    if (role === 'WORKER') {
        const workerClinicsList = await (0, exports.getClinicsForWorker)(userId);
        // If no assignments in workerClinics, check for direct clinicId on user
        if (workerClinicsList.length === 0) {
            const user = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, userId),
                columns: { clinicId: true },
            });
            if (user?.clinicId) {
                const directClinic = await index_js_1.db.query.clinics.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.clinics.id, user.clinicId), (0, drizzle_orm_1.eq)(schema_js_1.clinics.isActive, true)),
                    with: {
                        organization: true,
                    },
                });
                if (directClinic) {
                    return [directClinic];
                }
            }
        }
        return workerClinicsList;
    }
    return [];
};
exports.getAccessibleClinics = getAccessibleClinics;
/**
 * Update staff profile
 */
const updateStaffProfile = async (userId, data) => {
    const existing = await index_js_1.db.query.staffProfiles.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.staffProfiles.userId, userId),
    });
    if (existing) {
        const [updated] = await index_js_1.db
            .update(schema_js_1.staffProfiles)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.staffProfiles.userId, userId))
            .returning();
        return updated;
    }
    const [created] = await index_js_1.db
        .insert(schema_js_1.staffProfiles)
        .values({
        userId,
        ...data,
    })
        .returning();
    return created;
};
exports.updateStaffProfile = updateStaffProfile;
//# sourceMappingURL=staff.service.js.map