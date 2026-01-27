import { Router } from 'express';
import multer from 'multer';
import * as clinicalRecordController from '../controllers/clinical-record.controller.js';
import { authenticate, requireStaff, tenantContext, requireClinicContext } from '../middleware/index.js';

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (_req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    },
});

// All routes require authentication and staff role
router.use(authenticate);
router.use(tenantContext);
router.use(requireStaff);
router.use(requireClinicContext);

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

export default router;
