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
const userController = __importStar(require("../controllers/user.controller.js"));
const index_js_1 = require("../middleware/index.js");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(index_js_1.authenticate);
// Get available clinics for user assignment (Admin can see org clinics)
router.get('/clinics', index_js_1.requireAdmin, userController.getAvailableClinics);
// ========= Organization-scoped routes (ADMIN) =========
// These allow ADMIN to manage users within their organization
// List users in organization (for Admin panel)
router.get('/org', index_js_1.requireAdmin, userController.listOrgUsers);
// Get user by ID (Admin can see org users)
router.get('/org/:id', index_js_1.requireAdmin, userController.getOrgUser);
// Create user in organization
router.post('/org', index_js_1.requireAdmin, userController.createOrgUser);
// Update user in organization
router.put('/org/:id', index_js_1.requireAdmin, userController.updateOrgUser);
// Reset user password in organization
router.post('/org/:id/reset-password', index_js_1.requireAdmin, userController.resetOrgPassword);
// Toggle user active status in organization
router.post('/org/:id/toggle-status', index_js_1.requireAdmin, userController.toggleOrgUserStatus);
// Delete user in organization
router.delete('/org/:id', index_js_1.requireAdmin, userController.deleteOrgUser);
// ========= Global routes (SUPERADMIN only) =========
// List all users
router.get('/', index_js_1.requireSuperAdmin, userController.listUsers);
// Get user by ID
router.get('/:id', index_js_1.requireSuperAdmin, userController.getUser);
// Create user
router.post('/', index_js_1.requireSuperAdmin, userController.createUser);
// Update user
router.put('/:id', index_js_1.requireSuperAdmin, userController.updateUser);
// Reset user password
router.post('/:id/reset-password', index_js_1.requireSuperAdmin, userController.resetPassword);
// Deactivate user
router.post('/:id/deactivate', index_js_1.requireSuperAdmin, userController.deactivateUser);
// Delete user
router.delete('/:id', index_js_1.requireSuperAdmin, userController.deleteUser);
exports.default = router;
//# sourceMappingURL=user.routes.js.map