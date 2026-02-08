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
exports.deleteClinic = exports.updateClinic = exports.createClinic = exports.getClinicStats = exports.updateCurrentClinic = exports.getCurrentClinic = exports.getClinic = exports.listClinics = exports.updateClinicSchema = exports.createClinicSchema = void 0;
const zod_1 = require("zod");
const clinicService = __importStar(require("../services/clinic.service.js"));
const response_js_1 = require("../utils/response.js");
const index_js_1 = require("../middleware/index.js");
// Validation schemas
exports.createClinicSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    slug: zod_1.z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().max(50).optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().max(100).optional(),
    postalCode: zod_1.z.string().max(20).optional(),
    country: zod_1.z.string().length(2).optional(),
    timezone: zod_1.z.string().max(50).optional(),
});
exports.updateClinicSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    slug: zod_1.z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().max(50).optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().max(100).optional(),
    postalCode: zod_1.z.string().max(20).optional(),
    country: zod_1.z.string().length(2).optional(),
    timezone: zod_1.z.string().max(50).optional(),
    isActive: zod_1.z.boolean().optional(),
});
/**
 * GET /clinics
 * List clinics (filtered by tenant context)
 */
exports.listClinics = (0, index_js_1.asyncHandler)(async (req, res) => {
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const search = req.query['search'];
    let data, total;
    // Super Admin sees all clinics
    if (req.user.role === 'SUPERADMIN') {
        const result = await clinicService.getAllClinics(params, search);
        data = result.data;
        total = result.total;
    }
    else if (req.tenantContext.organizationId) {
        // Admin/Worker see their organization's clinics
        const result = await clinicService.getClinicsByOrganization(req.tenantContext.organizationId, params, search);
        data = result.data;
        total = result.total;
    }
    else {
        data = [];
        total = 0;
    }
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(data, total, params)));
});
/**
 * GET /clinics/:id
 * Get clinic by ID
 */
exports.getClinic = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const clinic = await clinicService.getClinicById(id);
    res.json((0, response_js_1.success)(clinic));
});
/**
 * GET /clinics/current
 * Get current clinic from tenant context
 */
exports.getCurrentClinic = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new Error('No clinic context available');
    }
    const clinic = await clinicService.getClinicById(req.tenantContext.clinicId);
    res.json((0, response_js_1.success)(clinic));
});
/**
 * PUT /clinics/current
 * Update current clinic settings
 */
exports.updateCurrentClinic = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new Error('No clinic context available');
    }
    // Allow updating settings directly
    const input = exports.updateClinicSchema.extend({
        settings: zod_1.z.record(zod_1.z.unknown()).optional(),
    }).parse(req.body);
    const result = await clinicService.updateClinic(req.tenantContext.clinicId, input);
    if (result.success) {
        res.json((0, response_js_1.success)(result.data, 'Clinic settings updated successfully'));
    }
});
/**
 * GET /clinics/:id/stats
 * Get clinic statistics
 */
exports.getClinicStats = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const stats = await clinicService.getClinicStats(id);
    res.json((0, response_js_1.success)(stats));
});
/**
 * POST /clinics
 * Create new clinic
 */
exports.createClinic = (0, index_js_1.asyncHandler)(async (req, res) => {
    const input = exports.createClinicSchema.parse(req.body);
    const result = await clinicService.createClinic(input);
    if (result.success) {
        res.status(201).json((0, response_js_1.success)(result.data, 'Clinic created successfully'));
    }
});
/**
 * PUT /clinics/:id
 * Update clinic
 */
exports.updateClinic = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const input = exports.updateClinicSchema.parse(req.body);
    const result = await clinicService.updateClinic(id, input);
    if (result.success) {
        res.json((0, response_js_1.success)(result.data, 'Clinic updated successfully'));
    }
});
/**
 * DELETE /clinics/:id
 * Delete clinic
 */
exports.deleteClinic = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await clinicService.deleteClinic(id);
    res.json((0, response_js_1.success)(null, 'Clinic deleted successfully'));
});
//# sourceMappingURL=clinic.controller.js.map