import { Router } from 'express';
import multer from 'multer';
import * as radiographController from '../controllers/radiograph.controller.js';
import { authenticate, requireStaff, tenantContext } from '../middleware/index.js';

const router = Router();

// All routes require authentication, staff role, and tenant context
router.use(authenticate);
router.use(requireStaff);
router.use(tenantContext);
// Configure multer for memory storage (files stored in buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
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

export default router;
