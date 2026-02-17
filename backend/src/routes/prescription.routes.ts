import { Router } from 'express';
import * as prescriptionController from '../controllers/prescription.controller.js';
import { authenticate, requireStaff } from '../middleware/index.js';
import { requireTenantDb } from '../middleware/tenant.middleware.js';

const router = Router();

// All routes require authentication + tenant DB + staff role
router.use(authenticate);
router.use(requireTenantDb);
router.use(requireStaff);

// Medications catalog CRUD
router.get('/medications', prescriptionController.getMedications);
router.post('/medications', prescriptionController.createMedication);
router.put('/medications/:id', prescriptionController.updateMedication);
router.delete('/medications/:id', prescriptionController.removeMedication);

// Prescriptions for a patient
router.get('/patient/:patientId', prescriptionController.listByPatient);

// Get single prescription
router.get('/:id', prescriptionController.getById);

// Download PDF
router.get('/:id/pdf', prescriptionController.downloadPdf);

// Create prescription
router.post('/', prescriptionController.create);

// Delete prescription
router.delete('/:id', prescriptionController.remove);

export default router;
