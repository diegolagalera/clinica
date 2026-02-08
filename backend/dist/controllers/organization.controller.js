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
exports.deleteOrganization = exports.updateOrganization = exports.createOrganization = exports.getOrganizationStats = exports.getOrganization = exports.listOrganizations = exports.updateOrganizationSchema = exports.createOrganizationSchema = void 0;
const zod_1 = require("zod");
const organizationService = __importStar(require("../services/organization.service.js"));
const response_js_1 = require("../utils/response.js");
const index_js_1 = require("../middleware/index.js");
// Validation schemas
exports.createOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    slug: zod_1.z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().max(50).optional(),
    address: zod_1.z.string().optional(),
    logoUrl: zod_1.z.string().url().optional(),
});
exports.updateOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    slug: zod_1.z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().max(50).optional(),
    address: zod_1.z.string().optional(),
    logoUrl: zod_1.z.string().url().optional(),
    isActive: zod_1.z.boolean().optional(),
});
/**
 * GET /organizations
 * List all organizations (SUPERADMIN only)
 */
exports.listOrganizations = (0, index_js_1.asyncHandler)(async (req, res) => {
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const search = req.query['search'];
    const { data, total } = await organizationService.getOrganizations(params, search);
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(data, total, params)));
});
/**
 * GET /organizations/:id
 * Get organization by ID
 */
exports.getOrganization = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const org = await organizationService.getOrganizationById(id);
    res.json((0, response_js_1.success)(org));
});
/**
 * GET /organizations/:id/stats
 * Get organization statistics
 */
exports.getOrganizationStats = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const stats = await organizationService.getOrganizationStats(id);
    res.json((0, response_js_1.success)(stats));
});
/**
 * POST /organizations
 * Create new organization
 */
exports.createOrganization = (0, index_js_1.asyncHandler)(async (req, res) => {
    const input = exports.createOrganizationSchema.parse(req.body);
    const result = await organizationService.createOrganization(input);
    if (result.success) {
        res.status(201).json((0, response_js_1.success)(result.data, 'Organization created successfully'));
    }
});
/**
 * PUT /organizations/:id
 * Update organization
 */
exports.updateOrganization = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const input = exports.updateOrganizationSchema.parse(req.body);
    const result = await organizationService.updateOrganization(id, input);
    if (result.success) {
        res.json((0, response_js_1.success)(result.data, 'Organization updated successfully'));
    }
});
/**
 * DELETE /organizations/:id
 * Delete organization
 */
exports.deleteOrganization = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await organizationService.deleteOrganization(id);
    res.json((0, response_js_1.success)(null, 'Organization deleted successfully'));
});
//# sourceMappingURL=organization.controller.js.map