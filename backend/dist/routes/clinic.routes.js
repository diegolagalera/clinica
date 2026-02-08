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
const express_1 = require("express");
const clinicController = __importStar(require("../controllers/clinic.controller.js"));
const index_js_1 = require("../middleware/index.js");
const router = (0, express_1.Router)();
// All routes require authentication and tenant context
router.use(index_js_1.authenticate);
router.use(index_js_1.tenantContext);
// List clinics (filtered by role)
router.get('/', clinicController.listClinics);
// Get current clinic settings (from tenant context)
router.get('/current', clinicController.getCurrentClinic);
// Update current clinic settings
router.put('/current', clinicController.updateCurrentClinic);
// Get clinic by ID
router.get('/:id', clinicController.getClinic);
// Get clinic stats
router.get('/:id/stats', clinicController.getClinicStats);
// Create clinic (ADMIN only)
router.post('/', index_js_1.requireAdmin, clinicController.createClinic);
// Update clinic (ADMIN only)
router.put('/:id', index_js_1.requireAdmin, clinicController.updateClinic);
// Delete clinic (ADMIN only - actually requires SUPERADMIN for safety)
router.delete('/:id', index_js_1.requireAdmin, clinicController.deleteClinic);
exports.default = router;
//# sourceMappingURL=clinic.routes.js.map