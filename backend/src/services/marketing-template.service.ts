import { eq, and, isNull, or, desc, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { marketingTemplates } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { SYSTEM_TEMPLATES, MARKETING_TEMPLATE_VARIABLES } from '../data/system-templates.js';

type MarketingTemplateCategory = 'birthday' | 'promo' | 'seasonal' | 'educational' | 'reactivation' | 'onboarding' | 'newsletter' | 'custom';

interface CreateTemplateData {
    name: string;
    subject: string;
    category?: MarketingTemplateCategory;
    designJson: object;
    htmlContent?: string;
    previewText?: string;
    thumbnailUrl?: string;
}

interface UpdateTemplateData {
    name?: string;
    subject?: string;
    category?: MarketingTemplateCategory;
    designJson?: object;
    htmlContent?: string;
    previewText?: string;
    thumbnailUrl?: string;
    isActive?: boolean;
}

class MarketingTemplateService {
    /**
     * Get all templates for a clinic (including system templates)
     */
    async getTemplates(clinicId: string) {
        const templates = await db
            .select()
            .from(marketingTemplates)
            .where(
                or(
                    eq(marketingTemplates.clinicId, clinicId),
                    eq(marketingTemplates.isSystemTemplate, true)
                )
            )
            .orderBy(
                asc(marketingTemplates.isSystemTemplate),
                desc(marketingTemplates.createdAt)
            );

        return templates;
    }

    /**
     * Get clinic-only templates (not system templates)
     */
    async getClinicTemplates(clinicId: string) {
        return db
            .select()
            .from(marketingTemplates)
            .where(
                and(
                    eq(marketingTemplates.clinicId, clinicId),
                    eq(marketingTemplates.isSystemTemplate, false)
                )
            )
            .orderBy(desc(marketingTemplates.createdAt));
    }

    /**
     * Get system templates only
     */
    async getSystemTemplates() {
        return db
            .select()
            .from(marketingTemplates)
            .where(eq(marketingTemplates.isSystemTemplate, true))
            .orderBy(asc(marketingTemplates.name));
    }

    /**
     * Get a specific template by ID
     */
    async getTemplateById(id: string, clinicId?: string) {
        const [template] = await db
            .select()
            .from(marketingTemplates)
            .where(eq(marketingTemplates.id, id))
            .limit(1);

        if (!template) return null;

        // Check access: system templates are accessible to all, clinic templates only to their clinic
        if (!template.isSystemTemplate && template.clinicId !== clinicId) {
            return null;
        }

        return template;
    }

    /**
     * Get templates by category
     */
    async getTemplatesByCategory(clinicId: string, category: MarketingTemplateCategory) {
        return db
            .select()
            .from(marketingTemplates)
            .where(
                and(
                    or(
                        eq(marketingTemplates.clinicId, clinicId),
                        eq(marketingTemplates.isSystemTemplate, true)
                    ),
                    eq(marketingTemplates.category, category)
                )
            )
            .orderBy(asc(marketingTemplates.isSystemTemplate), desc(marketingTemplates.createdAt));
    }

    /**
     * Create a new template for a clinic
     */
    async createTemplate(clinicId: string, userId: string, data: CreateTemplateData) {
        const [template] = await db
            .insert(marketingTemplates)
            .values({
                clinicId,
                createdById: userId,
                name: data.name,
                subject: data.subject,
                category: data.category || 'custom',
                designJson: data.designJson,
                htmlContent: data.htmlContent || null,
                previewText: data.previewText || null,
                thumbnailUrl: data.thumbnailUrl || null,
                isSystemTemplate: false,
                isActive: true,
            })
            .returning();

        logger.info(`Marketing template created: ${template.id} for clinic ${clinicId}`);
        return template;
    }

    /**
     * Update a template
     */
    async updateTemplate(id: string, clinicId: string, data: UpdateTemplateData) {
        // First verify this template belongs to the clinic (can't update system templates)
        const [existing] = await db
            .select()
            .from(marketingTemplates)
            .where(
                and(
                    eq(marketingTemplates.id, id),
                    eq(marketingTemplates.clinicId, clinicId),
                    eq(marketingTemplates.isSystemTemplate, false)
                )
            )
            .limit(1);

        if (!existing) {
            throw new Error('Template not found or cannot be modified');
        }

        const [updated] = await db
            .update(marketingTemplates)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(marketingTemplates.id, id))
            .returning();

        logger.info(`Marketing template updated: ${id}`);
        return updated;
    }

    /**
     * Delete a template
     */
    async deleteTemplate(id: string, clinicId: string) {
        // Can't delete system templates
        const [existing] = await db
            .select()
            .from(marketingTemplates)
            .where(
                and(
                    eq(marketingTemplates.id, id),
                    eq(marketingTemplates.clinicId, clinicId),
                    eq(marketingTemplates.isSystemTemplate, false)
                )
            )
            .limit(1);

        if (!existing) {
            throw new Error('Template not found or cannot be deleted');
        }

        await db
            .delete(marketingTemplates)
            .where(eq(marketingTemplates.id, id));

        logger.info(`Marketing template deleted: ${id}`);
        return true;
    }

    /**
     * Clone a system template to a clinic
     */
    async cloneSystemTemplate(templateId: string, clinicId: string, userId: string, newName?: string) {
        const [systemTemplate] = await db
            .select()
            .from(marketingTemplates)
            .where(
                and(
                    eq(marketingTemplates.id, templateId),
                    eq(marketingTemplates.isSystemTemplate, true)
                )
            )
            .limit(1);

        if (!systemTemplate) {
            throw new Error('System template not found');
        }

        const [cloned] = await db
            .insert(marketingTemplates)
            .values({
                clinicId,
                createdById: userId,
                name: newName || `${systemTemplate.name} (copia)`,
                subject: systemTemplate.subject,
                category: systemTemplate.category,
                designJson: systemTemplate.designJson,
                htmlContent: systemTemplate.htmlContent,
                previewText: systemTemplate.previewText,
                thumbnailUrl: systemTemplate.thumbnailUrl,
                isSystemTemplate: false,
                isActive: true,
            })
            .returning();

        logger.info(`System template ${templateId} cloned to ${cloned.id} for clinic ${clinicId}`);
        return cloned;
    }

    /**
     * Seed system templates from the data file
     */
    async seedSystemTemplates() {
        // Check if system templates already exist
        const existing = await db
            .select()
            .from(marketingTemplates)
            .where(eq(marketingTemplates.isSystemTemplate, true))
            .limit(1);

        if (existing.length > 0) {
            logger.info('System templates already exist, skipping seed');
            return;
        }

        logger.info('Seeding system marketing templates...');

        for (const template of SYSTEM_TEMPLATES) {
            await db.insert(marketingTemplates).values({
                clinicId: null, // null = system template
                name: template.name,
                subject: template.subject,
                category: template.category,
                designJson: template.designJson,
                htmlContent: template.htmlContent,
                previewText: template.previewText,
                thumbnailUrl: null,
                isSystemTemplate: true,
                isActive: true,
            });
        }

        logger.info(`Seeded ${SYSTEM_TEMPLATES.length} system marketing templates`);
    }

    /**
     * Replace template variables with actual values
     */
    replaceVariables(content: string, variables: Record<string, string>): string {
        let result = content;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            result = result.replace(regex, value || '');
        }
        return result;
    }

    /**
     * Get list of available template variables
     */
    getTemplateVariables() {
        return MARKETING_TEMPLATE_VARIABLES;
    }
}

export const marketingTemplateService = new MarketingTemplateService();
