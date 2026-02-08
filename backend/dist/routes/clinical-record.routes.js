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
const clinicalRecordController = __importStar(require("../controllers/clinical-record.controller.js"));
const index_js_1 = require("../middleware/index.js");
const router = (0, express_1.Router)();
// Configure multer for audio file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (_req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only audio files are allowed'));
        }
    },
});
// All routes require authentication and staff role
router.use(index_js_1.authenticate);
router.use(index_js_1.tenantContext);
router.use(index_js_1.requireStaff);
router.use(index_js_1.requireClinicContext);
// Get record types (for dropdowns)
router.get('/types', clinicalRecordController.getRecordTypes);
// Transcribe audio using AI
router.post('/transcribe-audio', upload.single('audio'), clinicalRecordController.transcribeAudio);
// List all records for clinic
router.get('/', clinicalRecordController.listRecords);
// List records for a specific patient
router.get('/patient/:patientId', clinicalRecordController.listPatientRecords);
// Get record by ID
router.get('/:id', clinicalRecordController.getRecord);
// Create new record
router.post('/', clinicalRecordController.createRecord);
// Update record
router.put('/:id', clinicalRecordController.updateRecord);
// Sign record (makes it immutable)
router.post('/:id/sign', clinicalRecordController.signRecord);
// Delete record (only if not signed)
router.delete('/:id', clinicalRecordController.deleteRecord);
exports.default = router;
//# sourceMappingURL=clinical-record.routes.js.map