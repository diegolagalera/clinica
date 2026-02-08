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
exports.deleteRadiograph = exports.updateNotes = exports.retryAnalysis = exports.getRadiographImage = exports.getRadiograph = exports.getPatientRadiographs = exports.uploadRadiograph = void 0;
const index_js_1 = require("../middleware/index.js");
const radiographService = __importStar(require("../services/radiograph.service.js"));
const patientService = __importStar(require("../services/patient.service.js"));
const response_js_1 = require("../utils/response.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * POST /radiographs/patient/:patientId
 * Upload a new radiograph
 */
exports.uploadRadiograph = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { patientId } = req.params;
    const file = req.file;
    if (!file) {
        throw new errors_js_1.BadRequestError('No se ha proporcionado ningún archivo');
    }
    // Get patient to determine clinicId
    const patient = await patientService.getPatientById(patientId, req.tenantContext);
    if (!patient) {
        throw new errors_js_1.BadRequestError('Paciente no encontrado');
    }
    const { radiographType, notes } = req.body;
    const result = await radiographService.createRadiograph({
        clinicId: patient.clinicId,
        patientId: patientId,
        uploadedById: req.user.userId,
        file: {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
        },
        radiographType,
        notes,
    }, req.tenantContext);
    res.status(201).json((0, response_js_1.success)(result));
});
/**
 * GET /radiographs/patient/:patientId
 * Get all radiographs for a patient
 */
exports.getPatientRadiographs = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { patientId } = req.params;
    const radiographs = await radiographService.getRadiographsByPatient(patientId, req.tenantContext);
    res.json((0, response_js_1.success)(radiographs));
});
/**
 * GET /radiographs/:id
 * Get radiograph by ID
 */
exports.getRadiograph = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const radiograph = await radiographService.getRadiographById(id, req.tenantContext);
    if (!radiograph) {
        throw new errors_js_1.BadRequestError('Radiografía no encontrada');
    }
    res.json((0, response_js_1.success)(radiograph));
});
/**
 * GET /radiographs/:id/image
 * Get radiograph image file
 */
exports.getRadiographImage = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const fileInfo = await radiographService.getRadiographFilePath(id, req.tenantContext);
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileInfo.filename}"`);
    res.sendFile(fileInfo.path);
});
/**
 * POST /radiographs/:id/retry-analysis
 * Retry AI analysis for a radiograph
 */
exports.retryAnalysis = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const result = await radiographService.retryAiAnalysis(id, req.tenantContext);
    res.json((0, response_js_1.success)(result));
});
/**
 * PUT /radiographs/:id/notes
 * Update worker notes for a radiograph
 */
exports.updateNotes = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { notes, annotations } = req.body;
    const updated = await radiographService.updateRadiographNotes(id, { notes, annotations }, req.tenantContext);
    res.json((0, response_js_1.success)(updated));
});
/**
 * DELETE /radiographs/:id
 * Delete a radiograph
 */
exports.deleteRadiograph = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await radiographService.deleteRadiograph(id, req.tenantContext);
    res.json((0, response_js_1.success)({ deleted: true }));
});
//# sourceMappingURL=radiograph.controller.js.map