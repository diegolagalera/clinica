import { Response } from 'express';
/**
 * POST /radiographs/patient/:patientId
 * Upload a new radiograph
 */
export declare const uploadRadiograph: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /radiographs/patient/:patientId
 * Get all radiographs for a patient
 */
export declare const getPatientRadiographs: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /radiographs/:id
 * Get radiograph by ID
 */
export declare const getRadiograph: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /radiographs/:id/image
 * Get radiograph image file
 */
export declare const getRadiographImage: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /radiographs/:id/retry-analysis
 * Retry AI analysis for a radiograph
 */
export declare const retryAnalysis: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /radiographs/:id/notes
 * Update worker notes for a radiograph
 */
export declare const updateNotes: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /radiographs/:id
 * Delete a radiograph
 */
export declare const deleteRadiograph: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=radiograph.controller.d.ts.map