import { eq, and, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { users, staffProfiles, workerClinics, clinics } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import type { TenantContext } from '../types/index.js';

/**
 * Get staff members for an organization (all clinics)
 * Excludes USER role (patients)
 */
export const getStaffByOrganization = async (db: Database, organizationId: string) => {
    return db.query.users.findMany({
        where: and(
            eq(users.organizationId, organizationId),
            eq(users.isActive, true),
            // Only include staff roles, not patients (USER role)
            sql`${users.role} IN ('SUPERADMIN', 'ADMIN', 'WORKER')`
        ),
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

/**
 * Get staff members for a specific clinic
 * This includes both workers assigned via workerClinics AND users with clinicId directly in their profile
 */
export const getStaffByClinic = async (db: Database, clinicId: string) => {
    // Get workers assigned via workerClinics table
    const assignments = await db.query.workerClinics.findMany({
        where: and(
            eq(workerClinics.clinicId, clinicId),
            eq(workerClinics.isActive, true)
        ),
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
        permissions: a.permissions || [],
    }));

    // Get users who have this clinic directly in their profile (ADMIN, WORKER with direct clinicId)
    const directClinicUsers = await db.query.users.findMany({
        where: and(
            eq(users.clinicId, clinicId),
            eq(users.isActive, true),
            // Explicitly filter for ADMIN or WORKER roles only
            sql`${users.role} IN ('ADMIN', 'WORKER')`
        ),
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
                permissions: [] as string[],
            });
        }
    }

    return merged;
};

/**
 * Assign a worker to a clinic
 */
export const assignWorkerToClinic = async (db: Database, 
    userId: string,
    clinicId: string,
    role?: string
) => {
    // Check if already assigned
    const existing = await db.query.workerClinics.findFirst({
        where: and(
            eq(workerClinics.userId, userId),
            eq(workerClinics.clinicId, clinicId)
        ),
    });

    if (existing) {
        // Reactivate if was deactivated
        if (!existing.isActive) {
            const [updated] = await db
                .update(workerClinics)
                .set({ isActive: true, role: role ?? null, updatedAt: new Date() })
                .where(eq(workerClinics.id, existing.id))
                .returning();
            return updated;
        }
        throw new ConflictError('Worker already assigned to this clinic');
    }

    const [assignment] = await db
        .insert(workerClinics)
        .values({
            userId,
            clinicId,
            role: role ?? null,
        })
        .returning();

    return assignment;
};

/**
 * Remove a worker from a clinic
 */
export const removeWorkerFromClinic = async (db: Database, userId: string, clinicId: string) => {
    const existing = await db.query.workerClinics.findFirst({
        where: and(
            eq(workerClinics.userId, userId),
            eq(workerClinics.clinicId, clinicId)
        ),
    });

    if (!existing) {
        throw new NotFoundError('Assignment not found');
    }

    await db
        .update(workerClinics)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(workerClinics.id, existing.id));

    return true;
};

/**
 * Get clinics for a worker
 */
export const getClinicsForWorker = async (db: Database, userId: string) => {
    const assignments = await db.query.workerClinics.findMany({
        where: and(
            eq(workerClinics.userId, userId),
            eq(workerClinics.isActive, true)
        ),
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
        permissions: a.permissions || [],
    }));
};

/**
 * Get accessible clinics for a user based on their role
 */
export const getAccessibleClinics = async (db: Database, userId: string, role: string, organizationId?: string | null) => {
    // For SUPERADMIN, return all clinics
    if (role === 'SUPERADMIN') {
        return db.query.clinics.findMany({
            where: eq(clinics.isActive, true),
            with: {
                organization: true,
            },
            orderBy: (c, { asc }) => [asc(c.name)],
        });
    }

    // For ADMIN, return all clinics in their organization
    if (role === 'ADMIN' && organizationId) {
        return db.query.clinics.findMany({
            where: and(
                eq(clinics.organizationId, organizationId),
                eq(clinics.isActive, true)
            ),
            orderBy: (c, { asc }) => [asc(c.name)],
        });
    }

    // For WORKER, return assigned clinics from workerClinics table
    if (role === 'WORKER') {
        const workerClinicsList = await getClinicsForWorker(db, userId);

        // If no assignments in workerClinics, check for direct clinicId on user
        if (workerClinicsList.length === 0) {
            const user = await db.query.users.findFirst({
                where: eq(users.id, userId),
                columns: { clinicId: true },
            });

            if (user?.clinicId) {
                const directClinic = await db.query.clinics.findFirst({
                    where: and(
                        eq(clinics.id, user.clinicId),
                        eq(clinics.isActive, true)
                    ),
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

/**
 * Update staff profile
 */
export const updateStaffProfile = async (db: Database, 
    userId: string,
    data: {
        licenseNumber?: string;
        specialty?: string;
        bio?: string;
        color?: string;
    }
) => {
    const existing = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.userId, userId),
    });

    if (existing) {
        const [updated] = await db
            .update(staffProfiles)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(staffProfiles.userId, userId))
            .returning();
        return updated;
    }

    const [created] = await db
        .insert(staffProfiles)
        .values({
            userId,
            ...data,
        })
        .returning();

    return created;
};
