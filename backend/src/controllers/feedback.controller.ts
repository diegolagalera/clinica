import { Response } from 'express';
import { db } from '../db/index.js';
import { bugReports, users, clinics, organizations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { sendBugReportEmail } from '../services/email.service.js';

/**
 * Submit a bug report
 * POST /api/v1/feedback/report-bug
 */
export const submitBugReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;
    const clinicId = req.user.clinicId;

    const { title, description, category, pageUrl, userAgent } = req.body;

    // Validate required fields
    if (!title || !description) {
        res.status(400).json({
            success: false,
            error: 'El título y la descripción son obligatorios',
        });
        return;
    }

    // Validate category if provided
    const validCategories = ['UI', 'FUNCTIONALITY', 'DATA', 'PERFORMANCE', 'OTHER'];
    const finalCategory = category && validCategories.includes(category) ? category : 'OTHER';

    try {
        // Create bug report in database
        const [report] = await db
            .insert(bugReports)
            .values({
                userId,
                organizationId,
                clinicId,
                title: title.substring(0, 200),
                description,
                category: finalCategory,
                pageUrl: pageUrl?.substring(0, 500),
                userAgent: userAgent?.substring(0, 500),
            })
            .returning();

        if (!report) {
            throw new Error('Failed to create bug report');
        }

        // Get user info for email
        const [userInfo] = await db
            .select({
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email,
            })
            .from(users)
            .where(eq(users.id, userId));

        // Get clinic and organization names
        let clinicName = 'No especificada';
        let organizationName = 'No especificada';

        if (clinicId) {
            const [clinic] = await db
                .select({ name: clinics.name })
                .from(clinics)
                .where(eq(clinics.id, clinicId));
            if (clinic) clinicName = clinic.name;
        }

        if (organizationId) {
            const [org] = await db
                .select({ name: organizations.name })
                .from(organizations)
                .where(eq(organizations.id, organizationId));
            if (org) organizationName = org.name;
        }

        // Send email notification to support
        try {
            await sendBugReportEmail({
                reportId: report.id,
                title: report.title,
                description: report.description,
                category: finalCategory,
                pageUrl: pageUrl || 'No especificada',
                userAgent: userAgent || 'No especificado',
                userName: `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim() || 'Usuario desconocido',
                userEmail: userInfo?.email || 'No disponible',
                clinicName,
                organizationName,
                createdAt: report.createdAt,
            });
        } catch (emailError: any) {
            // Log but don't fail the request if email fails
            logger.error('Failed to send bug report email', { error: emailError.message, reportId: report.id });
        }

        logger.info('Bug report submitted', {
            reportId: report.id,
            userId,
            category: finalCategory,
        });

        res.status(201).json({
            success: true,
            message: 'Reporte enviado correctamente. Gracias por tu feedback.',
            reportId: report.id,
        });
    } catch (error: any) {
        logger.error('Error submitting bug report', {
            error: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({
            success: false,
            error: 'Error al enviar el reporte. Por favor, intenta de nuevo.',
        });
    }
});
