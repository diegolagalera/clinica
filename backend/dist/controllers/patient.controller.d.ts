import type { Response } from 'express';
import { z } from 'zod';
export declare const createPatientSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    dateOfBirth: z.ZodOptional<z.ZodEffects<z.ZodString, Date, string>>;
    gender: z.ZodOptional<z.ZodString>;
    idNumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    emergencyContact: z.ZodOptional<z.ZodString>;
    emergencyPhone: z.ZodOptional<z.ZodString>;
    allergies: z.ZodOptional<z.ZodString>;
    medicalHistory: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    insuranceProvider: z.ZodOptional<z.ZodString>;
    insuranceNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    lastName: string;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    postalCode?: string | undefined;
    dateOfBirth?: Date | undefined;
    gender?: string | undefined;
    idNumber?: string | undefined;
    emergencyContact?: string | undefined;
    emergencyPhone?: string | undefined;
    allergies?: string | undefined;
    medicalHistory?: string | undefined;
    notes?: string | undefined;
    insuranceProvider?: string | undefined;
    insuranceNumber?: string | undefined;
}, {
    firstName: string;
    lastName: string;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    postalCode?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: string | undefined;
    idNumber?: string | undefined;
    emergencyContact?: string | undefined;
    emergencyPhone?: string | undefined;
    allergies?: string | undefined;
    medicalHistory?: string | undefined;
    notes?: string | undefined;
    insuranceProvider?: string | undefined;
    insuranceNumber?: string | undefined;
}>;
export declare const updatePatientSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    dateOfBirth: z.ZodOptional<z.ZodOptional<z.ZodEffects<z.ZodString, Date, string>>>;
    gender: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    idNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    city: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    postalCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    emergencyContact: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    emergencyPhone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    allergies: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    medicalHistory: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    insuranceProvider: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    insuranceNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
} & {
    consentGiven: z.ZodOptional<z.ZodBoolean>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    isActive?: boolean | undefined;
    city?: string | undefined;
    postalCode?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    dateOfBirth?: Date | undefined;
    gender?: string | undefined;
    idNumber?: string | undefined;
    emergencyContact?: string | undefined;
    emergencyPhone?: string | undefined;
    allergies?: string | undefined;
    medicalHistory?: string | undefined;
    notes?: string | undefined;
    insuranceProvider?: string | undefined;
    insuranceNumber?: string | undefined;
    consentGiven?: boolean | undefined;
}, {
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    isActive?: boolean | undefined;
    city?: string | undefined;
    postalCode?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: string | undefined;
    idNumber?: string | undefined;
    emergencyContact?: string | undefined;
    emergencyPhone?: string | undefined;
    allergies?: string | undefined;
    medicalHistory?: string | undefined;
    notes?: string | undefined;
    insuranceProvider?: string | undefined;
    insuranceNumber?: string | undefined;
    consentGiven?: boolean | undefined;
}>;
/**
 * GET /patients
 * List patients for current clinic
 */
export declare const listPatients: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /patients/:id
 * Get patient by ID
 */
export declare const getPatient: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /patients/:id/stats
 * Get patient statistics
 */
export declare const getPatientStats: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /patients
 * Create new patient
 */
export declare const createPatient: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /patients/:id
 * Update patient
 */
export declare const updatePatient: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /patients/:id
 * Soft delete patient
 */
export declare const deletePatient: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=patient.controller.d.ts.map