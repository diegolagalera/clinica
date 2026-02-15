import { Router, Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { ChatbotConversationService } from '../services/chatbot-conversation.service.js';
import { whatsappSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { tenantManager } from '../db/tenant-manager.js';

const router = Router();

/**
 * GET /api/v1/whatsapp/webhook/:tenantSlug
 * Webhook verification endpoint for Meta.
 * No auth required — Meta calls this to verify the webhook URL.
 * The tenant is resolved directly from the URL slug.
 */
router.get('/webhook/:tenantSlug', async (req: Request, res: Response) => {
    const tenantSlug = req.params.tenantSlug as string;
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (mode !== 'subscribe' || !token || !challenge) {
        return res.sendStatus(403);
    }

    try {
        const db = await tenantManager.getConnection(tenantSlug);

        // Find any clinic in this tenant whose webhookVerifyToken matches
        const clinicSettings = await db
            .select({ webhookVerifyToken: whatsappSettings.webhookVerifyToken })
            .from(whatsappSettings);

        const match = clinicSettings.some((s) => s.webhookVerifyToken === token);

        if (match) {
            logger.info({ tenant: tenantSlug }, 'Webhook verified successfully');
            return res.status(200).send(challenge);
        }

        logger.warn({ tenant: tenantSlug, token }, 'Webhook verification failed — token mismatch');
        return res.sendStatus(403);
    } catch (err) {
        logger.error({ tenantSlug, err }, 'Failed to resolve tenant for webhook verification');
        return res.sendStatus(403);
    }
});

/**
 * POST /api/v1/whatsapp/webhook/:tenantSlug
 * Receives incoming messages and status updates from Meta.
 * No auth required — webhook payload validated by structure.
 * The tenant is resolved directly from the URL slug.
 */
router.post('/webhook/:tenantSlug', async (req: Request, res: Response) => {
    // Always respond 200 immediately to Meta (they require it within 15s)
    res.sendStatus(200);

    const tenantSlug = req.params.tenantSlug as string;

    try {
        const db = await tenantManager.getConnection(tenantSlug);
        const parsed = WhatsAppService.parseWebhookPayload(req.body);

        for (const message of parsed) {
            // Find clinic by phone_number_id within this tenant
            const [settings] = await db
                .select()
                .from(whatsappSettings)
                .where(eq(whatsappSettings.phoneNumberId, message.phoneNumberId));

            if (!settings) {
                logger.warn({ tenant: tenantSlug, phoneNumberId: message.phoneNumberId }, 'No clinic found for this phone_number_id');
                continue;
            }

            // Kill switch: if the module is disabled, skip message processing (status updates still flow)
            if (!settings.isEnabled && message.type === 'message') {
                logger.info({ tenant: tenantSlug, clinicId: settings.clinicId, isEnabled: settings.isEnabled }, 'WhatsApp module disabled, skipping message');
                continue;
            }

            if (message.type === 'message') {
                await ChatbotConversationService.processIncomingMessage(db, message, settings.clinicId, tenantSlug);
            } else if (message.type === 'status') {
                await ChatbotConversationService.processStatusUpdate(db, message);
            }
        }
    } catch (error) {
        logger.error({ tenantSlug, error }, 'Error processing webhook payload');
    }
});

export default router;
