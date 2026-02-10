import type { Response } from 'express';
import { z } from 'zod';
import { AiUsageService } from '../services/ai-usage.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { db } from '../db/index.js';
import { clinics } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Validation schemas
const updateAiConfigSchema = z.object({
    aiEnabled: z.boolean().optional(),
    aiMonthlyTokenLimit: z.number().int().min(0).optional(),
});

/**
 * GET /ai-admin/clinics/:clinicId/ai-usage
 * Get AI usage summary for a specific clinic
 */
export const getClinicAiUsage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { clinicId } = req.params;
    const month = req.query['month'] as string | undefined;

    let monthDate: Date | undefined;
    if (month) {
        monthDate = new Date(`${month}-01`);
        if (isNaN(monthDate.getTime())) {
            res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM.' });
            return;
        }
    }

    const usageSummary = await AiUsageService.getUsageSummary(clinicId!, monthDate);

    res.json(success(usageSummary));
});

/**
 * GET /ai-admin/clinics/:clinicId/ai-config
 * Get AI configuration for a specific clinic
 */
export const getClinicAiConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { clinicId } = req.params;

    const [clinic] = await db
        .select({
            id: clinics.id,
            name: clinics.name,
            aiEnabled: clinics.aiEnabled,
            aiMonthlyTokenLimit: clinics.aiMonthlyTokenLimit,
        })
        .from(clinics)
        .where(eq(clinics.id, clinicId!));

    if (!clinic) {
        res.status(404).json({ success: false, message: 'Clinic not found' });
        return;
    }

    // Get current usage
    const quota = await AiUsageService.checkQuota(clinicId!);

    res.json(success({
        ...clinic,
        currentUsage: quota.used,
        remaining: quota.remaining,
    }));
});

/**
 * PUT /ai-admin/clinics/:clinicId/ai-config
 * Update AI configuration for a specific clinic
 */
export const updateClinicAiConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { clinicId } = req.params;
    const input = updateAiConfigSchema.parse(req.body);
    const config: { aiEnabled?: boolean; aiMonthlyTokenLimit?: number } = {};
    if (input.aiEnabled !== undefined) config.aiEnabled = input.aiEnabled;
    if (input.aiMonthlyTokenLimit !== undefined) config.aiMonthlyTokenLimit = input.aiMonthlyTokenLimit;

    const updated = await AiUsageService.updateClinicAiConfig(clinicId!, config);

    if (!updated) {
        res.status(404).json({ success: false, message: 'Clinic not found' });
        return;
    }

    res.json(success({
        id: updated.id,
        name: updated.name,
        aiEnabled: updated.aiEnabled,
        aiMonthlyTokenLimit: updated.aiMonthlyTokenLimit,
    }, 'Configuración de IA actualizada'));
});

/**
 * GET /ai-admin/ai-overview
 * Get AI usage overview for all clinics (dashboard summary)
 */
export const getAiOverview = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    // Get all clinics with their AI config
    const allClinics = await db
        .select({
            id: clinics.id,
            name: clinics.name,
            aiEnabled: clinics.aiEnabled,
            aiMonthlyTokenLimit: clinics.aiMonthlyTokenLimit,
        })
        .from(clinics)
        .where(eq(clinics.isActive, true));

    // Get current month usage for each clinic
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const clinicOverviews = await Promise.all(
        allClinics.map(async (clinic) => {
            const quota = await AiUsageService.checkQuota(clinic.id);
            return {
                clinicId: clinic.id,
                clinicName: clinic.name,
                aiEnabled: clinic.aiEnabled,
                tokenLimit: clinic.aiMonthlyTokenLimit,
                tokensUsed: quota.used,
                tokensRemaining: quota.remaining,
                usagePercent: clinic.aiMonthlyTokenLimit
                    ? Math.round((quota.used / clinic.aiMonthlyTokenLimit) * 100)
                    : 0,
            };
        })
    );

    res.json(success({
        totalClinics: allClinics.length,
        aiEnabledClinics: allClinics.filter(c => c.aiEnabled).length,
        clinics: clinicOverviews,
    }));
});
