import type { Response } from 'express';
import { z } from 'zod';
import * as clinicalRecordService from '../services/clinical-record.service.js';
import { processVoiceRecording } from '../services/voice-transcription.service.js';
import { success, paginated, parsePaginationParams } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Validation schemas
const createRecordSchema = z.object({
    patientId: z.string().uuid(),
    appointmentId: z.string().uuid().optional(),
    recordType: z.string().min(1),
    title: z.string().max(255).optional(),
    content: z.string().optional(),
    vitalSigns: z.record(z.unknown()).optional(),
    procedures: z.array(z.record(z.unknown())).optional(),
    diagnosis: z.string().optional(),
    treatment: z.string().optional(),
    prescriptions: z.array(z.record(z.unknown())).optional(),
    toothChart: z.record(z.unknown()).optional(),
    attachments: z.array(z.record(z.unknown())).optional(),
});

const updateRecordSchema = z.object({
    title: z.string().max(255).optional(),
    content: z.string().optional(),
    vitalSigns: z.record(z.unknown()).optional(),
    procedures: z.array(z.record(z.unknown())).optional(),
    diagnosis: z.string().optional(),
    treatment: z.string().optional(),
    prescriptions: z.array(z.record(z.unknown())).optional(),
    toothChart: z.record(z.unknown()).optional(),
    attachments: z.array(z.record(z.unknown())).optional(),
});

/**
 * GET /clinical-records
 * List clinical records for clinic
 */
export const listRecords = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const params = parsePaginationParams(req.query);
    const recordType = req.query['recordType'] as string | undefined;
    const patientId = req.query['patientId'] as string | undefined;
    const search = req.query['search'] as string | undefined;

    const { data, total } = await clinicalRecordService.getRecordsByClinic(req.db!, clinicId, params, {
        ...(recordType && { recordType }),
        ...(patientId && { patientId }),
        ...(search && { search }),
    });

    res.json(success(paginated(data, total, params)));
});

/**
 * GET /clinical-records/patient/:patientId
 * List clinical records for a specific patient
 */
export const listPatientRecords = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const { patientId } = req.params;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const params = parsePaginationParams(req.query);
    const recordType = req.query['recordType'] as string | undefined;
    const search = req.query['search'] as string | undefined;

    const { data, total } = await clinicalRecordService.getRecordsByPatient(req.db!,
        patientId!,
        clinicId,
        params,
        { ...(recordType && { recordType }), ...(search && { search }) }
    );

    res.json(success(paginated(data, total, params)));
});

/**
 * GET /clinical-records/types
 * Get available record types
 */
export const getRecordTypes = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const types = clinicalRecordService.getRecordTypes();
    res.json(success(types));
});

/**
 * GET /clinical-records/:id
 * Get clinical record by ID
 */
export const getRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const record = await clinicalRecordService.getRecordById(req.db!, id!, clinicId);

    if (!record) {
        res.status(404).json({ success: false, message: 'Record not found' });
        return;
    }

    res.json(success(record));
});

/**
 * POST /clinical-records
 * Create a new clinical record
 */
export const createRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const userId = req.user?.userId;

    if (!clinicId || !userId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const input = createRecordSchema.parse(req.body);

    const result = await clinicalRecordService.createRecord(req.db!, {
        patientId: input.patientId,
        recordType: input.recordType,
        clinicId,
        createdById: userId,
        appointmentId: input.appointmentId,
        title: input.title,
        content: input.content,
        vitalSigns: input.vitalSigns,
        procedures: input.procedures,
        diagnosis: input.diagnosis,
        treatment: input.treatment,
        prescriptions: input.prescriptions,
        toothChart: input.toothChart,
        attachments: input.attachments,
    } as any);

    if (result.success) {
        res.status(201).json(success(result.data, 'Clinical record created'));
    }
});

/**
 * PUT /clinical-records/:id
 * Update a clinical record
 */
export const updateRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const input = updateRecordSchema.parse(req.body);

    const result = await clinicalRecordService.updateRecord(req.db!, id!, clinicId, input as any);

    if (result.success) {
        res.json(success(result.data, 'Clinical record updated'));
    }
});

/**
 * POST /clinical-records/:id/sign
 * Sign a clinical record (makes it immutable)
 */
export const signRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!clinicId || !userId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const result = await clinicalRecordService.signRecord(req.db!, id!, clinicId, userId);

    if (result.success) {
        res.json(success(result.data, 'Clinical record signed'));
    }
});

/**
 * DELETE /clinical-records/:id
 * Delete a clinical record (only if not signed)
 */
export const deleteRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    await clinicalRecordService.deleteRecord(req.db!, id!, clinicId);

    res.json(success(null, 'Clinical record deleted'));
});

/**
 * POST /clinical-records/transcribe-audio
 * Transcribe audio and extract clinical record fields using AI
 */
export const transcribeAudio = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    // Check for uploaded file (multer adds file to req)
    const file = (req as any).file;
    if (!file) {
        res.status(400).json({ success: false, message: 'No audio file provided' });
        return;
    }

    try {
        // Process the audio file
        const result = await processVoiceRecording(req.db!, file.buffer, file.originalname, clinicId);

        res.json(success({
            title: result.title,
            content: result.content,
            diagnosis: result.diagnosis,
            treatment: result.treatment,
            rawTranscription: result.rawTranscription,
        }, 'Audio transcribed and analyzed'));
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error processing audio'
        });
    }
});
