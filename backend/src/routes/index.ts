import { Router } from 'express';
import type { Response, Request } from 'express';
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
import aiAdminRoutes from './ai-admin.routes.js';
import adminRoutes from './admin.routes.js';
import prescriptionRoutes from './prescription.routes.js';
import chatbotRoutes from '../controllers/chatbot.controller.js';
import webhookRoutes from '../controllers/webhook.controller.js';

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

// Public: tenant info for login branding (no auth required)
router.get('/tenants/:slug/info', async (req: Request, res: Response) => {
    try {
        const { centralDb } = await import('../db/central-db.js');
        const result = await centralDb.execute(
            /* sql */ `SELECT slug, name, is_active FROM tenants WHERE slug = '${req.params.slug!.replace(/'/g, "''")}'  LIMIT 1`
        );
        const tenant = (result as any).rows?.[0] || (result as any)[0];
        if (!tenant || !tenant.is_active) {
            res.status(404).json({ success: false, message: 'Tenant not found' });
            return;
        }
        res.json({ success: true, data: { slug: tenant.slug, name: tenant.name } });
    } catch {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
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
router.use('/ai-admin', aiAdminRoutes);
router.use('/admin', adminRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/whatsapp', webhookRoutes);

export default router;



