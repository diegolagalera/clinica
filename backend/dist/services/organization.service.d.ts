import { organizations } from '../db/schema.js';
import type { PaginationParams, ServiceResult } from '../types/index.js';
export interface CreateOrganizationInput {
    name: string;
    slug: string;
    email?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
}
export interface UpdateOrganizationInput {
    name?: string;
    slug?: string;
    email?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
    isActive?: boolean;
    settings?: Record<string, unknown>;
}
export type OrganizationType = typeof organizations.$inferSelect;
/**
 * Get all organizations with pagination
 */
export declare const getOrganizations: (params: PaginationParams, search?: string) => Promise<{
    data: OrganizationType[];
    total: number;
}>;
/**
 * Get organization by ID
 */
export declare const getOrganizationById: (id: string) => Promise<OrganizationType | null>;
/**
 * Get organization by slug
 */
export declare const getOrganizationBySlug: (slug: string) => Promise<OrganizationType | null>;
/**
 * Create a new organization
 */
export declare const createOrganization: (input: CreateOrganizationInput) => Promise<ServiceResult<OrganizationType>>;
/**
 * Update an organization
 */
export declare const updateOrganization: (id: string, input: UpdateOrganizationInput) => Promise<ServiceResult<OrganizationType>>;
/**
 * Delete an organization
 */
export declare const deleteOrganization: (id: string) => Promise<boolean>;
/**
 * Get organization statistics
 */
export declare const getOrganizationStats: (id: string) => Promise<{
    organization: {
        name: string;
        id: string;
        slug: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        logoUrl: string | null;
        settings: unknown;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        clinics: {
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
        }[];
        users: {
            role: "SUPERADMIN" | "ADMIN" | "WORKER" | "USER";
            id: string;
            email: string;
            phone: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            organizationId: string | null;
            passwordHash: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
            clinicId: string | null;
            emailVerified: boolean;
            emailVerificationToken: string | null;
            passwordResetToken: string | null;
            passwordResetExpires: Date | null;
            twoFactorEnabled: boolean;
            twoFactorSecret: string | null;
            tokenVersion: number;
            lastLoginAt: Date | null;
        }[];
    };
    clinicsCount: number;
    usersCount: number;
}>;
//# sourceMappingURL=organization.service.d.ts.map