import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
    marketingCampaigns,
    campaignRecipients,
    marketingTemplates,
    patients,
    clinics
} from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { audienceService } from './audience.service.js';
import { marketingTemplateService } from './marketing-template.service.js';
import { sendEmail } from './email.service.js';

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'PAUSED' | 'CANCELLED';

interface CreateCampaignData {
    name: string;
    subject: string;
    templateId?: string;
    segmentId?: string;
    htmlContent?: string;
    scheduledAt?: Date;
}

interface UpdateCampaignData {
    name?: string;
    subject?: string;
    templateId?: string;
    segmentId?: string;
    htmlContent?: string;
    scheduledAt?: Date;
    status?: CampaignStatus;
}

interface SendCampaignOptions {
    batchSize?: number;
    delayMs?: number;
}

class CampaignService {
    private readonly DEFAULT_BATCH_SIZE = 50;
    private readonly DEFAULT_DELAY_MS = 1000;

    /**
     * Get all campaigns for a clinic
     */
    async getCampaigns(clinicId: string) {
        return db
            .select({
                id: marketingCampaigns.id,
                clinicId: marketingCampaigns.clinicId,
                templateId: marketingCampaigns.templateId,
                segmentId: marketingCampaigns.segmentId,
                name: marketingCampaigns.name,
                subject: marketingCampaigns.subject,
                status: marketingCampaigns.status,
                scheduledAt: marketingCampaigns.scheduledAt,
                sentAt: marketingCampaigns.sentAt,
                totalRecipients: marketingCampaigns.totalRecipients,
                sentCount: marketingCampaigns.sentCount,
                failedCount: marketingCampaigns.failedCount,
                createdAt: marketingCampaigns.createdAt,
            })
            .from(marketingCampaigns)
            .where(eq(marketingCampaigns.clinicId, clinicId))
            .orderBy(desc(marketingCampaigns.createdAt));
    }

    /**
     * Get a specific campaign with details
     */
    async getCampaignById(id: string, clinicId: string) {
        const [campaign] = await db
            .select()
            .from(marketingCampaigns)
            .where(
                and(
                    eq(marketingCampaigns.id, id),
                    eq(marketingCampaigns.clinicId, clinicId)
                )
            )
            .limit(1);

        return campaign || null;
    }

    /**
     * Create a new campaign
     */
    async createCampaign(clinicId: string, userId: string, data: CreateCampaignData) {
        const [campaign] = await db
            .insert(marketingCampaigns)
            .values({
                clinicId,
                createdById: userId,
                name: data.name,
                subject: data.subject,
                templateId: data.templateId || null,
                segmentId: data.segmentId || null,
                htmlContent: data.htmlContent || null,
                status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
                scheduledAt: data.scheduledAt || null,
            })
            .returning();

        logger.info(`Campaign created: ${campaign.id} for clinic ${clinicId}`);
        return campaign;
    }

    /**
     * Update a campaign (only if not sent)
     */
    async updateCampaign(id: string, clinicId: string, data: UpdateCampaignData) {
        const existing = await this.getCampaignById(id, clinicId);
        if (!existing) {
            throw new Error('Campaign not found');
        }

        if (existing.status === 'SENT' || existing.status === 'SENDING') {
            throw new Error('Cannot modify a campaign that has been sent or is sending');
        }

        const [updated] = await db
            .update(marketingCampaigns)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(marketingCampaigns.id, id))
            .returning();

