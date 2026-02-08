import { ratingRequests } from '../db/schema.js';
/**
 * Create a rating request when an appointment is marked as COMPLETED
 */
export declare const createRatingRequest: (appointmentId: string, clinicId: string, patientId: string) => Promise<{
    success: boolean;
    requestId?: string;
    skipped?: boolean;
    error?: string;
}>;
/**
 * Validate a rating token and return the request data
 */
export declare const validateToken: (token: string) => Promise<{
    valid: boolean;
    status?: "pending" | "valid" | "completed" | "expired" | "not_found";
    request?: typeof ratingRequests.$inferSelect;
    clinicName?: string;
}>;
/**
 * Submit a rating for a visit
 */
export declare const submitRating: (token: string, rating: number, comment?: string) => Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Get pending rating requests that are ready to be sent
 */
export declare const getPendingRequests: () => Promise<(typeof ratingRequests.$inferSelect)[]>;
/**
 * Mark a request as sent
 */
export declare const markRequestAsSent: (requestId: string) => Promise<void>;
/**
 * Mark expired requests
 */
export declare const markExpiredRequests: () => Promise<number>;
/**
 * Get rating statistics for a clinic
 */
export declare const getClinicRatingStats: (clinicId: string) => Promise<{
    totalRatings: number;
    averageRating: number;
    distribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
    };
}>;
/**
 * Get rating statistics for a specific worker
 */
export declare const getWorkerRatingStats: (workerId: string, clinicId?: string) => Promise<{
    totalRatings: number;
    averageRating: number;
    distribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
    };
}>;
/**
 * Get recent ratings for a clinic with comments
 */
export declare const getRecentRatings: (clinicId: string, limit?: number) => Promise<{
    id: string;
    createdAt: Date;
    clinicId: string;
    patientId: string | null;
    appointmentId: string;
    ratingRequestId: string;
    rating: number;
    comment: string | null;
    appointment: {
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
    };
}[]>;
/**
 * Get all rating requests for a clinic
 */
export declare const getClinicRatingRequests: (clinicId: string) => Promise<{
    status: "COMPLETED" | "PENDING" | "EXPIRED" | "SENT" | "SKIPPED";
    id: string;
    createdAt: Date;
    clinicId: string;
    patientId: string;
    appointmentId: string;
    token: string;
    expiresAt: Date;
    sentAt: Date | null;
    scheduledFor: Date;
    completedAt: Date | null;
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
    appointment: {
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
    };
}[]>;
/**
 * Send a rating request email immediately (for testing)
 * Creates the request if it doesn't exist, or uses existing one
 */
export declare const sendRatingEmailNow: (appointmentId: string, clinicId: string) => Promise<{
    success: boolean;
    error?: string;
    ratingUrl?: string;
    token?: string;
}>;
//# sourceMappingURL=rating.service.d.ts.map