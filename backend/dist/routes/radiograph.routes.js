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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const radiographController = __importStar(require("../controllers/radiograph.controller.js"));
const index_js_1 = require("../middleware/index.js");
const router = (0, express_1.Router)();
// All routes require authentication, staff role, and tenant context
router.use(index_js_1.authenticate);
router.use(index_js_1.requireStaff);
router.use(index_js_1.tenantContext);
// Configure multer for memory storage (files stored in buffer)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Solo se permiten archivos PNG o JPG'));
        }
    },
});
// Upload radiograph for a patient
router.post('/patient/:patientId', upload.single('file'), radiographController.uploadRadiograph);
// Get all radiographs for a patient
router.get('/patient/:patientId', radiographController.getPatientRadiographs);
// Get radiograph by ID
router.get('/:id', radiographController.getRadiograph);
// Get radiograph image
router.get('/:id/image', radiographController.getRadiographImage);
// Retry AI analysis
router.post('/:id/retry-analysis', radiographController.retryAnalysis);
// Update worker notes
router.put('/:id/notes', radiographController.updateNotes);
// Delete radiograph
router.delete('/:id', radiographController.deleteRadiograph);
exports.default = router;
//# sourceMappingURL=radiograph.routes.js.map