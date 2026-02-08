import { Response } from 'express';
/**
 * GET /odontogram/patient/:patientId
 * Get or create odontogram for a patient
 */
export declare const getOdontogram: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /odontogram/:odontogramId/tooth/:toothNumber
 * Update tooth condition
 */
export declare const updateTooth: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /odontogram/:odontogramId/history
 * Get odontogram change history
 */
export declare const getHistory: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /odontogram/:odontogramId/tooth/:toothNumber/history
 * Get tooth change history
 */
export declare const getToothHistory: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /odontogram/:odontogramId/notes
 * Update odontogram general notes
 */
export declare const updateNotes: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /odontogram/:odontogramId/tooth/:toothNumber/notes
 * Update tooth notes
 */
export declare const updateToothNotes: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /odontogram/:odontogramId/snapshots
 * Create a snapshot of current state
 */
export declare const createSnapshot: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /odontogram/:odontogramId/snapshots
 * List all snapshots
 */
export declare const getSnapshots: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /odontogram/snapshots/:snapshotId
 * Get a single snapshot
 */
export declare const getSnapshot: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /odontogram/snapshots/:snapshotId
 * Delete a snapshot
 */
export declare const deleteSnapshot: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=odontogram.controller.d.ts.map