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
const odontogramController = __importStar(require("../controllers/odontogram.controller.js"));
const index_js_1 = require("../middleware/index.js");
const router = (0, express_1.Router)();
// All routes require authentication, staff role, and tenant context
router.use(index_js_1.authenticate);
router.use(index_js_1.requireStaff);
router.use(index_js_1.tenantContext);
// Get or create odontogram for patient
router.get('/patient/:patientId', odontogramController.getOdontogram);
// Update tooth condition
router.put('/:odontogramId/tooth/:toothNumber', odontogramController.updateTooth);
// Get odontogram history
router.get('/:odontogramId/history', odontogramController.getHistory);
// Get specific tooth history
router.get('/:odontogramId/tooth/:toothNumber/history', odontogramController.getToothHistory);
// Update odontogram notes
router.put('/:odontogramId/notes', odontogramController.updateNotes);
// Update tooth notes
router.put('/:odontogramId/tooth/:toothNumber/notes', odontogramController.updateToothNotes);
// Snapshots
router.post('/:odontogramId/snapshots', odontogramController.createSnapshot);
router.get('/:odontogramId/snapshots', odontogramController.getSnapshots);
router.get('/snapshots/:snapshotId', odontogramController.getSnapshot);
router.delete('/snapshots/:snapshotId', odontogramController.deleteSnapshot);
exports.default = router;
//# sourceMappingURL=odontogram.routes.js.map