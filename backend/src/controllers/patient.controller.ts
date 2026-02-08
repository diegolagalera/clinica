import type { Response } from 'express';
import { z } from 'zod';
import * as patientService from '../services/patient.service.js';
import { success, paginated, parsePaginationParams } from '../utils/response.js';
import { asyncHandler, requireClinicContext } from '../middleware/index.js';
import { BadRequestError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Validation schemas
export const createPatientSchema = z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    dateOfBirth: z.string().transform(s => new Date(s)).optional(),
    gender: z.string().max(20).optional(),
    idNumber: z.string().max(50).optional(),
    address: z.string().optional(),
    city: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    emergencyContact: z.string().max(255).optional(),
    emergencyPhone: z.string().max(50).optional(),
    allergies: z.string().optional(),
    medicalHistory: z.string().optional(),
    notes: z.string().optional(),
    insuranceProvider: z.string().max(100).optional(),
    insuranceNumber: z.string().max(100).optional(),
});

export const updatePatientSchema = createPatientSchema.partial().extend({
    consentGiven: z.boolean().optional(),
    isActive: z.boolean().optional(),
    acceptsMarketing: z.boolean().optional(),
});

/**
 * GET /patients
 * List patients for current clinic
 * Query params: search, isActive (optional - true/false)
 */
export const listPatients = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const params = parsePaginationParams(req.query);
    const search = req.query['search'] as string | undefined;
    const isActiveParam = req.query['isActive'] as string | undefined;

    // Parse isActive: 'true' -> true, 'false' -> false, undefined -> undefined (all)
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

    const { data, total } = await patientService.getPatients(
        req.tenantContext.clinicId,
        params,
        search,
        isActive
    );

    res.json(success(paginated(data, total, params)));
});

/**
 * GET /patients/:id
 * Get patient by ID
 */
export const getPatient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const patient = await patientService.getPatientWithDetails(id!, req.tenantContext);

    res.json(success(patient));
});

/**
 * GET /patients/:id/stats
 * Get patient statistics
 */
export const getPatientStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const stats = await patientService.getPatientStats(id!, req.tenantContext);

    res.json(success(stats));
});

/**
 * POST /patients
 * Create new patient
 */
export const createPatient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = createPatientSchema.parse(req.body);

    const result = await patientService.createPatient({
        ...input,
        clinicId: req.tenantContext.clinicId,
    });

    if (result.success) {
        res.status(201).json(success(result.data, 'Patient created successfully'));
    }
});

/**
 * PUT /patients/:id
 * Update patient
 */
export const updatePatient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = updatePatientSchema.parse(req.body);

    const result = await patientService.updatePatient(id!, input, req.tenantContext);

    if (result.success) {
        res.json(success(result.data, 'Patient updated successfully'));
    }
});

/**
 * DELETE /patients/:id
 * Soft delete patient
 */
export const deletePatient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await patientService.deletePatient(id!, req.tenantContext);

    res.json(success(null, 'Patient deleted successfully'));
});
