import { clinics } from '../db/schema.js';
import type { PaginationParams, ServiceResult } from '../types/index.js';
export interface CreateClinicInput {
    organizationId: string;
    name: string;
    slug: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    timezone?: string;
}
export interface UpdateClinicInput {
    name?: string;
    slug?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    timezone?: string;
    isActive?: boolean;
    settings?: Record<string, unknown>;
    workingHours?: Record<string, unknown>;
}
export type ClinicType = typeof clinics.$inferSelect;
/**
 * Get clinics by organization with pagination
 */
export declare const getClinicsByOrganization: (organizationId: string, params: PaginationParams, search?: string) => Promise<{
    data: ClinicType[];
    total: number;
}>;
/**
 * Get all clinics (for Super Admin)
 */
export declare const getAllClinics: (params: PaginationParams, search?: string) => Promise<{
    data: ClinicType[];
    total: number;
}>;
/**
 * Get clinic by ID
 */
export declare const getClinicById: (id: string) => Promise<ClinicType | null>;
/**
 * Create a new clinic
 */
export declare const createClinic: (input: CreateClinicInput) => Promise<ServiceResult<ClinicType>>;
/**
 * Update a clinic
 */
export declare const updateClinic: (id: string, input: UpdateClinicInput) => Promise<ServiceResult<ClinicType>>;
/**
 * Delete a clinic
 */
export declare const deleteClinic: (id: string) => Promise<boolean>;
/**
 * Get clinic statistics
 */
export declare const getClinicStats: (clinicId: string) => Promise<{
    clinic: {
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
    };
    patientsCount: number;
    staffCount: number;
    todayAppointments: number;
}>;
//# sourceMappingURL=clinic.service.d.ts.map