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
const notificationController = __importStar(require("../controllers/notification.controller.js"));
const index_js_1 = require("../middleware/index.js");
const router = (0, express_1.Router)();
// All routes require authentication and admin role
router.use(index_js_1.authenticate);
router.use(index_js_1.tenantContext);
router.use(index_js_1.requireAdmin);
router.use(index_js_1.requireClinicContext);
// Email Settings
router.get('/settings', notificationController.getSettings);
router.put('/settings', notificationController.updateSettings);
router.post('/settings/test', notificationController.testConnection);
router.post('/settings/test-email', notificationController.sendTestEmail);
router.post('/send-test', notificationController.sendCustomTestEmail);
// Templates
router.get('/templates', notificationController.getTemplates);
router.get('/templates/types', notificationController.getTemplateTypes);
router.get('/templates/default/:type', notificationController.getDefaultTemplate);
router.get('/templates/:id', notificationController.getTemplate);
router.post('/templates', notificationController.createTemplate);
router.put('/templates/:id', notificationController.updateTemplate);
router.delete('/templates/:id', notificationController.deleteTemplate);
router.post('/templates/:id/preview', notificationController.previewTemplate);
router.post('/templates/:id/test', notificationController.testTemplate);
router.post('/templates/generate', notificationController.generateTemplateWithAI);
// Logs
router.get('/logs', notificationController.getLogs);
router.get('/stats', notificationController.getStats);
exports.default = router;
//# sourceMappingURL=notification.routes.js.map