import { eq, and, or, ilike, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, organizations, clinics, staffProfiles, workerClinics } from '../db/schema.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import type { PaginationParams, ServiceResult, TenantContext, Role } from '../types/index.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export interface CreateUserInput {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: Role;
    organizationId?: string;
    clinicId?: string;
    clinicIds?: string[];
    // Staff profile fields
    licenseNumber?: string;
    specialty?: string;
}

export interface UpdateUserInput {
    firstName?: string;
    lastName?: string;
    phone?: string;
    role?: Role;
    organizationId?: string;
    clinicId?: string;
    clinicIds?: string[];
    isActive?: boolean;
    // Staff profile fields
    licenseNumber?: string;
    specialty?: string;
    bio?: string;
}

export type UserType = typeof users.$inferSelect;

/**
 * Get all users with pagination (SUPERADMIN only)
 */
export const getAllUsers = async (
    params: PaginationParams,
    filters?: { role?: Role; organizationId?: string; search?: string }
): Promise<{ data: any[]; total: number }> => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filters?.role) {
        conditions.push(eq(users.role, filters.role));
    }

    if (filters?.organizationId) {
        conditions.push(eq(users.organizationId, filters.organizationId));
    }

    if (filters?.search) {
        conditions.push(
            or(
                ilike(users.email, `%${filters.search}%`),
                ilike(users.firstName, `%${filters.search}%`),
                ilike(users.lastName, `%${filters.search}%`)
            )
        );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
        db.query.users.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (u, { desc }) => [desc(u.createdAt)],
            with: {
                organization: true,
                clinic: true,
                staffProfile: true,
            },
            columns: {
                passwordHash: false,
                twoFactorSecret: false,
            },
        }),
        db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(whereClause),
    ]);

    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};

/**
 * Get users by organization
 */
export const getUsersByOrganization = async (
    organizationId: string,
    params: PaginationParams,
    filters?: { role?: Role; search?: string; staffOnly?: boolean }
): Promise<{ data: any[]; total: number }> => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const conditions = [eq(users.organizationId, organizationId)];

    if (filters?.role) {
        conditions.push(eq(users.role, filters.role));
    } else if (filters?.staffOnly) {
        // Only include ADMIN and WORKER roles (staff), not patients (USER)
        conditions.push(inArray(users.role, ['ADMIN', 'WORKER']));
    }

    if (filters?.search) {
        conditions.push(
            or(
                ilike(users.email, `%${filters.search}%`),
                ilike(users.firstName, `%${filters.search}%`),
                ilike(users.lastName, `%${filters.search}%`)
            )!
        );
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
        db.query.users.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (u, { desc }) => [desc(u.createdAt)],
            with: {
                clinic: true,
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
        }),
        db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(whereClause),
    ]);

    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};

/**
 * Get user by ID
 */
export const getUserById = async (id: string): Promise<any | null> => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, id),
        with: {
            organization: true,
            clinic: true,
            staffProfile: true,
        },
        columns: {
            passwordHash: false,
            twoFactorSecret: false,
        },
    });

    return user ?? null;
};

/**
 * Create a new user
 */
export const createUser = async (
    input: CreateUserInput
): Promise<ServiceResult<UserType>> => {
    // Check if email already exists
    const existing = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
    });

    if (existing) {
        throw new ConflictError('Email already in use');
    }

    // Validate organization/clinic assignment
    if (input.role !== 'SUPERADMIN' && !input.organizationId) {
        throw new BadRequestError('Organization is required for non-superadmin users');
    }

    // Determine clinic IDs - use clinicIds array or single clinicId
    const allClinicIds = input.clinicIds && input.clinicIds.length > 0
        ? input.clinicIds
        : (input.clinicId ? [input.clinicId] : []);

    // For workers and users, at least one clinic is required
    if ((input.role === 'WORKER' || input.role === 'USER') && allClinicIds.length === 0) {
        throw new BadRequestError('At least one clinic is required for workers and patients');
    }

    // Use first clinic as the primary clinicId
    const primaryClinicId = allClinicIds.length > 0 ? allClinicIds[0] : undefined;

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create user
    const [user] = await db
        .insert(users)
        .values({
            email: input.email.toLowerCase(),
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone ?? null,
            role: input.role,
            organizationId: input.organizationId,
            clinicId: primaryClinicId,
            emailVerified: true, // Auto-verify for admin-created users
            isActive: true,
        })
        .returning();

    // Create staff profile if worker
    if (input.role === 'WORKER' && (input.licenseNumber || input.specialty)) {
        await db.insert(staffProfiles).values({
            userId: user!.id,
            licenseNumber: input.licenseNumber ?? null,
            specialty: input.specialty ?? null,
        });
    }

    // Create workerClinics entries for all clinics (for WORKER role)
    if (input.role === 'WORKER' && allClinicIds.length > 0) {
        for (const clinicId of allClinicIds) {
            await db.insert(workerClinics).values({
                userId: user!.id,
                clinicId: clinicId,
                isActive: true,
            });
        }
    }

    return { success: true, data: user! };
};

