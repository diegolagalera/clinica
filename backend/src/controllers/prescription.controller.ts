import type { Response } from 'express';
import { z } from 'zod';
import * as prescriptionService from '../services/prescription.service.js';
import * as storage from '../services/storage.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const prescriptionItemSchema = z.object({
    medication: z.string().min(1).max(500),
    dosage: z.string().min(1).max(200),
    frequency: z.string().min(1).max(200),
    duration: z.string().min(1).max(200),
    instructions: z.string().max(500).optional().default(''),
});

const createPrescriptionSchema = z.object({
    clinicId: z.string().uuid(),
    patientId: z.string().uuid(),
    items: z.array(prescriptionItemSchema).min(1).max(20),
    diagnosis: z.string().max(1000).optional(),
    notes: z.string().max(2000).optional(),
});

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * POST /prescriptions
 * Create a new prescription and generate PDF
 */
export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = createPrescriptionSchema.parse(req.body);

    const prescription = await prescriptionService.createPrescription(
        req.db!,
        {
            ...data,
            prescribedById: req.user!.userId,
        },
        req.user!.tenantSlug
    );

    res.status(201).json(success(prescription, 'Prescription created'));
});

/**
 * GET /prescriptions/patient/:patientId
 * List prescriptions for a patient
 */
export const listByPatient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const clinicId = req.headers['x-clinic-id'] as string;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic ID header required' });
        return;
    }

    const list = await prescriptionService.getPrescriptionsByPatient(req.db!, patientId!, clinicId);
    res.json(success(list));
});

/**
 * GET /prescriptions/:id
 * Get a single prescription
 */
export const getById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const prescription = await prescriptionService.getPrescriptionById(req.db!, id!);

    if (!prescription) {
        res.status(404).json({ success: false, message: 'Prescription not found' });
        return;
    }

    res.json(success(prescription));
});

/**
 * GET /prescriptions/:id/pdf
 * Download prescription PDF
 */
export const downloadPdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const prescription = await prescriptionService.getPrescriptionById(req.db!, id!);

    if (!prescription || !prescription.pdfStorageKey) {
        res.status(404).json({ success: false, message: 'Prescription PDF not found' });
        return;
    }

    const { stream, contentType, contentLength } = await storage.getFileStream(
        prescription.pdfStorageKey,
        req.user!.tenantSlug
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', contentLength);
    res.setHeader('Content-Disposition', `attachment; filename="receta_${id}.pdf"`);
    stream.pipe(res);
});

/**
 * DELETE /prescriptions/:id
 * Delete a prescription
 */
export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const clinicId = req.headers['x-clinic-id'] as string;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic ID header required' });
        return;
    }

    await prescriptionService.deletePrescription(req.db!, id!, clinicId, req.user!.tenantSlug);
    res.json(success(null, 'Prescription deleted'));
});

/**
 * GET /prescriptions/medications
 * Get clinic's medications catalog (auto-seeds defaults on first call)
 */
export const getMedications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.headers['x-clinic-id'] as string;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic ID header required' });
        return;
    }

    const medications = await prescriptionService.getClinicMedications(req.db!, clinicId);
    res.json(success(medications));
});

/**
 * POST /prescriptions/medications
 * Create a new medication in the clinic catalog
 */
const createMedicationSchema = z.object({
    medication: z.string().min(1).max(255),
    category: z.string().min(1).max(100),
    defaultDosage: z.string().min(1).max(255),
    defaultFrequency: z.string().min(1).max(255),
    defaultDuration: z.string().min(1).max(255),
});

export const createMedication = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.headers['x-clinic-id'] as string;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic ID header required' });
        return;
    }

    const data = createMedicationSchema.parse(req.body);
    const med = await prescriptionService.createMedication(req.db!, { clinicId, ...data });
    res.status(201).json(success(med, 'Medication created'));
});

/**
 * PUT /prescriptions/medications/:id
 * Update a medication
 */
const updateMedicationSchema = z.object({
    medication: z.string().min(1).max(255).optional(),
    category: z.string().min(1).max(100).optional(),
    defaultDosage: z.string().min(1).max(255).optional(),
    defaultFrequency: z.string().min(1).max(255).optional(),
    defaultDuration: z.string().min(1).max(255).optional(),
});

export const updateMedication = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.headers['x-clinic-id'] as string;
    const { id } = req.params;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic ID header required' });
        return;
    }

    const data = updateMedicationSchema.parse(req.body);
    const updated = await prescriptionService.updateMedication(req.db!, id!, clinicId, data);
    if (!updated) {
        res.status(404).json({ success: false, message: 'Medication not found' });
        return;
    }
    res.json(success(updated, 'Medication updated'));
});

/**
 * DELETE /prescriptions/medications/:id
 * Soft-delete a medication
 */
export const removeMedication = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.headers['x-clinic-id'] as string;
    const { id } = req.params;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic ID header required' });
        return;
    }

    await prescriptionService.deleteMedication(req.db!, id!, clinicId);
    res.json(success(null, 'Medication deleted'));
});
