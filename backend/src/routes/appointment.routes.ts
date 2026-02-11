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

// Get active appointments for current user (must be before /:id)
router.get('/active', appointmentController.getActiveAppointments);

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
// ACTIVE APPOINTMENT MANAGEMENT
// ============================================================================

// Start an appointment
router.post('/:id/start', appointmentController.startAppointment);

// Pause an appointment
router.post('/:id/pause', appointmentController.pauseAppointment);

// Resume an appointment
router.post('/:id/resume', appointmentController.resumeAppointment);

// Complete an appointment
router.post('/:id/complete', appointmentController.completeAppointment);

// Cancel an active appointment (clears real time data)
router.post('/:id/cancel-active', appointmentController.cancelActiveAppointment);

// ============================================================================
// ADMIN: REAL TIME MANAGEMENT
// ============================================================================

// Update real time fields (Admin only)
router.put('/:id/real-time', appointmentController.updateRealTime);

// Reset real time fields (Admin only)
router.post('/:id/reset-time', appointmentController.resetRealTime);

// ============================================================================
// WHATSAPP NOTIFICATION
// ============================================================================

// Send WhatsApp notification for an appointment
router.post('/:id/wa-notify', appointmentController.sendWaNotification);

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

// Remove stock usage (only restores inventory if confirmed)
router.delete('/:appointmentId/stock/:usageId', appointmentStockController.removeStockUsage);

// Confirm all pending stock (called when completing appointment)
router.post('/:appointmentId/stock/confirm', appointmentStockController.confirmAppointmentStock);

export default router;

