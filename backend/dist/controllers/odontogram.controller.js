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
exports.deleteSnapshot = exports.getSnapshot = exports.getSnapshots = exports.createSnapshot = exports.updateToothNotes = exports.updateNotes = exports.getToothHistory = exports.getHistory = exports.updateTooth = exports.getOdontogram = void 0;
const index_js_1 = require("../middleware/index.js");
const odontogramService = __importStar(require("../services/odontogram.service.js"));
const patientService = __importStar(require("../services/patient.service.js"));
const response_js_1 = require("../utils/response.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * GET /odontogram/patient/:patientId
 * Get or create odontogram for a patient
 */
exports.getOdontogram = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { patientId } = req.params;
    const isChild = req.query.isChild === 'true';
    // Get patient to determine clinicId
    const patient = await patientService.getPatientById(patientId, req.tenantContext);
    if (!patient) {
        throw new errors_js_1.NotFoundError('Paciente no encontrado');
    }
    const odontogram = await odontogramService.getOrCreateOdontogram(patientId, patient.clinicId, isChild, req.tenantContext);
    res.json((0, response_js_1.success)(odontogram));
});
/**
 * PUT /odontogram/:odontogramId/tooth/:toothNumber
 * Update tooth condition
 */
exports.updateTooth = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { odontogramId, toothNumber } = req.params;
    const { condition, surface, notes } = req.body;
    if (!condition) {
        throw new errors_js_1.BadRequestError('La condición es requerida');
    }
    const updatedTooth = await odontogramService.updateToothCondition(odontogramId, parseInt(toothNumber, 10), condition, surface || null, req.user.userId, notes);
    res.json((0, response_js_1.success)(updatedTooth));
});
/**
 * GET /odontogram/:odontogramId/history
 * Get odontogram change history
 */
exports.getHistory = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { odontogramId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = await odontogramService.getOdontogramHistory(odontogramId, limit);
    res.json((0, response_js_1.success)(history));
});
/**
 * GET /odontogram/:odontogramId/tooth/:toothNumber/history
 * Get tooth change history
 */
exports.getToothHistory = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { odontogramId, toothNumber } = req.params;
    const history = await odontogramService.getToothHistory(odontogramId, parseInt(toothNumber, 10));
    res.json((0, response_js_1.success)(history));
});
/**
 * PUT /odontogram/:odontogramId/notes
 * Update odontogram general notes
 */
exports.updateNotes = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { odontogramId } = req.params;
    const { notes } = req.body;
    await odontogramService.updateOdontogramNotes(odontogramId, notes || '', req.user.userId);
    res.json((0, response_js_1.success)({ message: 'Notas actualizadas' }));
});
/**
 * PUT /odontogram/:odontogramId/tooth/:toothNumber/notes
 * Update tooth notes
 */
exports.updateToothNotes = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { odontogramId, toothNumber } = req.params;
    const { notes } = req.body;
    await odontogramService.updateToothNotes(odontogramId, parseInt(toothNumber, 10), notes || '');
    res.json((0, response_js_1.success)({ message: 'Notas del diente actualizadas' }));
});
// ============================================================================
// SNAPSHOTS
// ============================================================================
/**
 * POST /odontogram/:odontogramId/snapshots
 * Create a snapshot of current state
 */
exports.createSnapshot = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { odontogramId } = req.params;
    const { name, description } = req.body;
    if (!name) {
        throw new errors_js_1.BadRequestError('El nombre del snapshot es requerido');
    }
    const snapshot = await odontogramService.createSnapshot(odontogramId, name, description || null, req.user.userId);
    res.status(201).json((0, response_js_1.success)(snapshot));
});
/**
 * GET /odontogram/:odontogramId/snapshots
 * List all snapshots
 */
exports.getSnapshots = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { odontogramId } = req.params;
    const snapshots = await odontogramService.getSnapshots(odontogramId);
    res.json((0, response_js_1.success)(snapshots));
});
/**
 * GET /odontogram/snapshots/:snapshotId
 * Get a single snapshot
 */
exports.getSnapshot = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { snapshotId } = req.params;
    const snapshot = await odontogramService.getSnapshot(snapshotId);
    if (!snapshot) {
        throw new errors_js_1.NotFoundError('Snapshot no encontrado');
    }
    res.json((0, response_js_1.success)(snapshot));
});
/**
 * DELETE /odontogram/snapshots/:snapshotId
 * Delete a snapshot
 */
exports.deleteSnapshot = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { snapshotId } = req.params;
    await odontogramService.deleteSnapshot(snapshotId);
    res.json((0, response_js_1.success)({ message: 'Snapshot eliminado' }));
});
//# sourceMappingURL=odontogram.controller.js.map