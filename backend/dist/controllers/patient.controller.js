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
exports.deletePatient = exports.updatePatient = exports.createPatient = exports.getPatientStats = exports.getPatient = exports.listPatients = exports.updatePatientSchema = exports.createPatientSchema = void 0;
const zod_1 = require("zod");
const patientService = __importStar(require("../services/patient.service.js"));
const response_js_1 = require("../utils/response.js");
const index_js_1 = require("../middleware/index.js");
const errors_js_1 = require("../utils/errors.js");
// Validation schemas
exports.createPatientSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).max(100),
    lastName: zod_1.z.string().min(1).max(100),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().max(50).optional(),
    dateOfBirth: zod_1.z.string().transform(s => new Date(s)).optional(),
    gender: zod_1.z.string().max(20).optional(),
    idNumber: zod_1.z.string().max(50).optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().max(100).optional(),
    postalCode: zod_1.z.string().max(20).optional(),
    emergencyContact: zod_1.z.string().max(255).optional(),
    emergencyPhone: zod_1.z.string().max(50).optional(),
    allergies: zod_1.z.string().optional(),
    medicalHistory: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    insuranceProvider: zod_1.z.string().max(100).optional(),
    insuranceNumber: zod_1.z.string().max(100).optional(),
});
exports.updatePatientSchema = exports.createPatientSchema.partial().extend({
    consentGiven: zod_1.z.boolean().optional(),
    isActive: zod_1.z.boolean().optional(),
});
/**
 * GET /patients
 * List patients for current clinic
 */
exports.listPatients = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const search = req.query['search'];
    const { data, total } = await patientService.getPatients(req.tenantContext.clinicId, params, search);
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(data, total, params)));
});
/**
 * GET /patients/:id
 * Get patient by ID
 */
exports.getPatient = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const patient = await patientService.getPatientWithDetails(id, req.tenantContext);
    res.json((0, response_js_1.success)(patient));
});
/**
 * GET /patients/:id/stats
 * Get patient statistics
 */
exports.getPatientStats = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const stats = await patientService.getPatientStats(id, req.tenantContext);
    res.json((0, response_js_1.success)(stats));
});
/**
 * POST /patients
 * Create new patient
 */
exports.createPatient = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = exports.createPatientSchema.parse(req.body);
    const result = await patientService.createPatient({
        ...input,
        clinicId: req.tenantContext.clinicId,
    });
    if (result.success) {
        res.status(201).json((0, response_js_1.success)(result.data, 'Patient created successfully'));
    }
});
/**
 * PUT /patients/:id
 * Update patient
 */
exports.updatePatient = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const input = exports.updatePatientSchema.parse(req.body);
    const result = await patientService.updatePatient(id, input, req.tenantContext);
    if (result.success) {
        res.json((0, response_js_1.success)(result.data, 'Patient updated successfully'));
    }
});
/**
 * DELETE /patients/:id
 * Soft delete patient
 */
exports.deletePatient = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await patientService.deletePatient(id, req.tenantContext);
    res.json((0, response_js_1.success)(null, 'Patient deleted successfully'));
});
//# sourceMappingURL=patient.controller.js.map