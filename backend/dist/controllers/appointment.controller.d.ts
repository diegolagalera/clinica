import type { Response } from 'express';
import { z } from 'zod';
import { AppointmentType, AppointmentStatus } from '../types/enums.js';
export declare const createAppointmentSchema: z.ZodObject<{
    patientId: z.ZodString;
    workerId: z.ZodOptional<z.ZodString>;
    workerIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    type: z.ZodNativeEnum<typeof AppointmentType>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    startTime: z.ZodEffects<z.ZodString, Date, string>;
    endTime: z.ZodEffects<z.ZodString, Date, string>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: AppointmentType;
    patientId: string;
    startTime: Date;
    endTime: Date;
    notes?: string | undefined;
    workerId?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    workerIds?: string[] | undefined;
}, {
    type: AppointmentType;
    patientId: string;
    startTime: string;
    endTime: string;
    notes?: string | undefined;
    workerId?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    workerIds?: string[] | undefined;
}>;
export declare const updateAppointmentSchema: z.ZodObject<{
    patientId: z.ZodOptional<z.ZodString>;
    workerId: z.ZodOptional<z.ZodString>;
    workerIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    type: z.ZodOptional<z.ZodNativeEnum<typeof AppointmentType>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof AppointmentStatus>>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    startTime: z.ZodOptional<z.ZodEffects<z.ZodString, Date, string>>;
    endTime: z.ZodOptional<z.ZodEffects<z.ZodString, Date, string>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type?: AppointmentType | undefined;
    status?: AppointmentStatus | undefined;
    notes?: string | undefined;
    patientId?: string | undefined;
    workerId?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
    workerIds?: string[] | undefined;
}, {
    type?: AppointmentType | undefined;
    status?: AppointmentStatus | undefined;
    notes?: string | undefined;
    patientId?: string | undefined;
    workerId?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    startTime?: string | undefined;
    endTime?: string | undefined;
    workerIds?: string[] | undefined;
}>;
/**
 * GET /appointments
 * List appointments for date range
 */
export declare const listAppointments: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /appointments/today
 * Get today's appointments
 */
export declare const getTodayAppointments: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /appointments/patient/:patientId
 * Get appointments for a specific patient
 */
export declare const getPatientAppointments: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /appointments/:id
 * Get appointment by ID
 */
export declare const getAppointment: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /appointments
 * Create new appointment
 */
export declare const createAppointment: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /appointments/:id
 * Update appointment
 */
export declare const updateAppointment: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /appointments/:id
 * Cancel appointment
 */
export declare const cancelAppointment: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /appointments/worker/:workerId/schedule
 * Get worker's schedule for a specific date
 */
export declare const getWorkerSchedule: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /appointments/active
 * Get all active (IN_PROGRESS) appointments for the current user
 */
export declare const getActiveAppointments: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /appointments/:id/start
 * Start an appointment (set status to IN_PROGRESS)
 */
export declare const startAppointment: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /appointments/:id/pause
 * Pause an active appointment
 */
export declare const pauseAppointment: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /appointments/:id/resume
 * Resume a paused appointment
 */
export declare const resumeAppointment: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /appointments/:id/complete
 * Complete an active appointment (validates stock requirement)
 */
export declare const completeAppointment: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=appointment.controller.d.ts.map