import { eq, and, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
    birthdaySettings,
    birthdayEmailLog,
    marketingTemplates,
    patients,
    clinics
} from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { marketingTemplateService } from './marketing-template.service.js';
import { sendEmail } from './email.service.js';

interface BirthdaySettingsData {
    isEnabled: boolean;
    templateId?: string | null;
    sendHour?: number;
    daysInAdvance?: number;
}

class BirthdayService {
    /**
     * Get birthday settings for a clinic
     */
    async getSettings(clinicId: string) {
        const [settings] = await db
            .select()
            .from(birthdaySettings)
            .where(eq(birthdaySettings.clinicId, clinicId))
            .limit(1);

        if (!settings) {
            // Return default settings
            return {
                id: null,
                clinicId,
                isEnabled: false,
                templateId: null,
                sendHour: 9,
                daysInAdvance: 0,
                createdAt: null,
                updatedAt: null,
            };
        }

        return settings;
    }

    /**
     * Update birthday settings for a clinic
     */
    async updateSettings(clinicId: string, data: BirthdaySettingsData) {
        const existing = await this.getSettings(clinicId);

        if (existing.id) {
            // Update existing
            const [updated] = await db
                .update(birthdaySettings)
                .set({
                    isEnabled: data.isEnabled,
                    templateId: data.templateId ?? null,
                    sendHour: data.sendHour ?? 9,
                    daysInAdvance: data.daysInAdvance ?? 0,
                    updatedAt: new Date(),
                })
                .where(eq(birthdaySettings.id, existing.id))
                .returning();

            logger.info(`Birthday settings updated for clinic ${clinicId}`);
            return updated;
        } else {
            // Create new
            const [created] = await db
                .insert(birthdaySettings)
                .values({
                    clinicId,
                    isEnabled: data.isEnabled,
                    templateId: data.templateId ?? null,
                    sendHour: data.sendHour ?? 9,
                    daysInAdvance: data.daysInAdvance ?? 0,
                })
                .returning();

            logger.info(`Birthday settings created for clinic ${clinicId}`);
            return created;
        }
    }

    /**
     * Get patients with birthday today (or on a specific date)
     */
    async getPatientsWithBirthdayOn(clinicId: string, date: Date = new Date()) {
        const month = date.getMonth() + 1; // getMonth() returns 0-11
        const day = date.getDate();

        const birthdayPatients = await db
            .select()
            .from(patients)
            .where(
                and(
                    eq(patients.clinicId, clinicId),
                    eq(patients.isActive, true),
                    eq(patients.acceptsBirthdayEmails, true),
                    isNotNull(patients.email),
                    isNotNull(patients.dateOfBirth),
                    sql`EXTRACT(MONTH FROM ${patients.dateOfBirth}) = ${month}`,
                    sql`EXTRACT(DAY FROM ${patients.dateOfBirth}) = ${day}`
                )
            );

        return birthdayPatients.filter(p => p.email && p.email.trim() !== '');
    }

    /**
     * Check if birthday email was already sent this year
     */
    async wasEmailSentThisYear(clinicId: string, patientId: string): Promise<boolean> {
        const year = new Date().getFullYear();

        const [log] = await db
            .select()
            .from(birthdayEmailLog)
            .where(
                and(
                    eq(birthdayEmailLog.clinicId, clinicId),
                    eq(birthdayEmailLog.patientId, patientId),
                    eq(birthdayEmailLog.year, year)
                )
            )
            .limit(1);

        return !!log;
    }

    /**
     * Log that a birthday email was sent
     */
    async logBirthdayEmail(clinicId: string, patientId: string) {
        const year = new Date().getFullYear();

        await db
            .insert(birthdayEmailLog)
            .values({
                clinicId,
                patientId,
                year,
                sentAt: new Date(),
            })
            .onConflictDoNothing(); // Prevent duplicates

        logger.info(`Birthday email logged for patient ${patientId} in year ${year}`);
    }

