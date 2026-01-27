import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller.js';
import { authenticate, requireStaff, tenantContext } from '../middleware/index.js';

const router = Router();

// All routes require authentication, staff role, and tenant context
router.use(authenticate);
router.use(requireStaff);
router.use(tenantContext);

// List appointments (with date range filter)
router.get('/', appointmentController.listAppointments);

// Get today's appointments
router.get('/today', appointmentController.getTodayAppointments);

// Get patient's appointments
router.get('/patient/:patientId', appointmentController.getPatientAppointments);

// Get worker's schedule
router.get('/worker/:workerId/schedule', appointmentController.getWorkerSchedule);

// Get appointment by ID
router.get('/:id', appointmentController.getAppointment);

// Create appointment
router.post('/', appointmentController.createAppointment);

// Update appointment
router.put('/:id', appointmentController.updateAppointment);

// Cancel appointment
router.delete('/:id', appointmentController.cancelAppointment);

export default router;
