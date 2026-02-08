"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRadiographFilePath = exports.deleteRadiograph = exports.updateRadiographNotes = exports.retryAiAnalysis = exports.getRadiographById = exports.getRadiographsByPatient = exports.createRadiograph = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const errors_js_1 = require("../utils/errors.js");
const openai_service_js_1 = require("./openai.service.js");
const logger_js_1 = require("../utils/logger.js");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
// Upload directory configuration
const UPLOAD_DIR = path_1.default.join(process.cwd(), 'uploads', 'radiographs');
// Ensure upload directory exists
const ensureUploadDir = async () => {
    await promises_1.default.mkdir(UPLOAD_DIR, { recursive: true });
};
/**
 * Upload and create a new radiograph
 */
const createRadiograph = async (input, tenantContext) => {
    // Validate file type
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(input.file.mimetype)) {
        throw new errors_js_1.BadRequestError('Solo se permiten archivos PNG o JPG');
    }
    // Validate tenant access
    if (!tenantContext.clinicIds.includes(input.clinicId)) {
        throw new errors_js_1.ForbiddenError('No tiene acceso a esta clínica');
    }
    await ensureUploadDir();
    // Generate unique filename
    const fileExtension = path_1.default.extname(input.file.originalname).toLowerCase();
    const uniqueId = crypto_1.default.randomUUID();
    const filename = `${uniqueId}${fileExtension}`;
    const storageKey = path_1.default.join(UPLOAD_DIR, filename);
    // Save file to disk
    await promises_1.default.writeFile(storageKey, input.file.buffer);
    // Create radiograph record
    const [radiograph] = await index_js_1.db
        .insert(schema_js_1.radiographs)
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
    // Create AI result record with PENDING status
    const [aiResult] = await index_js_1.db
        .insert(schema_js_1.radiographAiResults)
        .values({
        radiographId: radiograph.id,
        status: 'PENDING',
    })
        .returning();
    // Start async AI analysis
    processAiAnalysis(radiograph.id, input.file.buffer, input.file.mimetype).catch((err) => {
        logger_js_1.logger.error('Background AI analysis failed:', err);
    });
    return { radiograph: radiograph, aiResult: aiResult };
};
exports.createRadiograph = createRadiograph;
/**
 * Process AI analysis asynchronously
 */
const processAiAnalysis = async (radiographId, fileBuffer, mimeType) => {
    const startTime = Date.now();
    try {
        // Update status to PROCESSING
        await index_js_1.db
            .update(schema_js_1.radiographAiResults)
            .set({ status: 'PROCESSING', updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.radiographAiResults.radiographId, radiographId));
        // Convert to base64
        const base64Image = fileBuffer.toString('base64');
        // Call OpenAI
        const result = await (0, openai_service_js_1.analyzeRadiograph)(base64Image, mimeType);
        const processingTime = Date.now() - startTime;
        // Update with results
        await index_js_1.db
            .update(schema_js_1.radiographAiResults)
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
            .where((0, drizzle_orm_1.eq)(schema_js_1.radiographAiResults.radiographId, radiographId));
        logger_js_1.logger.info(`AI analysis completed for radiograph ${radiographId} in ${processingTime}ms`);
    }
    catch (error) {
        const processingTime = Date.now() - startTime;
        // Update with error
        await index_js_1.db
            .update(schema_js_1.radiographAiResults)
            .set({
            status: 'FAILED',
            errorMessage: error.message || 'Error desconocido durante el análisis',
            processingTimeMs: processingTime,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.radiographAiResults.radiographId, radiographId));
        logger_js_1.logger.error(`AI analysis failed for radiograph ${radiographId}:`, error);
    }
};
/**
 * Get radiographs for a patient
 */
const getRadiographsByPatient = async (patientId, tenantContext) => {
    const results = await index_js_1.db.query.radiographs.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.radiographs.patientId, patientId),
        orderBy: [(0, drizzle_orm_1.desc)(schema_js_1.radiographs.createdAt)],
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
    if (results.length > 0 && !tenantContext.clinicIds.includes(results[0].clinicId)) {
        throw new errors_js_1.ForbiddenError('No tiene acceso a este paciente');
    }
    // Fetch AI results for all radiographs
    const radiographIds = results.map(r => r.id);
    const aiResults = radiographIds.length > 0
        ? await index_js_1.db.query.radiographAiResults.findMany({
            where: (0, drizzle_orm_1.sql) `${schema_js_1.radiographAiResults.radiographId} IN (${drizzle_orm_1.sql.join(radiographIds.map(id => (0, drizzle_orm_1.sql) `${id}`), (0, drizzle_orm_1.sql) `, `)})`,
        })
        : [];
    // Map AI results to radiographs
    const aiResultMap = new Map(aiResults.map(r => [r.radiographId, r]));
    return results.map(r => ({
        ...r,
        aiResult: aiResultMap.get(r.id) || null,
    }));
};
exports.getRadiographsByPatient = getRadiographsByPatient;
/**
 * Get radiograph by ID with AI result
 */