    /**
     * Send birthday email to a single patient
     */
    async sendBirthdayEmail(clinicId: string, patientId: string) {
        // Get settings
        const settings = await this.getSettings(clinicId);
        if (!settings.isEnabled) {
            throw new Error('Birthday emails are not enabled for this clinic');
        }

        if (!settings.templateId) {
            throw new Error('No birthday template configured');
        }

        // Check if already sent this year
        const alreadySent = await this.wasEmailSentThisYear(clinicId, patientId);
        if (alreadySent) {
            logger.info(`Birthday email already sent to patient ${patientId} this year`);
            return { skipped: true, reason: 'Already sent this year' };
        }

        // Get patient
        const [patient] = await db
            .select()
            .from(patients)
            .where(
                and(
                    eq(patients.id, patientId),
                    eq(patients.clinicId, clinicId)
                )
            )
            .limit(1);

        if (!patient) {
            throw new Error('Patient not found');
        }

        if (!patient.email) {
            throw new Error('Patient has no email');
        }

        if (!patient.acceptsBirthdayEmails) {
            return { skipped: true, reason: 'Patient opted out of birthday emails' };
        }

        // Get clinic
        const [clinic] = await db
            .select()
            .from(clinics)
            .where(eq(clinics.id, clinicId))
            .limit(1);

        // Get template
        const template = await marketingTemplateService.getTemplateById(settings.templateId, clinicId);
        if (!template || !template.htmlContent) {
            throw new Error('Birthday template not found or has no content');
        }

        // Prepare variables
        const variables: Record<string, string> = {
            patient_name: `${patient.firstName} ${patient.lastName}`,
            patient_first_name: patient.firstName,
            clinic_name: clinic?.name || '',
            clinic_phone: clinic?.phone || '',
            clinic_address: clinic?.address || '',
            clinic_email: clinic?.email || '',
            unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe/${patient.marketingUnsubscribeToken || patient.id}`,
        };

        // Personalize content
        const html = marketingTemplateService.replaceVariables(template.htmlContent, variables);
        const subject = marketingTemplateService.replaceVariables(template.subject, variables);

        // Send email
        await sendEmail(clinicId, {
            to: patient.email,
            subject,
            html,
        });

        // Log the email
        await this.logBirthdayEmail(clinicId, patientId);

        logger.info(`Birthday email sent to patient ${patientId}`);
        return { sent: true };
    }

    /**
     * Process birthday emails for all clinics (run by cron job)
     * Should be run daily at the configured hour (default 9:00 AM)
     */
    async processBirthdayEmails() {
        logger.info('Starting birthday email processing...');

        // Get all clinics with birthday emails enabled
        const enabledSettings = await db
            .select()
            .from(birthdaySettings)
            .where(eq(birthdaySettings.isEnabled, true));

        const currentHour = new Date().getHours();
        let totalSent = 0;
        let totalFailed = 0;

        for (const settings of enabledSettings) {
            // Check if it's the right hour for this clinic
            if (settings.sendHour !== currentHour) {
                continue;
            }

            try {
                // Calculate target date (today + daysInAdvance)
                const targetDate = new Date();
                if (settings.daysInAdvance > 0) {
                    targetDate.setDate(targetDate.getDate() + settings.daysInAdvance);
                }

                // Get patients with birthday on target date
                const birthdayPatients = await this.getPatientsWithBirthdayOn(
                    settings.clinicId,
                    targetDate
                );

                logger.info(`Found ${birthdayPatients.length} patients with birthday in clinic ${settings.clinicId}`);

                for (const patient of birthdayPatients) {
                    try {
                        const result = await this.sendBirthdayEmail(settings.clinicId, patient.id);
                        if (result.sent) {
                            totalSent++;
                        }
                    } catch (error: any) {
                        logger.error(`Failed to send birthday email to ${patient.id}:`, error);
                        totalFailed++;
                    }
                }
            } catch (error: any) {
                logger.error(`Failed to process birthday emails for clinic ${settings.clinicId}:`, error);
            }
        }

        logger.info(`Birthday email processing complete: ${totalSent} sent, ${totalFailed} failed`);
        return { totalSent, totalFailed };
    }

    /**
     * Send a test birthday email (for testing the template)
     */
    async sendTestEmail(clinicId: string, testEmail: string) {
        const settings = await this.getSettings(clinicId);

        if (!settings.templateId) {
            throw new Error('No birthday template configured');
        }

        // Get clinic
        const [clinic] = await db
            .select()
            .from(clinics)
            .where(eq(clinics.id, clinicId))
            .limit(1);

        // Get template
        const template = await marketingTemplateService.getTemplateById(settings.templateId, clinicId);
        if (!template || !template.htmlContent) {
            throw new Error('Birthday template not found or has no content');
        }

        // Prepare test variables
        const variables: Record<string, string> = {
            patient_name: 'Juan García (TEST)',
            patient_first_name: 'Juan',
            clinic_name: clinic?.name || 'Mi Clínica',
            clinic_phone: clinic?.phone || '123456789',
            clinic_address: clinic?.address || 'Calle Principal 1',
            clinic_email: clinic?.email || 'info@clinica.com',
            unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe/test`,
        };

        const html = marketingTemplateService.replaceVariables(template.htmlContent, variables);
        const subject = marketingTemplateService.replaceVariables(template.subject, variables);

        await sendEmail(clinicId, {
            to: testEmail,
            subject: `[TEST] ${subject}`,
            html,
        });

        logger.info(`Test birthday email sent to ${testEmail}`);
        return { sent: true, email: testEmail };
    }
}

export const birthdayService = new BirthdayService();
