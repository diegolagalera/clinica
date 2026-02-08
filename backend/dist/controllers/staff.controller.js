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
exports.updateStaffProfile = exports.updateMyProfile = exports.removeWorker = exports.assignWorker = exports.getMyClinics = exports.getStaff = exports.updateProfileSchema = exports.assignWorkerSchema = void 0;
const zod_1 = require("zod");
const staffService = __importStar(require("../services/staff.service.js"));
const response_js_1 = require("../utils/response.js");
const index_js_1 = require("../middleware/index.js");
// Validation schemas
exports.assignWorkerSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    clinicId: zod_1.z.string().uuid(),
    role: zod_1.z.string().max(50).optional(),
});
exports.updateProfileSchema = zod_1.z.object({
    licenseNumber: zod_1.z.string().max(100).optional(),
    specialty: zod_1.z.string().max(100).optional(),
    bio: zod_1.z.string().optional(),
    color: zod_1.z.string().max(7).optional(),
});
/**
 * GET /staff
 * Get staff for current context (organization or clinic)
 */
exports.getStaff = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.headers['x-clinic-id'];
    if (clinicId) {
        const staff = await staffService.getStaffByClinic(clinicId);
        res.json((0, response_js_1.success)(staff));
    }
    else if (req.tenantContext?.organizationId) {
        const staff = await staffService.getStaffByOrganization(req.tenantContext.organizationId);
        res.json((0, response_js_1.success)(staff));
    }
    else {
        res.json((0, response_js_1.success)([]));
    }
});
/**
 * GET /staff/my-clinics
 * Get clinics accessible to the current user
 */
exports.getMyClinics = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { userId, role, organizationId } = req.user;
    const clinics = await staffService.getAccessibleClinics(userId, role, organizationId);
    res.json((0, response_js_1.success)(clinics));
});
/**
 * POST /staff/assign
 * Assign a worker to a clinic
 */
exports.assignWorker = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { userId, clinicId, role } = exports.assignWorkerSchema.parse(req.body);
    const assignment = await staffService.assignWorkerToClinic(userId, clinicId, role);
    res.status(201).json((0, response_js_1.success)(assignment, 'Worker assigned successfully'));
});
/**
 * DELETE /staff/assign/:userId/:clinicId
 * Remove a worker from a clinic
 */
exports.removeWorker = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { userId, clinicId } = req.params;
    await staffService.removeWorkerFromClinic(userId, clinicId);
    res.json((0, response_js_1.success)(null, 'Worker removed from clinic'));
});
/**
 * PUT /staff/profile
 * Update current user's staff profile
 */
exports.updateMyProfile = (0, index_js_1.asyncHandler)(async (req, res) => {
    const data = exports.updateProfileSchema.parse(req.body);
    const profile = await staffService.updateStaffProfile(req.user.userId, data);
    res.json((0, response_js_1.success)(profile, 'Profile updated'));
});
/**
 * PUT /staff/profile/:userId
 * Update a staff member's profile (admin only)
 */
exports.updateStaffProfile = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const data = exports.updateProfileSchema.parse(req.body);
    const profile = await staffService.updateStaffProfile(userId, data);
    res.json((0, response_js_1.success)(profile, 'Profile updated'));
});
//# sourceMappingURL=staff.controller.js.map