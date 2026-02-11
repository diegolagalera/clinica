import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { radiographs, radiographAiResults, users } from '../db/schema.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { analyzeRadiograph, type RadiographAnalysisResult } from './openai.service.js';
import { logger } from '../utils/logger.js';
import type { TenantContext } from '../types/index.js';
import path from 'path';
import crypto from 'crypto';
import * as storage from './storage.service.js';
import { clinics } from '../db/schema.js';
import { AiUsageService } from './ai-usage.service.js';

// Types
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
    skipAnalysis?: boolean; // If true, don't auto-analyze with AI
}

export interface UpdateRadiographNotesInput {
    notes?: string;
    annotations?: unknown;
}
// Helper to get organizationId from clinicId
const getOrgIdForClinic = async (db: Database, clinicId: string): Promise<string> => {
    const clinic = await db.query.clinics.findFirst({
        where: eq(clinics.id, clinicId),
        columns: { organizationId: true },
    });
    return clinic?.organizationId || 'unknown';
};

/**
 * Upload and create a new radiograph
 */
export const createRadiograph = async (db: Database,
    input: CreateRadiographInput,
    tenantContext: TenantContext
): Promise<{ radiograph: RadiographType; aiResult: RadiographAiResultType | null }> => {
    // Validate file type
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(input.file.mimetype)) {
        throw new BadRequestError('Solo se permiten archivos PNG o JPG');
    }

    // Validate tenant access
    if (!tenantContext.clinicIds.includes(input.clinicId)) {
        throw new ForbiddenError('No tiene acceso a esta clínica');
    }

    const orgId = await getOrgIdForClinic(db, input.clinicId);

    // Generate unique filename
    const fileExtension = path.extname(input.file.originalname).toLowerCase();
    const uniqueId = crypto.randomUUID();
    const filename = `${uniqueId}${fileExtension}`;
    const storageKey = storage.buildKey(orgId, input.clinicId, 'radiographs', filename);

    // Upload to MinIO
    await storage.uploadFile(storageKey, input.file.buffer, input.file.mimetype);

    // Create radiograph record
    const [radiograph] = await db
        .insert(radiographs)
        .values({
            clinicId: input.clinicId,
            patientId: input.patientId,
            uploadedById: input.uploadedById,
            filename,
            originalFilename: input.file.originalname,
            mimeType: input.file.mimetype,
            fileSize: input.file.size,
            storageKey,
            radiographType: input.radiographType || 'general',
            notes: input.notes || null,
        })
        .returning();

    let aiResult: RadiographAiResultType | null = null;

    // Only create AI result and start analysis if not skipped
    if (!input.skipAnalysis) {
        const [result] = await db
            .insert(radiographAiResults)
            .values({
                radiographId: radiograph!.id,
                status: 'PENDING',
            })
            .returning();
        aiResult = result!;

        // Start async AI analysis
        processAiAnalysis(db, radiograph!.id, input.file.buffer, input.file.mimetype, input.clinicId).catch((err) => {
            logger.error('Background AI analysis failed:', err);
        });
    }

    return { radiograph: radiograph!, aiResult: aiResult };
};

/**
 * Process AI analysis asynchronously
 */
const processAiAnalysis = async (
    db: Database,
    radiographId: string,
    fileBuffer: Buffer,
    mimeType: string,
    clinicId?: string
): Promise<void> => {
    const startTime = Date.now();

    try {
        // Update status to PROCESSING
        await db
            .update(radiographAiResults)
            .set({ status: 'PROCESSING', updatedAt: new Date() })
            .where(eq(radiographAiResults.radiographId, radiographId));

        // Convert to base64
        const base64Image = fileBuffer.toString('base64');

        // Call OpenAI
        const result = await analyzeRadiograph(db, base64Image, mimeType, clinicId);

        const processingTime = Date.now() - startTime;

        // Update with results
        await db
            .update(radiographAiResults)
            .set({
                status: 'COMPLETED',
                summary: result.summary,
                suspiciousAreas: result.suspiciousAreas,
                confidence: String(result.confidence),
                rawResponse: result.rawResponse,
                modelVersion: 'gpt-4o',
                processingTimeMs: processingTime,
                updatedAt: new Date(),
            })
            .where(eq(radiographAiResults.radiographId, radiographId));

        logger.info(`AI analysis completed for radiograph ${radiographId} in ${processingTime}ms`);
    } catch (error: any) {
        const processingTime = Date.now() - startTime;

        // Update with error
        await db
            .update(radiographAiResults)
            .set({
                status: 'FAILED',
                errorMessage: error.message || 'Error desconocido durante el análisis',
                processingTimeMs: processingTime,
                updatedAt: new Date(),
            })
            .where(eq(radiographAiResults.radiographId, radiographId));

        logger.error(`AI analysis failed for radiograph ${radiographId}:`, error);
    }
};

/**
 * Get radiographs for a patient
 */
