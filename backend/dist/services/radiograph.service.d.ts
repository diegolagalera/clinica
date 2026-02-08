import { radiographs, radiographAiResults } from '../db/schema.js';
import type { TenantContext } from '../types/index.js';
export type RadiographType = typeof radiographs.$inferSelect;
export type RadiographAiResultType = typeof radiographAiResults.$inferSelect;
export interface CreateRadiographInput {
    clinicId: string;
    patientId: string;
    uploadedById: string;
    file: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
    };
    radiographType?: string;
    notes?: string;
}
export interface UpdateRadiographNotesInput {
    notes?: string;
    annotations?: unknown;
}
/**
 * Upload and create a new radiograph
 */
export declare const createRadiograph: (input: CreateRadiographInput, tenantContext: TenantContext) => Promise<{
    radiograph: RadiographType;
    aiResult: RadiographAiResultType;
}>;
/**
 * Get radiographs for a patient
 */
export declare const getRadiographsByPatient: (patientId: string, tenantContext: TenantContext) => Promise<(RadiographType & {
    aiResult: RadiographAiResultType | null;
    uploadedBy: {
        firstName: string;
        lastName: string;
    } | null;
})[]>;
/**
 * Get radiograph by ID with AI result
 */
export declare const getRadiographById: (id: string, tenantContext: TenantContext) => Promise<(RadiographType & {
    aiResult: RadiographAiResultType | null;
}) | null>;
/**
 * Retry AI analysis for a failed radiograph
 */
export declare const retryAiAnalysis: (radiographId: string, tenantContext: TenantContext) => Promise<RadiographAiResultType>;
/**
 * Update worker notes for a radiograph
 */
export declare const updateRadiographNotes: (id: string, input: UpdateRadiographNotesInput, tenantContext: TenantContext) => Promise<RadiographType>;
/**
 * Delete a radiograph
 */
export declare const deleteRadiograph: (id: string, tenantContext: TenantContext) => Promise<boolean>;
/**
 * Get file path for serving radiograph image
 */
export declare const getRadiographFilePath: (id: string, tenantContext: TenantContext) => Promise<{
    path: string;
    mimeType: string;
    filename: string;
}>;
//# sourceMappingURL=radiograph.service.d.ts.map