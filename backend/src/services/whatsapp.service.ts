import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { decrypt } from '../utils/encryption.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

interface WhatsAppCredentials {
    phoneNumberId: string;
    accessToken: string;
}

interface SendMessageResult {
    success: boolean;
    wamid?: string;
    error?: string;
}

/**
 * WhatsApp Cloud API Service
 * Handles all communication with Meta's WhatsApp Business API.
 */
export class WhatsAppService {
    /**
     * Send a text message via WhatsApp Cloud API.
     */
    static async sendTextMessage(
        credentials: WhatsAppCredentials,
        to: string,
        text: string
    ): Promise<SendMessageResult> {
        try {
            const token = decrypt(credentials.accessToken);
            const url = `${GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'text',
                    text: { body: text },
                }),
            });

            const data = await response.json() as any;

            if (!response.ok) {
                logger.error({ status: response.status, data }, 'WhatsApp API error sending message');
                return {
                    success: false,
                    error: data.error?.message || `HTTP ${response.status}`,
                };
            }

            const wamid = data.messages?.[0]?.id;
            logger.info({ to, wamid }, 'WhatsApp message sent successfully');
            return { success: true, wamid };
        } catch (error) {
            logger.error({ error, to }, 'Failed to send WhatsApp message');
            return { success: false, error: String(error) };
        }
    }

    /**
     * Send a template message via WhatsApp Cloud API.
     */
    static async sendTemplateMessage(
        credentials: WhatsAppCredentials,
        to: string,
        templateName: string,
        languageCode: string = 'es',
        components: any[] = []
    ): Promise<SendMessageResult> {
        try {
            const token = decrypt(credentials.accessToken);
            const url = `${GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`;

            const body: any = {
                messaging_product: 'whatsapp',
                to,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: languageCode },
                },
            };

            if (components.length > 0) {
                body.template.components = components;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const data = await response.json() as any;

            if (!response.ok) {
                logger.error({ status: response.status, data }, 'WhatsApp template send error');
                return {
                    success: false,
                    error: data.error?.message || `HTTP ${response.status}`,
                };
            }

            const wamid = data.messages?.[0]?.id;
            logger.info({ to, templateName, wamid }, 'WhatsApp template sent');
            return { success: true, wamid };
        } catch (error) {
            logger.error({ error, to, templateName }, 'Failed to send WhatsApp template');
            return { success: false, error: String(error) };
        }
    }

    /**
     * Mark a message as read.
     */
    static async markAsRead(
        credentials: WhatsAppCredentials,
        wamid: string
    ): Promise<void> {
        try {
            const token = decrypt(credentials.accessToken);
            const url = `${GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`;

            await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: wamid,
                }),
            });
        } catch (error) {
            logger.warn({ error, wamid }, 'Failed to mark WhatsApp message as read');
        }
    }

    /**
     * Download media from WhatsApp (images, documents, audio).
     */
    static async downloadMedia(
        credentials: WhatsAppCredentials,
        mediaId: string
    ): Promise<{ buffer: Buffer; mimeType: string } | null> {
        try {
            const token = decrypt(credentials.accessToken);

            // Step 1: Get media URL
            const metaResponse = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const metaData = await metaResponse.json() as any;

            if (!metaData.url) {
                logger.error({ mediaId, metaData }, 'Failed to get media URL');
                return null;
            }

            // Step 2: Download media
            const mediaResponse = await fetch(metaData.url, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!mediaResponse.ok) {
                logger.error({ mediaId, status: mediaResponse.status }, 'Failed to download media');
                return null;
            }

            const buffer = Buffer.from(await mediaResponse.arrayBuffer());
            const mimeType = metaData.mime_type || 'application/octet-stream';

            return { buffer, mimeType };
        } catch (error) {
            logger.error({ error, mediaId }, 'Error downloading WhatsApp media');
            return null;
        }
    }

    /**
     * Verify webhook callback from Meta.
     */
    static verifyWebhook(
        mode: string,
        token: string,
        challenge: string,
        expectedToken: string
    ): string | null {
        if (mode === 'subscribe' && token === expectedToken) {
            logger.info('WhatsApp webhook verified successfully');
            return challenge;
        }
        logger.warn({ mode, token }, 'WhatsApp webhook verification failed');
        return null;
    }

    /**
     * Parse incoming webhook payload from Meta.
     * Extracts message data from the webhook event.
     */
    static parseWebhookPayload(body: any): ParsedWebhookMessage[] {
        const messages: ParsedWebhookMessage[] = [];

        try {
            const entries = body.entry || [];
            for (const entry of entries) {
                const changes = entry.changes || [];
                for (const change of changes) {
                    const value = change.value;
                    if (!value || change.field !== 'messages') continue;

                    const phoneNumberId = value.metadata?.phone_number_id;
                    const contacts = value.contacts || [];
                    const incomingMessages = value.messages || [];
                    const statuses = value.statuses || [];

                    // Process incoming messages
                    for (const msg of incomingMessages) {
                        const contact = contacts.find((c: any) => c.wa_id === msg.from);
                        messages.push({
                            type: 'message',
                            phoneNumberId,
                            from: msg.from,
                            contactName: contact?.profile?.name || null,
                            wamid: msg.id,
                            timestamp: msg.timestamp,
                            messageType: (msg.type === 'voice' ? 'audio' : msg.type) || 'text',
                            text: msg.text?.body || null,
                            mediaId: msg.image?.id || msg.document?.id || msg.audio?.id || msg.voice?.id || msg.video?.id || null,
                            mimeType: msg.image?.mime_type || msg.document?.mime_type || msg.audio?.mime_type || msg.voice?.mime_type || null,
                            caption: msg.image?.caption || msg.document?.caption || null,
                        });
                    }

                    // Process status updates
                    for (const status of statuses) {
                        messages.push({
                            type: 'status',
                            phoneNumberId,
                            from: status.recipient_id,
                            contactName: null,
                            wamid: status.id,
                            timestamp: status.timestamp,
                            messageType: 'status',
                            text: null,
                            mediaId: null,
                            mimeType: null,
                            caption: null,
                            status: status.status as 'sent' | 'delivered' | 'read' | 'failed',
                        });
                    }
                }
            }
        } catch (error) {
            logger.error({ error }, 'Error parsing WhatsApp webhook payload');
        }

        return messages;
    }

    /**
     * Upload a media file to Meta's servers.
     * Returns the media_id which can be used to send the media in messages.
     */
    static async uploadMedia(
        credentials: WhatsAppCredentials,
        buffer: Buffer,
        mimeType: string,
        filename?: string
    ): Promise<{ mediaId: string } | null> {
        try {
            const token = decrypt(credentials.accessToken);
            const url = `${GRAPH_API_BASE}/${credentials.phoneNumberId}/media`;

            const formData = new FormData();
            const blob = new Blob([buffer], { type: mimeType });
            formData.append('file', blob, filename || 'file');
            formData.append('type', mimeType);
            formData.append('messaging_product', 'whatsapp');

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            const data = await response.json() as any;

            if (!response.ok || !data.id) {
                logger.error({ status: response.status, data }, 'Failed to upload media to WhatsApp');
                return null;
            }

            logger.info({ mediaId: data.id, mimeType }, 'Media uploaded to WhatsApp');
            return { mediaId: data.id };
        } catch (error) {
            logger.error({ error, mimeType }, 'Error uploading media to WhatsApp');
            return null;
        }
    }

    /**
     * Send an image message.
     * Accepts either a mediaId (previously uploaded) or a public URL.
     */
    static async sendImage(
        credentials: WhatsAppCredentials,
        to: string,
        options: { mediaId?: string; url?: string; caption?: string }
    ): Promise<SendMessageResult> {
        try {
            const token = decrypt(credentials.accessToken);
            const apiUrl = `${GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`;

            const imagePayload: any = {};
            if (options.mediaId) imagePayload.id = options.mediaId;
            else if (options.url) imagePayload.link = options.url;
            else return { success: false, error: 'Either mediaId or url is required' };
            if (options.caption) imagePayload.caption = options.caption;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'image',
                    image: imagePayload,
                }),
            });

            const data = await response.json() as any;

            if (!response.ok) {
                logger.error({ status: response.status, data }, 'WhatsApp API error sending image');
                return { success: false, error: data.error?.message || `HTTP ${response.status}` };
            }

            const wamid = data.messages?.[0]?.id;
            logger.info({ to, wamid }, 'WhatsApp image sent');
            return { success: true, wamid };
        } catch (error) {
            logger.error({ error, to }, 'Failed to send WhatsApp image');
            return { success: false, error: String(error) };
        }
    }

    /**
     * Send a document message.
     * Accepts either a mediaId (previously uploaded) or a public URL.
     */
    static async sendDocument(
        credentials: WhatsAppCredentials,
        to: string,
        options: { mediaId?: string; url?: string; filename?: string; caption?: string }
    ): Promise<SendMessageResult> {
        try {
            const token = decrypt(credentials.accessToken);
            const apiUrl = `${GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`;

            const docPayload: any = {};
            if (options.mediaId) docPayload.id = options.mediaId;
            else if (options.url) docPayload.link = options.url;
            else return { success: false, error: 'Either mediaId or url is required' };
            if (options.filename) docPayload.filename = options.filename;
            if (options.caption) docPayload.caption = options.caption;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'document',
                    document: docPayload,
                }),
            });

            const data = await response.json() as any;

            if (!response.ok) {
                logger.error({ status: response.status, data }, 'WhatsApp API error sending document');
                return { success: false, error: data.error?.message || `HTTP ${response.status}` };
            }

            const wamid = data.messages?.[0]?.id;
            logger.info({ to, wamid, filename: options.filename }, 'WhatsApp document sent');
            return { success: true, wamid };
        } catch (error) {
            logger.error({ error, to }, 'Failed to send WhatsApp document');
            return { success: false, error: String(error) };
        }
    }

    /**
     * Test connection by sending a simple message.
     */
    static async testConnection(
        credentials: WhatsAppCredentials,
        testPhone: string
    ): Promise<{ success: boolean; error?: string }> {
        const result = await this.sendTextMessage(
            credentials,
            testPhone,
            '✅ Conexión WhatsApp verificada correctamente desde Cuspia.'
        );
        return { success: result.success, error: result.error };
    }

    /**
     * Get WhatsApp Business Account ID from Phone Number ID.
     */


    /**
     * Get approved message templates from Meta's API.
     */
    static async getMessageTemplates(
        accessToken: string,
        businessAccountId: string
    ): Promise<{ templates: any[]; error?: string }> {
        try {
            const token = decrypt(accessToken);
            const url = `${GRAPH_API_BASE}/${businessAccountId}/message_templates?status=APPROVED&limit=100`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json() as any;

            if (!response.ok) {
                logger.error({ status: response.status, data }, 'Failed to fetch WhatsApp templates');
                return { templates: [], error: data.error?.message || `HTTP ${response.status}` };
            }

            const templates = (data.data || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                language: t.language,
                category: t.category,
                status: t.status,
                components: t.components || [],
            }));

            logger.info({ count: templates.length }, 'Fetched WhatsApp templates');
            return { templates };
        } catch (error) {
            logger.error({ error }, 'Failed to fetch WhatsApp templates');
            return { templates: [], error: String(error) };
        }
    }
}

export interface ParsedWebhookMessage {
    type: 'message' | 'status';
    phoneNumberId: string;
    from: string;
    contactName: string | null;
    wamid: string;
    timestamp: string;
    messageType: string;
    text: string | null;
    mediaId: string | null;
    mimeType: string | null;
    caption: string | null;
    status?: 'sent' | 'delivered' | 'read' | 'failed';
}