export const getRadiographsByPatient = async (db: Database,
    patientId: string,
    tenantContext: TenantContext
): Promise<(RadiographType & { aiResult: RadiographAiResultType | null; uploadedBy: { firstName: string; lastName: string } | null })[]> => {
    const results = await db.query.radiographs.findMany({
        where: eq(radiographs.patientId, patientId),
        orderBy: [desc(radiographs.createdAt)],
        with: {
            uploadedBy: {
                columns: {
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });

    // Validate tenant access for the first result (all belong to same clinic)
    if (results.length > 0 && !tenantContext.clinicIds.includes(results[0]!.clinicId)) {
        throw new ForbiddenError('No tiene acceso a este paciente');
    }

    // Fetch AI results for all radiographs
    const radiographIds = results.map(r => r.id);
    const aiResults = radiographIds.length > 0
        ? await db.query.radiographAiResults.findMany({
            where: sql`${radiographAiResults.radiographId} IN (${sql.join(radiographIds.map(id => sql`${id}`), sql`, `)})`,
        })
        : [];

    // Map AI results to radiographs
    const aiResultMap = new Map(aiResults.map(r => [r.radiographId, r]));

    return results.map(r => ({
        ...r,
        aiResult: aiResultMap.get(r.id) || null,
    }));
};

/**
 * Get radiograph by ID with AI result
 */
export const getRadiographById = async (db: Database,
    id: string,
    tenantContext: TenantContext
): Promise<RadiographType & { aiResult: RadiographAiResultType | null } | null> => {
    const radiograph = await db.query.radiographs.findFirst({
        where: eq(radiographs.id, id),
    });

    if (!radiograph) {
        return null;
    }

    // Validate tenant access
    if (!tenantContext.clinicIds.includes(radiograph.clinicId)) {
        throw new ForbiddenError('No tiene acceso a esta radiografía');
    }

    const aiResult = await db.query.radiographAiResults.findFirst({
        where: eq(radiographAiResults.radiographId, id),
    });

    return { ...radiograph, aiResult: aiResult || null };
};

/**
 * Start or retry AI analysis for a radiograph
 * If no AI result exists (skipAnalysis was true on upload), creates one
 * If AI result exists and is not processing, retries the analysis
 */
export const retryAiAnalysis = async (db: Database,
    radiographId: string,
    tenantContext: TenantContext
): Promise<RadiographAiResultType> => {
    const radiograph = await getRadiographById(db, radiographId, tenantContext);
    if (!radiograph) {
        throw new NotFoundError('Radiografía no encontrada');
    }

    // Enforce AI quota — return specific error immediately
    await AiUsageService.enforceQuota(db, radiograph.clinicId);

    let aiResult = radiograph.aiResult;

    // If no AI result exists, create one (for radiographs uploaded with skipAnalysis=true)
    if (!aiResult) {
        const [newResult] = await db
            .insert(radiographAiResults)
            .values({
                radiographId: radiograph.id,
                status: 'PENDING',
            })
            .returning();
        aiResult = newResult!;
    } else {
        // AI result exists - check if we can retry
        if (aiResult.status === 'PROCESSING') {
            throw new BadRequestError('El análisis ya está en proceso');
        }

        // Reset to PENDING
        const [updatedResult] = await db
            .update(radiographAiResults)
            .set({
                status: 'PENDING',
                errorMessage: null,
                updatedAt: new Date(),
            })
            .where(eq(radiographAiResults.radiographId, radiographId))
            .returning();
        aiResult = updatedResult!;
    }

    // Read file from MinIO and start analysis
    const fileBuffer = await storage.getFileBuffer(radiograph.storageKey);
    processAiAnalysis(db, radiographId, fileBuffer, radiograph.mimeType, radiograph.clinicId).catch((err) => {
        logger.error('AI analysis failed:', err);
    });

    return aiResult;
};

/**
 * Update worker notes for a radiograph
 */
export const updateRadiographNotes = async (db: Database,
    id: string,
    input: UpdateRadiographNotesInput,
    tenantContext: TenantContext
): Promise<RadiographType> => {
    const existing = await getRadiographById(db, id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Radiografía no encontrada');
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.notes !== undefined) updateData['notes'] = input.notes;
    if (input.annotations !== undefined) updateData['annotations'] = input.annotations;

    const [updated] = await db
        .update(radiographs)
        .set(updateData)
        .where(eq(radiographs.id, id))
        .returning();

    return updated!;
};

/**
 * Delete a radiograph
 */
export const deleteRadiograph = async (db: Database,
    id: string,
    tenantContext: TenantContext
): Promise<boolean> => {
    const existing = await getRadiographById(db, id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Radiografía no encontrada');
    }

    // Delete file from MinIO
    await storage.deleteFile(existing.storageKey);

    // Delete from database (cascade will delete AI result)
    await db.delete(radiographs).where(eq(radiographs.id, id));

    return true;
};

/**
 * Get file path for serving radiograph image
 */
export const getRadiographFilePath = async (db: Database,
    id: string,
    tenantContext: TenantContext
): Promise<{ path: string; mimeType: string; filename: string }> => {
    const radiograph = await getRadiographById(db, id, tenantContext);
    if (!radiograph) {
        throw new NotFoundError('Radiografía no encontrada');
    }

    return {
        path: radiograph.storageKey,
        mimeType: radiograph.mimeType,
        filename: radiograph.originalFilename,
    };
};