const getRadiographById = async (id, tenantContext) => {
    const radiograph = await index_js_1.db.query.radiographs.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.radiographs.id, id),
    });
    if (!radiograph) {
        return null;
    }
    // Validate tenant access
    if (!tenantContext.clinicIds.includes(radiograph.clinicId)) {
        throw new errors_js_1.ForbiddenError('No tiene acceso a esta radiografía');
    }
    const aiResult = await index_js_1.db.query.radiographAiResults.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.radiographAiResults.radiographId, id),
    });
    return { ...radiograph, aiResult: aiResult || null };
};
exports.getRadiographById = getRadiographById;
/**
 * Retry AI analysis for a failed radiograph
 */
const retryAiAnalysis = async (radiographId, tenantContext) => {
    const radiograph = await (0, exports.getRadiographById)(radiographId, tenantContext);
    if (!radiograph) {
        throw new errors_js_1.NotFoundError('Radiografía no encontrada');
    }
    const currentResult = radiograph.aiResult;
    if (!currentResult) {
        throw new errors_js_1.BadRequestError('No existe un resultado de análisis previo');
    }
    if (currentResult.status === 'PROCESSING') {
        throw new errors_js_1.BadRequestError('El análisis ya está en proceso');
    }
    // Reset to PENDING
    const [updatedResult] = await index_js_1.db
        .update(schema_js_1.radiographAiResults)
        .set({
        status: 'PENDING',
        errorMessage: null,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.radiographAiResults.radiographId, radiographId))
        .returning();
    // Read file and start analysis
    const fileBuffer = await promises_1.default.readFile(radiograph.storageKey);
    processAiAnalysis(radiographId, fileBuffer, radiograph.mimeType).catch((err) => {
        logger_js_1.logger.error('Retry AI analysis failed:', err);
    });
    return updatedResult;
};
exports.retryAiAnalysis = retryAiAnalysis;
/**
 * Update worker notes for a radiograph
 */
const updateRadiographNotes = async (id, input, tenantContext) => {
    const existing = await (0, exports.getRadiographById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Radiografía no encontrada');
    }
    const updateData = { updatedAt: new Date() };
    if (input.notes !== undefined)
        updateData['notes'] = input.notes;
    if (input.annotations !== undefined)
        updateData['annotations'] = input.annotations;
    const [updated] = await index_js_1.db
        .update(schema_js_1.radiographs)
        .set(updateData)
        .where((0, drizzle_orm_1.eq)(schema_js_1.radiographs.id, id))
        .returning();
    return updated;
};
exports.updateRadiographNotes = updateRadiographNotes;
/**
 * Delete a radiograph
 */
const deleteRadiograph = async (id, tenantContext) => {
    const existing = await (0, exports.getRadiographById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Radiografía no encontrada');
    }
    // Delete file from disk
    try {
        await promises_1.default.unlink(existing.storageKey);
    }
    catch (err) {
        logger_js_1.logger.warn(`Failed to delete file ${existing.storageKey}:`, err);
    }
    // Delete from database (cascade will delete AI result)
    await index_js_1.db.delete(schema_js_1.radiographs).where((0, drizzle_orm_1.eq)(schema_js_1.radiographs.id, id));
    return true;
};
exports.deleteRadiograph = deleteRadiograph;
/**
 * Get file path for serving radiograph image
 */
const getRadiographFilePath = async (id, tenantContext) => {
    const radiograph = await (0, exports.getRadiographById)(id, tenantContext);
    if (!radiograph) {
        throw new errors_js_1.NotFoundError('Radiografía no encontrada');
    }
    return {
        path: radiograph.storageKey,
        mimeType: radiograph.mimeType,
        filename: radiograph.originalFilename,
    };
};
exports.getRadiographFilePath = getRadiographFilePath;
//# sourceMappingURL=radiograph.service.js.map