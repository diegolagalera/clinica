import { db } from '../db/index.js';
import { aiUsageLogs, clinics } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// Cost per token (USD) — approximate pricing as of 2024
const COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
    'gpt-4o': { input: 0.0000025, output: 0.00001 },
    'whisper-1': { input: 0.0001, output: 0 },     // ~$0.006/min, estimate per "token"
    'dall-e-3': { input: 0.00004, output: 0 },  // $0.04 per image / 1000 token-equivalent = $0.00004/token
};

type AIFeature = 'chatbot' | 'radiograph' | 'transcription' | 'voice_notes' | 'email_template' | 'stock_image' | 'assistant';
type AIModel = 'gpt-4o-mini' | 'gpt-4o' | 'whisper-1' | 'dall-e-3';

export interface QuotaCheck {
    allowed: boolean;
    aiEnabled: boolean;
    remaining: number;
    limit: number;
    used: number;
}

export class AiUsageService {

    /**
     * Check if a clinic has AI enabled and remaining quota this month.
     */
    static async checkQuota(clinicId: string): Promise<QuotaCheck> {
        // Get clinic AI config
        const [clinic] = await db
            .select({
                aiEnabled: clinics.aiEnabled,
                aiMonthlyTokenLimit: clinics.aiMonthlyTokenLimit,
            })
            .from(clinics)
            .where(eq(clinics.id, clinicId));

        if (!clinic) {
            return { allowed: false, aiEnabled: false, remaining: 0, limit: 0, used: 0 };
        }

        if (!clinic.aiEnabled) {
            return { allowed: false, aiEnabled: false, remaining: 0, limit: clinic.aiMonthlyTokenLimit || 0, used: 0 };
        }

        // Get usage for current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [usage] = await db
            .select({
                totalTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::int`,
            })
            .from(aiUsageLogs)
            .where(and(
                eq(aiUsageLogs.clinicId, clinicId),
                gte(aiUsageLogs.createdAt, startOfMonth)
            ));

        const used = usage?.totalTokens || 0;
        const limit = clinic.aiMonthlyTokenLimit || 100000;
        const remaining = Math.max(0, limit - used);

        return {
            allowed: remaining > 0,
            aiEnabled: true,
            remaining,
            limit,
            used,
        };
    }

    /**
     * Enforce AI quota — throws if AI is disabled or quota exceeded.
     * Use this as a single pre-flight check before any AI operation.
     */
    static async enforceQuota(clinicId: string): Promise<void> {
        const quota = await this.checkQuota(clinicId);
        if (!quota.allowed) {
            const message = !quota.aiEnabled
                ? 'La IA no está habilitada para esta clínica. Contacte con el administrador para activarla.'
                : 'Se ha superado el límite mensual de tokens de IA. Contacte con el administrador para ampliar el límite.';
            throw new Error(message);
        }
    }

    /**
     * Log an AI usage event with token counts and estimated cost.
     */
    static async logUsage(
        clinicId: string,
        feature: AIFeature,
        model: AIModel,
        tokens: { prompt: number; completion: number; total: number },
        metadata?: Record<string, unknown>
    ): Promise<void> {
        try {
            const costs = COST_PER_TOKEN[model] || { input: 0, output: 0 };
            const estimatedCost = (tokens.prompt * costs.input) + (tokens.completion * costs.output);

            await db.insert(aiUsageLogs).values({
                clinicId,
                feature,
                model,
                promptTokens: tokens.prompt,
                completionTokens: tokens.completion,
                totalTokens: tokens.total,
                estimatedCost: estimatedCost.toFixed(6),
                metadata: metadata || null,
            });

            logger.debug({
                clinicId,
                feature,
                model,
                totalTokens: tokens.total,
                estimatedCost: estimatedCost.toFixed(6),
            }, 'AI usage logged');
        } catch (error) {
            // Don't fail the main operation if logging fails
            logger.error({ error, clinicId, feature }, 'Failed to log AI usage');
        }
    }

    /**
     * Get aggregated usage summary for a clinic (for the super admin dashboard).
     */
    static async getUsageSummary(clinicId: string, month?: Date) {
        const startOfMonth = month || new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);

        // Total usage
        const [totals] = await db
            .select({
                totalTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::int`,
                totalCost: sql<string>`COALESCE(SUM(${aiUsageLogs.estimatedCost}), 0)::numeric(10,6)`,
                requestCount: sql<number>`COUNT(*)::int`,
            })
            .from(aiUsageLogs)
            .where(and(
                eq(aiUsageLogs.clinicId, clinicId),
                gte(aiUsageLogs.createdAt, startOfMonth),
                sql`${aiUsageLogs.createdAt} < ${endOfMonth}`
            ));

        // Per-feature breakdown
        const byFeature = await db
            .select({
                feature: aiUsageLogs.feature,
                totalTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::int`,
                totalCost: sql<string>`COALESCE(SUM(${aiUsageLogs.estimatedCost}), 0)::numeric(10,6)`,
                requestCount: sql<number>`COUNT(*)::int`,
            })
            .from(aiUsageLogs)
            .where(and(
                eq(aiUsageLogs.clinicId, clinicId),
                gte(aiUsageLogs.createdAt, startOfMonth),
                sql`${aiUsageLogs.createdAt} < ${endOfMonth}`
            ))
            .groupBy(aiUsageLogs.feature);

        // Per-model breakdown
        const byModel = await db
            .select({
                model: aiUsageLogs.model,
                totalTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::int`,
                totalCost: sql<string>`COALESCE(SUM(${aiUsageLogs.estimatedCost}), 0)::numeric(10,6)`,
                requestCount: sql<number>`COUNT(*)::int`,
            })
            .from(aiUsageLogs)
            .where(and(
                eq(aiUsageLogs.clinicId, clinicId),
                gte(aiUsageLogs.createdAt, startOfMonth),
                sql`${aiUsageLogs.createdAt} < ${endOfMonth}`
            ))
            .groupBy(aiUsageLogs.model);

        // Get clinic AI config
        const [clinic] = await db
            .select({
                aiEnabled: clinics.aiEnabled,
                aiMonthlyTokenLimit: clinics.aiMonthlyTokenLimit,
            })
            .from(clinics)
            .where(eq(clinics.id, clinicId));

        return {
            month: startOfMonth.toISOString().slice(0, 7),
            aiEnabled: clinic?.aiEnabled || false,
            tokenLimit: clinic?.aiMonthlyTokenLimit || 100000,
            totals: totals || { totalTokens: 0, totalCost: '0', requestCount: 0 },
            byFeature,
            byModel,
        };
    }

    /**
     * Update AI configuration for a clinic.
     */
    static async updateClinicAiConfig(clinicId: string, config: { aiEnabled?: boolean; aiMonthlyTokenLimit?: number }) {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (config.aiEnabled !== undefined) updateData.aiEnabled = config.aiEnabled;
        if (config.aiMonthlyTokenLimit !== undefined) updateData.aiMonthlyTokenLimit = config.aiMonthlyTokenLimit;

        const [updated] = await db
            .update(clinics)
            .set(updateData)
            .where(eq(clinics.id, clinicId))
            .returning();

        return updated;
    }
}
