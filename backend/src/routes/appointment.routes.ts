import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller.js';
import * as appointmentStockController from '../controllers/appointment-stock.controller.js';
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

// ============================================================================
// APPOINTMENT STOCK USAGE
// ============================================================================

// Get stock usage for an appointment
router.get('/:appointmentId/stock', appointmentStockController.getAppointmentStock);

// Add stock usage to an appointment
router.post('/:appointmentId/stock', appointmentStockController.addStockUsage);

// Add multiple stock items to an appointment
router.post('/:appointmentId/stock/bulk', appointmentStockController.addBulkStockUsage);

// Apply a stock pack to an appointment
router.post('/:appointmentId/stock/pack/:packId', appointmentStockController.applyPackToAppointment);

// Remove stock usage (and restore inventory)
router.delete('/:appointmentId/stock/:usageId', appointmentStockController.removeStockUsage);

export default router;

