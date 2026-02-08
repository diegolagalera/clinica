import type { Response } from 'express';
/**
 * GET /clinical-records
 * List clinical records for clinic
 */
export declare const listRecords: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /clinical-records/patient/:patientId
 * List clinical records for a specific patient
 */
export declare const listPatientRecords: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /clinical-records/types
 * Get available record types
 */
export declare const getRecordTypes: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /clinical-records/:id
 * Get clinical record by ID
 */
export declare const getRecord: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /clinical-records
 * Create a new clinical record
 */
export declare const createRecord: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /clinical-records/:id
 * Update a clinical record
 */
export declare const updateRecord: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /clinical-records/:id/sign
 * Sign a clinical record (makes it immutable)
 */
export declare const signRecord: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /clinical-records/:id
 * Delete a clinical record (only if not signed)
 */
export declare const deleteRecord: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /clinical-records/transcribe-audio
 * Transcribe audio and extract clinical record fields using AI
 */
export declare const transcribeAudio: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=clinical-record.controller.d.ts.map