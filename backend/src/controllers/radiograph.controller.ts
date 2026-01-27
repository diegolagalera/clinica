import { Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as radiographService from '../services/radiograph.service.js';
import * as patientService from '../services/patient.service.js';
import { success } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';

/**
 * POST /radiographs/patient/:patientId
 * Upload a new radiograph
 */
export const uploadRadiograph = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const file = req.file;

    if (!file) {
        throw new BadRequestError('No se ha proporcionado ningún archivo');
    }

    // Get patient to determine clinicId
    const patient = await patientService.getPatientById(patientId!, req.tenantContext);
    if (!patient) {
        throw new BadRequestError('Paciente no encontrado');
    }

    const { radiographType, notes } = req.body;

    const result = await radiographService.createRadiograph(
        {
            clinicId: patient.clinicId,
            patientId: patientId!,
            uploadedById: req.user!.userId,
            file: {
                buffer: file.buffer,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            },
            radiographType,
            notes,
        },
        req.tenantContext
    );

    res.status(201).json(success(result));
});

/**
 * GET /radiographs/patient/:patientId
 * Get all radiographs for a patient
 */
export const getPatientRadiographs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;

    const radiographs = await radiographService.getRadiographsByPatient(
        patientId!,
        req.tenantContext
    );

    res.json(success(radiographs));
});

/**
 * GET /radiographs/:id
 * Get radiograph by ID
 */
export const getRadiograph = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const radiograph = await radiographService.getRadiographById(id!, req.tenantContext);

    if (!radiograph) {
        throw new BadRequestError('Radiografía no encontrada');
    }

    res.json(success(radiograph));
});

/**
 * GET /radiographs/:id/image
 * Get radiograph image file
 */
export const getRadiographImage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const fileInfo = await radiographService.getRadiographFilePath(id!, req.tenantContext);

    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileInfo.filename}"`);
    res.sendFile(fileInfo.path);
});

/**
 * POST /radiographs/:id/retry-analysis
 * Retry AI analysis for a radiograph
 */
export const retryAnalysis = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const result = await radiographService.retryAiAnalysis(id!, req.tenantContext);

    res.json(success(result));
});

/**
 * PUT /radiographs/:id/notes
 * Update worker notes for a radiograph
 */
export const updateNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { notes, annotations } = req.body;

    const updated = await radiographService.updateRadiographNotes(
        id!,
        { notes, annotations },
        req.tenantContext
    );

    res.json(success(updated));
});

/**
 * DELETE /radiographs/:id
 * Delete a radiograph
 */
export const deleteRadiograph = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await radiographService.deleteRadiograph(id!, req.tenantContext);

    res.json(success({ deleted: true }));
});
