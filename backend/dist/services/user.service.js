"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableClinics = exports.deactivateUser = exports.deleteUser = exports.resetUserPassword = exports.updateUser = exports.createUser = exports.getUserById = exports.getUsersByOrganization = exports.getAllUsers = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const errors_js_1 = require("../utils/errors.js");
const bcrypt_1 = __importDefault(require("bcrypt"));
const SALT_ROUNDS = 12;
/**
 * Get all users with pagination (SUPERADMIN only)
 */
const getAllUsers = async (params, filters) => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    const conditions = [];
    if (filters?.role) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.users.role, filters.role));
    }
    if (filters?.organizationId) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.users.organizationId, filters.organizationId));
    }
    if (filters?.search) {
        conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_js_1.users.email, `%${filters.search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.users.firstName, `%${filters.search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.users.lastName, `%${filters.search}%`)));
    }
    const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
    const [data, countResult] = await Promise.all([
        index_js_1.db.query.users.findMany({
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
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.users)
            .where(whereClause),
    ]);
    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};
exports.getAllUsers = getAllUsers;
/**
 * Get users by organization
 */
const getUsersByOrganization = async (organizationId, params, filters) => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    const conditions = [(0, drizzle_orm_1.eq)(schema_js_1.users.organizationId, organizationId)];
    if (filters?.role) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.users.role, filters.role));
    }
    else if (filters?.staffOnly) {
        // Only include ADMIN and WORKER roles (staff), not patients (USER)
        conditions.push((0, drizzle_orm_1.inArray)(schema_js_1.users.role, ['ADMIN', 'WORKER']));
    }
    if (filters?.search) {
        conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_js_1.users.email, `%${filters.search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.users.firstName, `%${filters.search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.users.lastName, `%${filters.search}%`)));
    }
    const whereClause = (0, drizzle_orm_1.and)(...conditions);
    const [data, countResult] = await Promise.all([
        index_js_1.db.query.users.findMany({
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
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.users)
            .where(whereClause),
    ]);
    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};
exports.getUsersByOrganization = getUsersByOrganization;
/**
 * Get user by ID
 */
const getUserById = async (id) => {
    const user = await index_js_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, id),
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
exports.getUserById = getUserById;
/**
 * Create a new user
 */
const createUser = async (input) => {
    // Check if email already exists
    const existing = await index_js_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.users.email, input.email.toLowerCase()),
    });
    if (existing) {
        throw new errors_js_1.ConflictError('Email already in use');
    }
    // Validate organization/clinic assignment
    if (input.role !== 'SUPERADMIN' && !input.organizationId) {
        throw new errors_js_1.BadRequestError('Organization is required for non-superadmin users');
    }
    // Determine clinic IDs - use clinicIds array or single clinicId
    const allClinicIds = input.clinicIds && input.clinicIds.length > 0
        ? input.clinicIds
        : (input.clinicId ? [input.clinicId] : []);
    // For workers and users, at least one clinic is required
    if ((input.role === 'WORKER' || input.role === 'USER') && allClinicIds.length === 0) {
        throw new errors_js_1.BadRequestError('At least one clinic is required for workers and patients');
    }
    // Use first clinic as the primary clinicId
    const primaryClinicId = allClinicIds.length > 0 ? allClinicIds[0] : undefined;
    // Hash password
    const passwordHash = await bcrypt_1.default.hash(input.password, SALT_ROUNDS);
    // Create user
    const [user] = await index_js_1.db
        .insert(schema_js_1.users)
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
        await index_js_1.db.insert(schema_js_1.staffProfiles).values({
            userId: user.id,
            licenseNumber: input.licenseNumber ?? null,
            specialty: input.specialty ?? null,
        });
    }
    // Create workerClinics entries for all clinics (for WORKER role)
    if (input.role === 'WORKER' && allClinicIds.length > 0) {
        for (const clinicId of allClinicIds) {
            await index_js_1.db.insert(schema_js_1.workerClinics).values({
                userId: user.id,
                clinicId: clinicId,
                isActive: true,
            });
        }
    }
    return { success: true, data: user };
};
exports.createUser = createUser;
/**
 * Update a user
 */