        logger.info(`Campaign updated: ${id}`);
        return updated;
    }

    /**
     * Delete a campaign (only if draft or cancelled)
     */
    async deleteCampaign(id: string, clinicId: string) {
        const existing = await this.getCampaignById(id, clinicId);
        if (!existing) {
            throw new Error('Campaign not found');
        }

        if (!['DRAFT', 'CANCELLED'].includes(existing.status)) {
            throw new Error('Only draft or cancelled campaigns can be deleted');
        }

        await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
        logger.info(`Campaign deleted: ${id}`);
        return true;
    }

    /**
     * Send a campaign immediately
     */
    async sendCampaign(id: string, clinicId: string, options: SendCampaignOptions = {}) {
        const campaign = await this.getCampaignById(id, clinicId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
            throw new Error(`Campaign cannot be sent (current status: ${campaign.status})`);
        }

        // Update status to SENDING
        await db
            .update(marketingCampaigns)
            .set({ status: 'SENDING', updatedAt: new Date() })
            .where(eq(marketingCampaigns.id, id));

        try {
            // Get clinic info for template variables
            const [clinic] = await db
                .select()
                .from(clinics)
                .where(eq(clinics.id, clinicId))
                .limit(1);

            // Get recipients
            let recipientPatients: any[] = [];

            if (campaign.segmentId) {
                // Get patients from segment
                recipientPatients = await audienceService.getPatientsForSegment(
                    campaign.segmentId,
                    clinicId
                );
            } else {
                // Get all active patients with email who accept marketing
                recipientPatients = await db
                    .select()
                    .from(patients)
                    .where(
                        and(
                            eq(patients.clinicId, clinicId),
                            eq(patients.isActive, true),
                            eq(patients.acceptsMarketing, true)
                        )
                    );
            }

            // Filter to only patients with valid email
            recipientPatients = recipientPatients.filter(p => p.email && p.email.trim() !== '');

            // Create recipient records
            const recipientRecords = recipientPatients.map(p => ({
                campaignId: id,
                patientId: p.id,
                email: p.email,
                status: 'pending',
            }));

            if (recipientRecords.length > 0) {
                await db.insert(campaignRecipients).values(recipientRecords);
            }

            // Update total recipients count
            await db
                .update(marketingCampaigns)
                .set({
                    totalRecipients: recipientRecords.length,
                    updatedAt: new Date(),
                })
                .where(eq(marketingCampaigns.id, id));

            // Get template HTML if templateId is set
            let htmlContent = campaign.htmlContent;
            if (campaign.templateId && !htmlContent) {
                const template = await marketingTemplateService.getTemplateById(
                    campaign.templateId,
                    clinicId
                );
                if (template) {
                    htmlContent = template.htmlContent;
                }
            }

            if (!htmlContent) {
                throw new Error('No HTML content available for this campaign');
            }

            // Send emails in batches
            const batchSize = options.batchSize || this.DEFAULT_BATCH_SIZE;
            const delayMs = options.delayMs || this.DEFAULT_DELAY_MS;
            let sentCount = 0;
            let failedCount = 0;

            for (let i = 0; i < recipientPatients.length; i += batchSize) {
                const batch = recipientPatients.slice(i, i + batchSize);

                for (const patient of batch) {
                    try {
                        // Replace variables in HTML
                        const variables: Record<string, string> = {
                            patient_name: `${patient.firstName} ${patient.lastName}`,
                            patient_first_name: patient.firstName,
                            clinic_name: clinic?.name || '',
                            clinic_phone: clinic?.phone || '',
                            clinic_address: clinic?.address || '',
                            clinic_email: clinic?.email || '',
                            unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe/${patient.marketingUnsubscribeToken || patient.id}`,
                        };

                        const personalizedHtml = marketingTemplateService.replaceVariables(htmlContent!, variables);
                        const personalizedSubject = marketingTemplateService.replaceVariables(campaign.subject, variables);

                        // Send email
                        await sendEmail(clinicId, {
                            to: patient.email,
                            subject: personalizedSubject,
                            html: personalizedHtml,
                        });

                        // Update recipient status
                        await db
                            .update(campaignRecipients)
                            .set({ status: 'sent', sentAt: new Date() })
                            .where(
                                and(
                                    eq(campaignRecipients.campaignId, id),
                                    eq(campaignRecipients.patientId, patient.id)
                                )
                            );

                        sentCount++;
                    } catch (error: any) {
                        logger.error(`Failed to send campaign email to ${patient.email}:`, error);

                        // Update recipient with error
                        await db
                            .update(campaignRecipients)
                            .set({
                                status: 'failed',
                                errorMessage: error.message || 'Unknown error',
                            })
                            .where(
                                and(
                                    eq(campaignRecipients.campaignId, id),
                                    eq(campaignRecipients.patientId, patient.id)
                                )
                            );

                        failedCount++;
                    }
                }

                // Update progress
                await db
                    .update(marketingCampaigns)
                    .set({
                        sentCount,
                        failedCount,
                        updatedAt: new Date(),
                    })
                    .where(eq(marketingCampaigns.id, id));

                // Delay between batches
                if (i + batchSize < recipientPatients.length) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }

            // Mark as sent
            await db
                .update(marketingCampaigns)
                .set({
                    status: 'SENT',
                    sentAt: new Date(),
                    sentCount,
                    failedCount,
                    updatedAt: new Date(),
                })
                .where(eq(marketingCampaigns.id, id));

            logger.info(`Campaign ${id} sent: ${sentCount} sent, ${failedCount} failed`);

            return {
                totalRecipients: recipientPatients.length,
                sentCount,
                failedCount,
            };
        } catch (error) {
            // Mark as failed (back to draft)
            await db
                .update(marketingCampaigns)
                .set({ status: 'DRAFT', updatedAt: new Date() })
                .where(eq(marketingCampaigns.id, id));

            throw error;
        }
    }

    /**
     * Cancel a campaign in progress
     */
    async cancelCampaign(id: string, clinicId: string) {
        const existing = await this.getCampaignById(id, clinicId);
        if (!existing) {
            throw new Error('Campaign not found');
        }

        if (existing.status === 'SENT') {
            throw new Error('Cannot cancel a campaign that has already been sent');
        }

        await db
            .update(marketingCampaigns)
            .set({ status: 'CANCELLED', updatedAt: new Date() })
            .where(eq(marketingCampaigns.id, id));

        logger.info(`Campaign cancelled: ${id}`);
        return true;
    }

    /**
     * Get recipients for a campaign
     */
    async getCampaignRecipients(campaignId: string, clinicId: string) {
        // Verify campaign belongs to clinic
        const campaign = await this.getCampaignById(campaignId, clinicId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        return db
            .select({
                id: campaignRecipients.id,
                patientId: campaignRecipients.patientId,
                email: campaignRecipients.email,
                status: campaignRecipients.status,
                sentAt: campaignRecipients.sentAt,
                errorMessage: campaignRecipients.errorMessage,
            })
            .from(campaignRecipients)
            .where(eq(campaignRecipients.campaignId, campaignId));
    }
}

export const campaignService = new CampaignService();
