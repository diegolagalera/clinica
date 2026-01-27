import { Router } from 'express';
import * as odontogramController from '../controllers/odontogram.controller.js';
import { authenticate, requireStaff, tenantContext } from '../middleware/index.js';

const router = Router();

// All routes require authentication, staff role, and tenant context
router.use(authenticate);
router.use(requireStaff);
router.use(tenantContext);

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

export default router;
