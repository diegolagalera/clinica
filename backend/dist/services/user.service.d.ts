import { users } from '../db/schema.js';
import type { PaginationParams, ServiceResult, Role } from '../types/index.js';
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
    licenseNumber?: string;
    specialty?: string;
    bio?: string;
}
export type UserType = typeof users.$inferSelect;
/**
 * Get all users with pagination (SUPERADMIN only)
 */
export declare const getAllUsers: (params: PaginationParams, filters?: {
    role?: Role;
    organizationId?: string;
    search?: string;
}) => Promise<{
    data: any[];
    total: number;
}>;
/**
 * Get users by organization
 */
export declare const getUsersByOrganization: (organizationId: string, params: PaginationParams, filters?: {
    role?: Role;
    search?: string;
    staffOnly?: boolean;
}) => Promise<{
    data: any[];
    total: number;
}>;
/**
 * Get user by ID
 */
export declare const getUserById: (id: string) => Promise<any | null>;
/**
 * Create a new user
 */
export declare const createUser: (input: CreateUserInput) => Promise<ServiceResult<UserType>>;
/**
 * Update a user
 */
export declare const updateUser: (id: string, input: UpdateUserInput) => Promise<ServiceResult<any>>;
/**
 * Reset user password
 */
export declare const resetUserPassword: (id: string, newPassword: string) => Promise<boolean>;
/**
 * Delete a user
 */
export declare const deleteUser: (id: string) => Promise<boolean>;
/**
 * Deactivate a user
 */
export declare const deactivateUser: (id: string) => Promise<boolean>;
/**
 * Get available clinics for user assignment
 */
export declare const getAvailableClinics: (organizationId?: string) => Promise<{
    name: string;
    id: string;
    slug: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    settings: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    timezone: string | null;
    workingHours: unknown;
}[]>;
//# sourceMappingURL=user.service.d.ts.map