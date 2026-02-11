import { Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as odontogramService from '../services/odontogram.service.js';
import * as patientService from '../services/patient.service.js';
import { success } from '../utils/response.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

/**
 * GET /odontogram/patient/:patientId
 * Get or create odontogram for a patient
 */
export const getOdontogram = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const isChild = req.query.isChild === 'true';

    // Get patient to determine clinicId
    const patient = await patientService.getPatientById(patientId!, req.tenantContext);
    if (!patient) {
        throw new NotFoundError('Paciente no encontrado');
    }

    const odontogram = await odontogramService.getOrCreateOdontogram(
        patientId!,
        patient.clinicId,
        isChild,
        req.tenantContext
    );

    res.json(success(odontogram));
});

/**
 * PUT /odontogram/:odontogramId/tooth/:toothNumber
 * Update tooth condition
 */
export const updateTooth = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { odontogramId, toothNumber } = req.params;
    const { condition, surface, isRoot, notes } = req.body;

    if (!condition) {
        throw new BadRequestError('La condición es requerida');
    }

    const updatedTooth = await odontogramService.updateToothCondition(
        odontogramId!,
        parseInt(toothNumber!, 10),
        condition,
        surface || null,
        req.user!.userId,
        notes,
        isRoot || false
    );

    res.json(success(updatedTooth));
});

/**
 * GET /odontogram/:odontogramId/history
 * Get odontogram change history
 */
export const getHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { odontogramId } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const history = await odontogramService.getOdontogramHistory(odontogramId!, limit);

    res.json(success(history));
});

/**
 * GET /odontogram/:odontogramId/tooth/:toothNumber/history
 * Get tooth change history
 */
export const getToothHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { odontogramId, toothNumber } = req.params;

    const history = await odontogramService.getToothHistory(
        odontogramId!,
        parseInt(toothNumber!, 10)
    );

    res.json(success(history));
});

/**
 * PUT /odontogram/:odontogramId/notes
 * Update odontogram general notes
 */
export const updateNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { odontogramId } = req.params;
    const { notes } = req.body;

    await odontogramService.updateOdontogramNotes(
        odontogramId!,
        notes || '',
        req.user!.userId
    );

    res.json(success({ message: 'Notas actualizadas' }));
});

/**
 * PUT /odontogram/:odontogramId/tooth/:toothNumber/notes
 * Update tooth notes
 */
export const updateToothNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { odontogramId, toothNumber } = req.params;
    const { notes } = req.body;

    await odontogramService.updateToothNotes(
        odontogramId!,
        parseInt(toothNumber!, 10),
        notes || ''
    );

    res.json(success({ message: 'Notas del diente actualizadas' }));
});

// ============================================================================
// SNAPSHOTS
// ============================================================================

/**
 * POST /odontogram/:odontogramId/snapshots
 * Create a snapshot of current state
 */
export const createSnapshot = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { odontogramId } = req.params;
    const { name, description } = req.body;

    if (!name) {
        throw new BadRequestError('El nombre del snapshot es requerido');
    }

    const snapshot = await odontogramService.createSnapshot(
        odontogramId!,
        name,
        description || null,
        req.user!.userId
    );

    res.status(201).json(success(snapshot));
});

/**
 * GET /odontogram/:odontogramId/snapshots
 * List all snapshots
 */
export const getSnapshots = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { odontogramId } = req.params;

    const snapshots = await odontogramService.getSnapshots(odontogramId!);

    res.json(success(snapshots));
});

/**
 * GET /odontogram/snapshots/:snapshotId
 * Get a single snapshot
 */
export const getSnapshot = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { snapshotId } = req.params;

    const snapshot = await odontogramService.getSnapshot(snapshotId!);

    if (!snapshot) {
        throw new NotFoundError('Snapshot no encontrado');
    }

    res.json(success(snapshot));
});

/**
 * DELETE /odontogram/snapshots/:snapshotId
 * Delete a snapshot
 */
export const deleteSnapshot = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { snapshotId } = req.params;

    await odontogramService.deleteSnapshot(snapshotId!);

    res.json(success({ message: 'Snapshot eliminado' }));
});
