import { patients } from '../db/schema.js';
import type { PaginationParams, ServiceResult, TenantContext } from '../types/index.js';
export interface CreatePatientInput {
    clinicId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: Date;
    gender?: string;
    idNumber?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
    allergies?: string;
    medicalHistory?: string;
    notes?: string;
    insuranceProvider?: string;
    insuranceNumber?: string;
}
export interface UpdatePatientInput {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: Date;
    gender?: string;
    idNumber?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
    allergies?: string;
    medicalHistory?: string;
    notes?: string;
    insuranceProvider?: string;
    insuranceNumber?: string;
    consentGiven?: boolean;
    isActive?: boolean;
}
export type PatientType = typeof patients.$inferSelect;
/**
 * Get patients for a clinic with pagination and search
 */
export declare const getPatients: (clinicId: string, params: PaginationParams, search?: string) => Promise<{
    data: PatientType[];
    total: number;
}>;
/**
 * Get patient by ID with tenant validation
 */
export declare const getPatientById: (id: string, tenantContext: TenantContext) => Promise<PatientType | null>;
/**
 * Get patient with full details
 */
export declare const getPatientWithDetails: (id: string, tenantContext: TenantContext) => Promise<{
    id: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    city: string | null;
    postalCode: string | null;
    firstName: string;
    lastName: string;
    clinicId: string;
    userId: string | null;
    externalId: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
    idNumber: string | null;
    emergencyContact: string | null;
    emergencyPhone: string | null;
    allergies: string | null;
    medicalHistory: string | null;
    notes: string | null;
    insuranceProvider: string | null;
    insuranceNumber: string | null;
    consentGiven: boolean;
    consentDate: Date | null;
    radiographs: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        clinicId: string;
        notes: string | null;
        patientId: string;
        clinicalRecordId: string | null;
        uploadedById: string;
        filename: string;
        originalFilename: string;
        mimeType: string;
        fileSize: number;
        storageKey: string;
        radiographType: string | null;
        toothNumbers: unknown;
        annotations: unknown;
        metadata: unknown;
    }[];
    appointments: {
        type: "VISIT" | "SURGERY" | "REVIEW" | "EMERGENCY" | "FOLLOWUP";
        status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
        id: string;
        createdAt: Date;
        updatedAt: Date;
        clinicId: string;
        notes: string | null;
        patientId: string;
        workerId: string | null;
        title: string | null;
        description: string | null;
        startTime: Date;
        endTime: Date;
        duration: number;
        realStartTime: Date | null;
        realEndTime: Date | null;
        pausedDuration: number | null;
        startedById: string | null;
        reminderSent: boolean;
        createdById: string | null;
        worker: {
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
        } | null;
        appointmentWorkers: {
            id: string;
            createdAt: Date;
            userId: string;
            appointmentId: string;
            isPrimary: boolean;
            user: {
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
            };
        }[];
    }[];
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
}>;
/**
 * Create a new patient
 */
export declare const createPatient: (input: CreatePatientInput) => Promise<ServiceResult<PatientType>>;
/**
 * Update a patient
 */
export declare const updatePatient: (id: string, input: UpdatePatientInput, tenantContext: TenantContext) => Promise<ServiceResult<PatientType>>;
/**
 * Delete a patient (soft delete by setting isActive to false)
 */
export declare const deletePatient: (id: string, tenantContext: TenantContext) => Promise<boolean>;
/**
 * Get patient statistics
 */
export declare const getPatientStats: (id: string, tenantContext: TenantContext) => Promise<{
    totalAppointments: number;
    totalRecords: number;
    totalRadiographs: number;
}>;
//# sourceMappingURL=patient.service.d.ts.map