const updateUser = async (id, input) => {
    const existing = await (0, exports.getUserById)(id);
    if (!existing) {
        throw new errors_js_1.NotFoundError('User not found');
    }
    // Determine clinic IDs if provided
    const allClinicIds = input.clinicIds && input.clinicIds.length > 0
        ? input.clinicIds
        : (input.clinicId !== undefined ? (input.clinicId ? [input.clinicId] : []) : undefined);
    // Use first clinic as primary if we have clinic IDs
    const primaryClinicId = allClinicIds && allClinicIds.length > 0 ? allClinicIds[0] : input.clinicId;
    // Build update object, only including defined values
    const updateData = {
        updatedAt: new Date(),
    };
    if (input.firstName !== undefined)
        updateData.firstName = input.firstName;
    if (input.lastName !== undefined)
        updateData.lastName = input.lastName;
    if (input.phone !== undefined)
        updateData.phone = input.phone ?? null;
    if (input.role !== undefined)
        updateData.role = input.role;
    if (input.organizationId !== undefined)
        updateData.organizationId = input.organizationId ?? null;
    if (primaryClinicId !== undefined)
        updateData.clinicId = primaryClinicId ?? null;
    if (input.isActive !== undefined)
        updateData.isActive = input.isActive;
    // Update user
    const [updated] = await index_js_1.db
        .update(schema_js_1.users)
        .set(updateData)
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id))
        .returning();
    // Update or create staff profile if worker
    if (input.role === 'WORKER' || existing.role === 'WORKER') {
        if (existing.staffProfile) {
            const profileData = { updatedAt: new Date() };
            if (input.licenseNumber !== undefined)
                profileData.licenseNumber = input.licenseNumber ?? null;
            if (input.specialty !== undefined)
                profileData.specialty = input.specialty ?? null;
            if (input.bio !== undefined)
                profileData.bio = input.bio ?? null;
            await index_js_1.db
                .update(schema_js_1.staffProfiles)
                .set(profileData)
                .where((0, drizzle_orm_1.eq)(schema_js_1.staffProfiles.userId, id));
        }
        else if (input.licenseNumber || input.specialty) {
            await index_js_1.db.insert(schema_js_1.staffProfiles).values({
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
        await index_js_1.db.delete(schema_js_1.workerClinics).where((0, drizzle_orm_1.eq)(schema_js_1.workerClinics.userId, id));
        // Create new clinic assignments
        for (const clinicId of allClinicIds) {
            await index_js_1.db.insert(schema_js_1.workerClinics).values({
                userId: id,
                clinicId: clinicId,
                isActive: true,
            });
        }
    }
    return { success: true, data: await (0, exports.getUserById)(id) };
};
exports.updateUser = updateUser;
/**
 * Reset user password
 */
const resetUserPassword = async (id, newPassword) => {
    const existing = await (0, exports.getUserById)(id);
    if (!existing) {
        throw new errors_js_1.NotFoundError('User not found');
    }
    const passwordHash = await bcrypt_1.default.hash(newPassword, SALT_ROUNDS);
    await index_js_1.db
        .update(schema_js_1.users)
        .set({ passwordHash, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id));
    return true;
};
exports.resetUserPassword = resetUserPassword;
/**
 * Delete a user
 */
const deleteUser = async (id) => {
    const existing = await (0, exports.getUserById)(id);
    if (!existing) {
        throw new errors_js_1.NotFoundError('User not found');
    }
    await index_js_1.db.delete(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id));
    return true;
};
exports.deleteUser = deleteUser;
/**
 * Deactivate a user
 */
const deactivateUser = async (id) => {
    const existing = await (0, exports.getUserById)(id);
    if (!existing) {
        throw new errors_js_1.NotFoundError('User not found');
    }
    await index_js_1.db
        .update(schema_js_1.users)
        .set({ isActive: false, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id));
    return true;
};
exports.deactivateUser = deactivateUser;
/**
 * Get available clinics for user assignment
 */
const getAvailableClinics = async (organizationId) => {
    if (organizationId) {
        return index_js_1.db.query.clinics.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.clinics.organizationId, organizationId), (0, drizzle_orm_1.eq)(schema_js_1.clinics.isActive, true)),
            orderBy: (c, { asc }) => [asc(c.name)],
        });
    }
    return index_js_1.db.query.clinics.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.clinics.isActive, true),
        orderBy: (c, { asc }) => [asc(c.name)],
        with: {
            organization: true,
        },
    });
};
exports.getAvailableClinics = getAvailableClinics;
//# sourceMappingURL=user.service.js.map