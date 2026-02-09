import { Router, Request, Response } from 'express';
import { config } from '../config/env.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { ChatbotConversationService } from '../services/chatbot-conversation.service.js';
import { whatsappSettings } from '../db/schema.js';
import { db } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/whatsapp/webhook
 * Webhook verification endpoint for Meta.
 * No auth required — Meta calls this to verify the webhook URL.
 * Checks the verify token against all clinic settings in the DB,
 * with a fallback to the WHATSAPP_VERIFY_TOKEN env var.
 */
router.get('/webhook', async (req: Request, res: Response) => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (mode !== 'subscribe' || !token || !challenge) {
        return res.sendStatus(403);
    }

    // 1. Check against tokens stored in the DB (from the Settings page)
    const clinicSettings = await db
        .select({ webhookVerifyToken: whatsappSettings.webhookVerifyToken })
        .from(whatsappSettings);

    const dbMatch = clinicSettings.some(s => s.webhookVerifyToken === token);

    // 2. Fallback: check against env var
    const envToken = config.whatsapp.verifyToken;
    const envMatch = envToken && envToken === token;

    if (dbMatch || envMatch) {
        logger.info('Webhook verified successfully');
        return res.status(200).send(challenge);
    }

    logger.warn({ token }, 'Webhook verification failed — token mismatch');
    return res.sendStatus(403);
});

/**
 * POST /api/v1/whatsapp/webhook
 * Receives incoming messages and status updates from Meta.
 * No auth required — webhook payload validated by structure.
 */
router.post('/webhook', async (req: Request, res: Response) => {
    // Always respond 200 immediately to Meta (they require it within 15s)
    res.sendStatus(200);

    try {
        const parsed = WhatsAppService.parseWebhookPayload(req.body);

        for (const message of parsed) {
            // Find clinic by phone_number_id
            const [settings] = await db
                .select()
                .from(whatsappSettings)
                .where(eq(whatsappSettings.phoneNumberId, message.phoneNumberId));

            if (!settings) {
                logger.warn({ phoneNumberId: message.phoneNumberId }, 'No clinic found for this phone_number_id');
                continue;
            }

            if (message.type === 'message') {
                await ChatbotConversationService.processIncomingMessage(message, settings.clinicId);
                // WebSocket events (inbound + AI reply) are emitted inside processIncomingMessage
            } else if (message.type === 'status') {
                await ChatbotConversationService.processStatusUpdate(message);
            }
        }
    } catch (error) {
        logger.error({ error }, 'Error processing webhook payload');
    }
});

export default router;
