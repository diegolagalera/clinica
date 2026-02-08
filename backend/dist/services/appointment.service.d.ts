import { appointments } from '../db/schema.js';
import type { PaginationParams, ServiceResult, TenantContext } from '../types/index.js';
import { AppointmentType, AppointmentStatus } from '../types/enums.js';
export interface CreateAppointmentInput {
    clinicId: string;
    patientId: string;
    workerId?: string | undefined;
    workerIds?: string[] | undefined;
    type: AppointmentType;
    title?: string | undefined;
    description?: string | undefined;
    startTime: Date;
    endTime: Date;
    notes?: string | undefined;
    createdById: string;
}
export interface UpdateAppointmentInput {
    patientId?: string | undefined;
    workerId?: string | undefined;
    workerIds?: string[] | undefined;
    type?: AppointmentType | undefined;
    status?: AppointmentStatus | undefined;
    title?: string | undefined;
    description?: string | undefined;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
    notes?: string | undefined;
}
export type AppointmentType_ = typeof appointments.$inferSelect;
/**
 * Get appointments for a date range
 * If workerIds provided, returns appointments where ANY of the workers are assigned
 */
export declare const getAppointments: (clinicId: string, startDate: Date, endDate: Date, workerId?: string, workerIds?: string[]) => Promise<AppointmentType_[]>;
/**
 * Get appointments for today
 */
export declare const getTodayAppointments: (clinicId: string, workerId?: string) => Promise<{
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
}[]>;
/**
 * Get upcoming appointments for a patient
 */
export declare const getPatientAppointments: (patientId: string, tenantContext: TenantContext, params: PaginationParams) => Promise<{
    data: AppointmentType_[];
    total: number;
}>;
/**
 * Get appointment by ID
 */
export declare const getAppointmentById: (id: string, tenantContext: TenantContext) => Promise<AppointmentType_ | null>;
/**
 * Check for scheduling conflicts
 */
export declare const checkConflicts: (workerId: string, startTime: Date, endTime: Date, excludeAppointmentId?: string) => Promise<boolean>;
/**
 * Create a new appointment
 */
export declare const createAppointment: (input: CreateAppointmentInput) => Promise<ServiceResult<AppointmentType_>>;
/**
 * Update an appointment
 */
export declare const updateAppointment: (id: string, input: UpdateAppointmentInput, tenantContext: TenantContext) => Promise<ServiceResult<AppointmentType_>>;
/**
 * Cancel an appointment
 */
export declare const cancelAppointment: (id: string, tenantContext: TenantContext) => Promise<boolean>;
/**
 * Get worker schedule summary
 */
export declare const getWorkerSchedule: (workerId: string, clinicId: string, date: Date) => Promise<{
    date: string | undefined;
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
        patient: {
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
        };
    }[];
    totalAppointments: number;
}>;
/**
 * Get all active (IN_PROGRESS) appointments for a user
 * Returns appointments where the user is one of the assigned workers
 */
export declare const getActiveAppointments: (clinicId: string, userId: string) => Promise<AppointmentType_[]>;
/**
 * Start an appointment (transition to IN_PROGRESS)
 */
export declare const startAppointment: (id: string, startedById: string, tenantContext: TenantContext) => Promise<AppointmentType_>;
/**
 * Pause an active appointment
 * Note: pausedDuration tracks cumulative paused time in minutes
 */
export declare const pauseAppointment: (id: string, tenantContext: TenantContext) => Promise<AppointmentType_>;
/**
 * Resume a paused appointment
 */
export declare const resumeAppointment: (id: string, tenantContext: TenantContext) => Promise<AppointmentType_>;
/**
 * Complete an active appointment
 */
export declare const completeAppointment: (id: string, tenantContext: TenantContext) => Promise<AppointmentType_>;
//# sourceMappingURL=appointment.service.d.ts.map