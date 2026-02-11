import cron from 'node-cron';
import type { Database } from '../db/index.js';
import { ratingRequests, emailSettings, patients, clinics, appointments } from '../db/schema.js';
import { and, eq, lte, ne } from 'drizzle-orm';
import {
    getPendingRequests,
    markRequestAsSent,
    markExpiredRequests,
} from '../services/rating.service.js';
import { logger } from '../utils/logger.js';
import { getEmailSettings, sendEmail } from '../services/email.service.js';
import { getActiveTemplate, renderBlocksToHtml, replaceVariables } from '../services/email-template.service.js';
import type { EmailTemplateType } from '../services/email-template.service.js';
import { centralDb } from '../db/central-db.js';
import { tenants } from '../db/central-schema.js';
import { tenantManager } from '../db/tenant-manager.js';

/**
 * Get the frontend URL from environment
 */
const getFrontendUrl = (): string => {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
};

/**
 * Send rating request email to patient
 */
const sendRatingEmail = async (db: Database, request: any): Promise<boolean | 'skip'> => {
    try {
        const patient = request.patient;
        const clinic = request.clinic;
        const appointment = request.appointment;

        if (!patient?.email) {
            logger.warn(`Cannot send rating email for request ${request.id}: Patient has no email — marking as SKIPPED`);
            return 'skip';
        }

        // Check if clinic has email settings configured
        const emailSettingsData = await getEmailSettings(db, request.clinicId);
        if (!emailSettingsData?.isEnabled || !emailSettingsData?.isConfigured) {
            logger.warn(`Cannot send rating email for request ${request.id}: Clinic email not configured — marking as SKIPPED`);
            return 'skip';
        }

        // Generate the rating URL
        const ratingUrl = `${getFrontendUrl()}/rate/${request.token}`;

        // Format appointment date
        const appointmentDate = new Date(appointment.startTime).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        // Try to get custom template, otherwise use default
        const template = await getActiveTemplate(db, request.clinicId, 'VISIT_RATING_REQUEST');

        let subject: string;
        let htmlContent: string;

        if (template) {
            // Use custom template
            const variables = {
                patient_name: `${patient.firstName} ${patient.lastName}`,
                clinic_name: clinic.name,
                clinic_phone: clinic.phone || '',
                appointment_date: appointmentDate,
                rating_url: ratingUrl,
            };
            subject = replaceVariables(template.subject, variables);
            htmlContent = replaceVariables(renderBlocksToHtml(template.blocks as any[]), variables);
        } else {
            // Use default email
            subject = `¿Cómo fue tu visita en ${clinic.name}?`;
            htmlContent = generateDefaultRatingEmail({
                patientName: `${patient.firstName} ${patient.lastName}`,
                clinicName: clinic.name,
                appointmentDate,
                ratingUrl,
            });
        }

        // Send the email
        const result = await sendEmail(db, request.clinicId, {
            to: patient.email,
            subject,
            html: htmlContent,
        });

        if (result.success) {
            logger.info(`Rating email sent to ${patient.email} for appointment ${appointment.id}`);
            return true;
        } else {
            logger.error(`Failed to send rating email: ${result.error}`);
            return false;
        }
    } catch (error: any) {
        logger.error(`Error sending rating email: ${error.message}`);
        return false;
    }
};

/**
 * Generate default rating email HTML
 */
const generateDefaultRatingEmail = (data: {
    patientName: string;
    clinicName: string;
    appointmentDate: string;
    ratingUrl: string;
}): string => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Valora tu visita</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                background: white;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .stars {
                font-size: 48px;
                text-align: center;
                margin: 20px 0;
            }
            h1 {
                color: #1a1a1a;
                font-size: 24px;
                margin-bottom: 10px;
            }
            p {
                color: #666;
                margin-bottom: 15px;
            }
            .button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white !important;
                text-decoration: none;
                padding: 16px 32px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                margin: 20px 0;
            }
            .button:hover {
                opacity: 0.9;
            }
            .cta {
                text-align: center;
                margin: 30px 0;
            }
            .footer {
                text-align: center;
                font-size: 12px;
                color: #999;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
            }
            .clinic-name {
                font-weight: 600;
                color: #333;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="stars">⭐⭐⭐⭐⭐</div>
                <h1>¡Hola, ${data.patientName}!</h1>
            </div>
            
            <p>Gracias por visitarnos en <span class="clinic-name">${data.clinicName}</span> el ${data.appointmentDate}.</p>
            
            <p>Tu opinión es muy importante para nosotros. ¿Podrías dedicarnos un momento para valorar tu experiencia?</p>
            
            <div class="cta">
                <a href="${data.ratingUrl}" class="button">Valorar mi visita</a>
            </div>
            
            <p style="font-size: 14px; color: #888;">
                Este enlace es válido durante 7 días y solo puede usarse una vez. 
                Tu valoración es completamente anónima.
            </p>
            
            <div class="footer">
                <p>Este correo fue enviado por ${data.clinicName}</p>
                <p>Si no realizaste ninguna visita, puedes ignorar este mensaje.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

/**
 * Process pending rating requests for a single tenant
 */
const processRatingRequestsForTenant = async (db: Database, tenantSlug: string): Promise<void> => {
    try {
        // First, mark expired requests
        await markExpiredRequests(db);

        // Get pending requests that are ready to be sent
        const pendingRequests = await getPendingRequests(db);

        if (pendingRequests.length === 0) return;

        logger.info(`[${tenantSlug}] Found ${pendingRequests.length} pending rating requests to process`);

        for (const request of pendingRequests) {
            try {
                const result = await sendRatingEmail(db, request);
                if (result === 'skip') {
                    // Email not configured or patient has no email — skip permanently
                    await db.update(ratingRequests)
                        .set({ status: 'SKIPPED' })
                        .where(eq(ratingRequests.id, request.id));
                    logger.info(`Rating request ${request.id} marked as SKIPPED (email not available)`);
                } else if (result === true) {
                    await markRequestAsSent(db, request.id);
                    logger.info(`Rating request ${request.id} marked as SENT`);
                }
            } catch (error: any) {
                logger.error(`Failed to process rating request ${request.id}: ${error.message}`);
            }
        }
    } catch (error: any) {
        logger.error(`[${tenantSlug}] Error processing rating requests: ${error.message}`);
    }
};

/**
 * Process pending rating requests across all tenants
 */
export const processRatingRequests = async (): Promise<void> => {
    logger.info('Processing rating requests across all tenants...');

    try {
        // Get all active tenants from central DB
        const activeTenants = await centralDb.query.tenants.findMany({
            where: eq(tenants.isActive, true),
        });

        for (const tenant of activeTenants) {
            try {
                const db = await tenantManager.getConnection(tenant.slug);
                await processRatingRequestsForTenant(db, tenant.slug);
            } catch (error: any) {
                logger.error({ tenantSlug: tenant.slug, error: error.message }, 'Failed to process rating requests for tenant');
            }
        }

        logger.info('Rating request processing complete');
    } catch (error: any) {
        logger.error('Error in rating request processor:', error);
    }
};

/**
 * Start the rating request scheduler (runs every 5 minutes)
 */
export const startRatingScheduler = () => {
    logger.info('Starting rating request scheduler...');

    // Run immediately on startup
    processRatingRequests().catch((err) => {
        logger.error('Initial rating request processing failed:', err);
    });

    // Then run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            await processRatingRequests();
        } catch (err: any) {
            logger.error(`Rating scheduler error: ${err.message}`);
        }
    });

    logger.info('Rating request scheduler started (runs every 5 minutes)');
};