/**
 * Update a user
 */
export const updateUser = async (
    id: string,
    input: UpdateUserInput
): Promise<ServiceResult<any>> => {
    const existing = await getUserById(id);
    if (!existing) {
        throw new NotFoundError('User not found');
    }

    // Determine clinic IDs if provided
    const allClinicIds = input.clinicIds && input.clinicIds.length > 0
        ? input.clinicIds
        : (input.clinicId !== undefined ? (input.clinicId ? [input.clinicId] : []) : undefined);

    // Use first clinic as primary if we have clinic IDs
    const primaryClinicId = allClinicIds && allClinicIds.length > 0 ? allClinicIds[0] : input.clinicId;

    // Build update object, only including defined values
    const updateData: Record<string, any> = {
        updatedAt: new Date(),
    };
    if (input.firstName !== undefined) updateData.firstName = input.firstName;
    if (input.lastName !== undefined) updateData.lastName = input.lastName;
    if (input.phone !== undefined) updateData.phone = input.phone ?? null;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.organizationId !== undefined) updateData.organizationId = input.organizationId ?? null;
    if (primaryClinicId !== undefined) updateData.clinicId = primaryClinicId ?? null;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    // Update user
    const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

    // Update or create staff profile if worker
    if (input.role === 'WORKER' || existing.role === 'WORKER') {
        if (existing.staffProfile) {
            const profileData: Record<string, any> = { updatedAt: new Date() };
            if (input.licenseNumber !== undefined) profileData.licenseNumber = input.licenseNumber ?? null;
            if (input.specialty !== undefined) profileData.specialty = input.specialty ?? null;
            if (input.bio !== undefined) profileData.bio = input.bio ?? null;

            await db
                .update(staffProfiles)
                .set(profileData)
                .where(eq(staffProfiles.userId, id));
        } else if (input.licenseNumber || input.specialty) {
            await db.insert(staffProfiles).values({
                userId: id,
                licenseNumber: input.licenseNumber ?? null,
                specialty: input.specialty ?? null,
                bio: input.bio ?? null,
            });
        }
    }

    // Sync workerClinics if clinicIds was provided
    if (allClinicIds !== undefined && (input.role === 'WORKER' || existing.role === 'WORKER')) {
        // Delete all existing clinic assignments
        await db.delete(workerClinics).where(eq(workerClinics.userId, id));

        // Create new clinic assignments
        for (const clinicId of allClinicIds) {
            await db.insert(workerClinics).values({
                userId: id,
                clinicId: clinicId,
                isActive: true,
            });
        }
    }

    return { success: true, data: await getUserById(id) };
};

/**
 * Reset user password
 */
export const resetUserPassword = async (
    id: string,
    newPassword: string
): Promise<boolean> => {
    const existing = await getUserById(id);
    if (!existing) {
        throw new NotFoundError('User not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, id));

    return true;
};

/**
 * Delete a user
 */
export const deleteUser = async (id: string): Promise<boolean> => {
    const existing = await getUserById(id);
    if (!existing) {
        throw new NotFoundError('User not found');
    }

    await db.delete(users).where(eq(users.id, id));
    return true;
};

/**
 * Deactivate a user
 */
export const deactivateUser = async (id: string): Promise<boolean> => {
    const existing = await getUserById(id);
    if (!existing) {
        throw new NotFoundError('User not found');
    }

    await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, id));

    return true;
};

/**
 * Get available clinics for user assignment
 */
export const getAvailableClinics = async (organizationId?: string) => {
    if (organizationId) {
        return db.query.clinics.findMany({
            where: and(
                eq(clinics.organizationId, organizationId),
                eq(clinics.isActive, true)
            ),
            orderBy: (c, { asc }) => [asc(c.name)],
        });
    }

    return db.query.clinics.findMany({
        where: eq(clinics.isActive, true),
        orderBy: (c, { asc }) => [asc(c.name)],
        with: {
            organization: true,
        },
    });
};
