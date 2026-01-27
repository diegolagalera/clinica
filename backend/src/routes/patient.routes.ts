import { Router } from 'express';
import * as patientController from '../controllers/patient.controller.js';
import { authenticate, requireStaff, tenantContext } from '../middleware/index.js';

const router = Router();

// All routes require authentication, staff role, and tenant context
router.use(authenticate);
router.use(requireStaff);
router.use(tenantContext);

// List patients
router.get('/', patientController.listPatients);

// Get patient by ID
router.get('/:id', patientController.getPatient);

// Get patient stats
router.get('/:id/stats', patientController.getPatientStats);

// Create patient
router.post('/', patientController.createPatient);

// Update patient
router.put('/:id', patientController.updatePatient);

// Delete patient (soft delete)
router.delete('/:id', patientController.deletePatient);

export default router;
