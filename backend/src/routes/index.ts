import { Router } from 'express';
import authRoutes from './auth.routes.js';
import organizationRoutes from './organization.routes.js';
import clinicRoutes from './clinic.routes.js';
import patientRoutes from './patient.routes.js';
import appointmentRoutes from './appointment.routes.js';
import userRoutes from './user.routes.js';
import staffRoutes from './staff.routes.js';
import clinicalRecordRoutes from './clinical-record.routes.js';
import radiographRoutes from './radiograph.routes.js';
import odontogramRoutes from './odontogram.routes.js';
import notificationRoutes from './notification.routes.js';
import smsRoutes from './sms.routes.js';
import ratingRoutes from './rating.routes.js';
import stockRoutes from './stock.routes.js';
import marketingRoutes from './marketing.routes.js';
import assistantRoutes from './assistant.routes.js';
import feedbackRoutes from './feedback.routes.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API version
router.get('/', (_req, res) => {
    res.json({
        name: 'Dental ERP API',
        version: '1.0.0',
        docs: '/api/v1/docs',
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/clinics', clinicRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/users', userRoutes);
router.use('/staff', staffRoutes);
router.use('/clinical-records', clinicalRecordRoutes);
router.use('/radiographs', radiographRoutes);
router.use('/odontogram', odontogramRoutes);
router.use('/notifications', notificationRoutes);
router.use('/sms', smsRoutes);
router.use('/ratings', ratingRoutes);
router.use('/stock', stockRoutes);
router.use('/marketing', marketingRoutes);
router.use('/assistant', assistantRoutes);
router.use('/feedback', feedbackRoutes);

export default router;



