"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRatingScheduler = exports.processRatingRequests = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const rating_service_js_1 = require("../services/rating.service.js");
const logger_js_1 = require("../utils/logger.js");
const email_service_js_1 = require("../services/email.service.js");
const email_template_service_js_1 = require("../services/email-template.service.js");
/**
 * Get the frontend URL from environment
 */
const getFrontendUrl = () => {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
};
/**
 * Send rating request email to patient
 */
const sendRatingEmail = async (request) => {
    try {
        const patient = request.patient;
        const clinic = request.clinic;
        const appointment = request.appointment;
        if (!patient?.email) {
            logger_js_1.logger.warn(`Cannot send rating email for request ${request.id}: Patient has no email`);
            return false;
        }
        // Check if clinic has email settings configured
        const emailSettingsData = await (0, email_service_js_1.getEmailSettings)(request.clinicId);
        if (!emailSettingsData?.isEnabled || !emailSettingsData?.isConfigured) {
            logger_js_1.logger.warn(`Cannot send rating email for request ${request.id}: Clinic email not configured`);
            return false;
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
        const template = await (0, email_template_service_js_1.getActiveTemplate)(request.clinicId, 'VISIT_RATING_REQUEST');
        let subject;
        let htmlContent;
        if (template) {
            // Use custom template
            const variables = {
                patient_name: `${patient.firstName} ${patient.lastName}`,
                clinic_name: clinic.name,
                clinic_phone: clinic.phone || '',
                appointment_date: appointmentDate,
                rating_url: ratingUrl,
            };
            subject = (0, email_template_service_js_1.replaceVariables)(template.subject, variables);
            htmlContent = (0, email_template_service_js_1.replaceVariables)((0, email_template_service_js_1.renderBlocksToHtml)(template.blocks), variables);
        }
        else {
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
        const result = await (0, email_service_js_1.sendEmail)(request.clinicId, {
            to: patient.email,
            subject,
            html: htmlContent,
        });
        if (result.success) {
            logger_js_1.logger.info(`Rating email sent to ${patient.email} for appointment ${appointment.id}`);
            return true;
        }
        else {
            logger_js_1.logger.error(`Failed to send rating email: ${result.error}`);
            return false;
        }
    }
    catch (error) {
        logger_js_1.logger.error(`Error sending rating email: ${error.message}`);
        return false;
    }
};
/**
 * Generate default rating email HTML
 */
const generateDefaultRatingEmail = (data) => {
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
 * Process pending rating requests
 */
const processRatingRequests = async () => {
    logger_js_1.logger.info('Processing rating requests...');
    try {
        // First, mark expired requests
        await (0, rating_service_js_1.markExpiredRequests)();
        // Get pending requests that are ready to be sent
        const pendingRequests = await (0, rating_service_js_1.getPendingRequests)();
        logger_js_1.logger.info(`Found ${pendingRequests.length} pending rating requests to process`);
        for (const request of pendingRequests) {
            try {
                const success = await sendRatingEmail(request);
                if (success) {
                    await (0, rating_service_js_1.markRequestAsSent)(request.id);
                    logger_js_1.logger.info(`Rating request ${request.id} marked as SENT`);
                }
            }
            catch (error) {
                logger_js_1.logger.error(`Failed to process rating request ${request.id}: ${error.message}`);
            }
        }
        logger_js_1.logger.info('Rating request processing complete');
    }
    catch (error) {
        logger_js_1.logger.error(`Error in rating request processor: ${error.message}`);
    }
};
exports.processRatingRequests = processRatingRequests;
/**
 * Start the rating request scheduler (runs every 5 minutes)
 */
const startRatingScheduler = () => {
    logger_js_1.logger.info('Starting rating request scheduler...');
    // Run immediately on startup
    (0, exports.processRatingRequests)().catch((err) => {
        logger_js_1.logger.error(`Initial rating request processing failed: ${err.message}`);
    });
    // Then run every 5 minutes
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        try {
            await (0, exports.processRatingRequests)();
        }
        catch (err) {
            logger_js_1.logger.error(`Rating scheduler error: ${err.message}`);
        }
    });
    logger_js_1.logger.info('Rating request scheduler started (runs every 5 minutes)');
};
exports.startRatingScheduler = startRatingScheduler;
//# sourceMappingURL=rating-scheduler.js.map