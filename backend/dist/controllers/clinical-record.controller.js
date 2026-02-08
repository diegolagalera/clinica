"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeAudio = exports.deleteRecord = exports.signRecord = exports.updateRecord = exports.createRecord = exports.getRecord = exports.getRecordTypes = exports.listPatientRecords = exports.listRecords = void 0;
const zod_1 = require("zod");
const clinicalRecordService = __importStar(require("../services/clinical-record.service.js"));
const voice_transcription_service_js_1 = require("../services/voice-transcription.service.js");
const response_js_1 = require("../utils/response.js");
const index_js_1 = require("../middleware/index.js");
// Validation schemas
const createRecordSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid(),
    appointmentId: zod_1.z.string().uuid().optional(),
    recordType: zod_1.z.string().min(1),
    title: zod_1.z.string().max(255).optional(),
    content: zod_1.z.string().optional(),
    vitalSigns: zod_1.z.record(zod_1.z.unknown()).optional(),
    procedures: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).optional(),
    diagnosis: zod_1.z.string().optional(),
    treatment: zod_1.z.string().optional(),
    prescriptions: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).optional(),
    toothChart: zod_1.z.record(zod_1.z.unknown()).optional(),
    attachments: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).optional(),
});
const updateRecordSchema = zod_1.z.object({
    title: zod_1.z.string().max(255).optional(),
    content: zod_1.z.string().optional(),
    vitalSigns: zod_1.z.record(zod_1.z.unknown()).optional(),
    procedures: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).optional(),
    diagnosis: zod_1.z.string().optional(),
    treatment: zod_1.z.string().optional(),
    prescriptions: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).optional(),
    toothChart: zod_1.z.record(zod_1.z.unknown()).optional(),
    attachments: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).optional(),
});
/**
 * GET /clinical-records
 * List clinical records for clinic
 */
exports.listRecords = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const recordType = req.query['recordType'];
    const patientId = req.query['patientId'];
    const search = req.query['search'];
    const { data, total } = await clinicalRecordService.getRecordsByClinic(clinicId, params, {
        recordType: recordType || undefined,
        patientId: patientId || undefined,
        search: search || undefined,
    });
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(data, total, params)));
});
/**
 * GET /clinical-records/patient/:patientId
 * List clinical records for a specific patient
 */
exports.listPatientRecords = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    const { patientId } = req.params;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const recordType = req.query['recordType'];
    const search = req.query['search'];
    const { data, total } = await clinicalRecordService.getRecordsByPatient(patientId, clinicId, params, { recordType: recordType || undefined, search: search || undefined });
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(data, total, params)));
});
/**
 * GET /clinical-records/types
 * Get available record types
 */
exports.getRecordTypes = (0, index_js_1.asyncHandler)(async (_req, res) => {
    const types = clinicalRecordService.getRecordTypes();
    res.json((0, response_js_1.success)(types));
});
/**
 * GET /clinical-records/:id
 * Get clinical record by ID
 */
exports.getRecord = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const record = await clinicalRecordService.getRecordById(id, clinicId);
    if (!record) {
        res.status(404).json({ success: false, message: 'Record not found' });
        return;
    }
    res.json((0, response_js_1.success)(record));
});
/**
 * POST /clinical-records
 * Create a new clinical record
 */
exports.createRecord = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    const userId = req.user?.userId;
    if (!clinicId || !userId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const input = createRecordSchema.parse(req.body);
    const result = await clinicalRecordService.createRecord({
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
    });
    if (result.success) {
        res.status(201).json((0, response_js_1.success)(result.data, 'Clinical record created'));
    }
});
/**
 * PUT /clinical-records/:id
 * Update a clinical record
 */
exports.updateRecord = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const input = updateRecordSchema.parse(req.body);
    const result = await clinicalRecordService.updateRecord(id, clinicId, input);
    if (result.success) {
        res.json((0, response_js_1.success)(result.data, 'Clinical record updated'));
    }
});
/**
 * POST /clinical-records/:id/sign
 * Sign a clinical record (makes it immutable)
 */
exports.signRecord = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!clinicId || !userId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const result = await clinicalRecordService.signRecord(id, clinicId, userId);
    if (result.success) {
        res.json((0, response_js_1.success)(result.data, 'Clinical record signed'));
    }
});
/**
 * DELETE /clinical-records/:id
 * Delete a clinical record (only if not signed)
 */
exports.deleteRecord = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    await clinicalRecordService.deleteRecord(id, clinicId);
    res.json((0, response_js_1.success)(null, 'Clinical record deleted'));
});
/**
 * POST /clinical-records/transcribe-audio
 * Transcribe audio and extract clinical record fields using AI
 */
exports.transcribeAudio = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    // Check for uploaded file (multer adds file to req)
    const file = req.file;
    if (!file) {
        res.status(400).json({ success: false, message: 'No audio file provided' });
        return;
    }
    try {
        // Process the audio file
        const result = await (0, voice_transcription_service_js_1.processVoiceRecording)(file.buffer, file.originalname);
        res.json((0, response_js_1.success)({
            title: result.title,
            content: result.content,
            diagnosis: result.diagnosis,
            treatment: result.treatment,
            rawTranscription: result.rawTranscription,
        }, 'Audio transcribed and analyzed'));
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error processing audio'
        });
    }
});
//# sourceMappingURL=clinical-record.controller.js.map