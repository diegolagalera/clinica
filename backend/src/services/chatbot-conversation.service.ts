import { db } from '../db/index.js';
import {
    chatConversations,
    chatMessages,
    chatLeads,
    whatsappSettings,
    patients,
    chatConversationNotes,
    chatQuickReplies,
} from '../db/schema.js';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { WhatsAppService, type ParsedWebhookMessage } from './whatsapp.service.js';
import { ChatbotAiService } from './chatbot-ai.service.js';
import { decrypt } from '../utils/encryption.js';
import { emitToClinic } from '../websocket.js';
import fs from 'fs';
import path from 'path';

/**
 * Conversation Engine Service
 * Manages conversation lifecycle, message routing, patient/lead detection,
 * and AI vs human control modes.
 */
export class ChatbotConversationService {

    // ========================================================================
    // Settings
    // ========================================================================

    static async getSettings(clinicId: string) {
        const [settings] = await db
            .select()
            .from(whatsappSettings)
            .where(eq(whatsappSettings.clinicId, clinicId));

        if (!settings) return null;

        // Mask the access token for security
        return {
            ...settings,
            accessToken: settings.accessToken ? '••••••••' : null,
        };
    }

    static async getSettingsRaw(clinicId: string) {
        const [settings] = await db
            .select()
            .from(whatsappSettings)
            .where(eq(whatsappSettings.clinicId, clinicId));
        return settings || null;
    }

    // ========================================================================
    // Conversations
    // ========================================================================

    static async getConversations(clinicId: string, filters?: {
        status?: string;
        controlMode?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }) {
        const conditions = [eq(chatConversations.clinicId, clinicId)];

        if (filters?.status) {
            conditions.push(eq(chatConversations.status, filters.status as any));
        }
        if (filters?.controlMode) {
            conditions.push(eq(chatConversations.controlMode, filters.controlMode as any));
        }

        let query = db
            .select()
            .from(chatConversations)
            .where(and(...conditions))
            .orderBy(desc(chatConversations.lastMessageAt))
            .limit(filters?.limit || 50)
            .offset(filters?.offset || 0);

        const conversations = await query;

        // Enrich with last message preview
        const enriched = await Promise.all(
            conversations.map(async (conv) => {
                const [lastMessage] = await db
                    .select()
                    .from(chatMessages)
                    .where(eq(chatMessages.conversationId, conv.id))
                    .orderBy(desc(chatMessages.createdAt))
                    .limit(1);

                return {
                    ...conv,
                    lastMessage: lastMessage
                        ? {
                            content: lastMessage.content?.substring(0, 100) || null,
                            direction: lastMessage.direction,
                            isFromAi: lastMessage.isFromAi,
                            createdAt: lastMessage.createdAt,
                        }
                        : null,
                };
            })
        );

        return enriched;
    }

    static async getConversation(conversationId: string, clinicId: string) {
        const [conversation] = await db
            .select()
            .from(chatConversations)
            .where(and(
                eq(chatConversations.id, conversationId),
                eq(chatConversations.clinicId, clinicId)
            ));
        return conversation || null;
    }

    static async getConversationMessages(conversationId: string, clinicId: string, limit = 50, offset = 0) {
        return db
            .select()
            .from(chatMessages)
            .where(and(
                eq(chatMessages.conversationId, conversationId),
                eq(chatMessages.clinicId, clinicId)
            ))
            .orderBy(desc(chatMessages.createdAt))
            .limit(limit)
            .offset(offset);
    }

    // ========================================================================
    // Incoming Message Processing (Webhook)
    // ========================================================================

    /**
     * Process an incoming WhatsApp message from the webhook.
     * This is the main entry point for the conversation engine.
     */
    static async processIncomingMessage(message: ParsedWebhookMessage, clinicId: string) {
        try {
            // 1. Find or create conversation
            const conversation = await this.findOrCreateConversation(
                clinicId,
                message.from,
                message.contactName
            );

            // Determine if this is a media message
            const isMediaMessage = message.messageType !== 'text' && message.messageType !== 'status';

            // 2. Save inbound message
            const [savedMessage] = await db.insert(chatMessages).values({
                conversationId: conversation.id,
                clinicId,
                direction: 'INBOUND',
                content: isMediaMessage
                    ? message.caption || `📎 ${this.getMediaLabel(message.messageType)}`
                    : message.text,
                messageType: message.messageType,
                wamid: message.wamid,
                status: 'DELIVERED',
                metadata: {
                    mediaId: message.mediaId,
                    mimeType: message.mimeType,
                    caption: message.caption,
                },
            }).returning();

            // 2.5 If media, download and store locally
            if (isMediaMessage && message.mediaId) {
                const settings = await this.getSettingsRaw(clinicId);
                if (settings?.accessToken && settings.phoneNumberId) {
                    try {
                        const media = await WhatsAppService.downloadMedia(
                            { phoneNumberId: settings.phoneNumberId, accessToken: settings.accessToken },
                            message.mediaId
                        );
                        if (media) {
                            const mediaUrl = await this.saveMediaFile(
                                media.buffer, media.mimeType,
                                clinicId, conversation!.id, savedMessage.id
                            );
                            // Update message with local media URL
                            await db.update(chatMessages).set({ mediaUrl })
                                .where(eq(chatMessages.id, savedMessage.id));
                            (savedMessage as any).mediaUrl = mediaUrl;
                        }
                    } catch (err) {
                        logger.error({ err, mediaId: message.mediaId }, 'Failed to download inbound media');
                    }
                }
            }

            // 3. Update conversation timestamp + unread count
            await db.update(chatConversations).set({
                lastMessageAt: new Date(),
                unreadCount: sql`${chatConversations.unreadCount} + 1`,
                updatedAt: new Date(),
                // Update name if we have one from the push name
                ...(message.contactName && { waContactName: message.contactName }),
            }).where(eq(chatConversations.id, conversation.id));

            // 3.5 Emit inbound message via WebSocket BEFORE AI response
            // This ensures the user's question appears before the AI reply
            emitToClinic(clinicId, 'chatbot:new-message', {
                conversationId: conversation.id,
                message: {
                    id: savedMessage.id,
                    conversationId: savedMessage.conversationId,
                    direction: savedMessage.direction,
                    content: savedMessage.content,
                    messageType: savedMessage.messageType,
                    mediaUrl: (savedMessage as any).mediaUrl || null,
                    isFromAi: false,
                    status: savedMessage.status,
                    createdAt: savedMessage.createdAt,
                },
                from: message.from,
                contactName: message.contactName,
            });

            // 4. Mark as read on WhatsApp
            const settingsForRead = await this.getSettingsRaw(clinicId);
            if (settingsForRead?.accessToken && settingsForRead.phoneNumberId) {
                WhatsAppService.markAsRead(
                    { phoneNumberId: settingsForRead.phoneNumberId, accessToken: settingsForRead.accessToken },
                    message.wamid
                ).catch(() => { });
            }

            // 5. If media message → bypass AI, switch to HUMAN mode (data protection)
            if (isMediaMessage) {
                if (conversation.controlMode === 'AI') {
                    await this.switchControlMode(conversation.id, clinicId, 'HUMAN');
                    logger.info({ conversationId: conversation.id }, 'Auto-switched to HUMAN mode — media received (data protection)');
                }
                // DO NOT pass media to AI
                return { conversation, message: savedMessage };
            }

            // 6. If in AI mode, generate and send response (text only)
            if (conversation.controlMode === 'AI' && settingsForRead?.autoReplyEnabled) {
                await this.handleAiResponse(conversation.id, clinicId, message.text || '', settingsForRead);
            }

            return { conversation, message: savedMessage };
        } catch (error) {
            logger.error({ error, from: message.from, clinicId }, 'Failed to process incoming message');
            throw error;
        }
    }

    /**
     * Process a status update from WhatsApp webhook.
     */
    static async processStatusUpdate(message: ParsedWebhookMessage) {
        if (!message.status || !message.wamid) return;

        const statusMap: Record<string, string> = {
            sent: 'SENT',
            delivered: 'DELIVERED',
            read: 'READ',
            failed: 'FAILED',
        };

        const newStatus = statusMap[message.status];
        if (!newStatus) return;

        await db.update(chatMessages)
            .set({ status: newStatus as any })
            .where(eq(chatMessages.wamid, message.wamid))
            .catch(err => {
                logger.warn({ error: err, wamid: message.wamid }, 'Failed to update message status');
            });
    }

    // ========================================================================
    // Conversation Management
    // ========================================================================

    /**
     * Find an existing active conversation or create a new one.
     * Also handles patient/lead identification.
     */
    static async findOrCreateConversation(
        clinicId: string,
        phone: string,
        contactName: string | null,
    ) {
        // Check for existing conversation with this phone (one continuous thread per contact)
        const [existing] = await db
            .select()
            .from(chatConversations)
            .where(and(
                eq(chatConversations.clinicId, clinicId),
                eq(chatConversations.waContactPhone, phone),
            ));

        if (existing) return existing;

        // Look up patient by phone
        const patient = await this.findPatientByPhone(clinicId, phone);

        // Look up or create lead if no patient
        let leadId: string | null = null;
        if (!patient) {
            const lead = await this.findOrCreateLead(clinicId, phone, contactName);
            leadId = lead.id;
        }

        // Create new conversation
        const [conversation] = await db.insert(chatConversations).values({
            clinicId,
            patientId: patient?.id || null,
            leadId,
            waContactPhone: phone,
            waContactName: contactName,
            status: 'ACTIVE',
            controlMode: 'AI',
            lastMessageAt: new Date(),
        }).returning();

        logger.info({
            conversationId: conversation.id,
            clinicId,
            phone,
            isPatient: !!patient,
            isLead: !!leadId,
        }, 'New conversation created');

        return conversation;
    }

    /**
     * Find a patient by phone number. Searches with and without country prefix.
     */
    static async findPatientByPhone(clinicId: string, phone: string) {
        // Try exact match first
        const [patient] = await db
            .select({
                id: patients.id,
                firstName: patients.firstName,
                lastName: patients.lastName,
                email: patients.email,
                phone: patients.phone,
            })
            .from(patients)
            .where(and(
                eq(patients.clinicId, clinicId),
                eq(patients.phone, phone),
                eq(patients.isActive, true)
            ));

        if (patient) return patient;

        // Try matching without leading + or country code
        const phoneDigits = phone.replace(/\D/g, '');
        const lastNine = phoneDigits.slice(-9); // Last 9 digits (local number)

        const [byPartial] = await db
            .select({
                id: patients.id,
                firstName: patients.firstName,
                lastName: patients.lastName,
                email: patients.email,
                phone: patients.phone,
            })
            .from(patients)
            .where(and(
                eq(patients.clinicId, clinicId),
                ilike(patients.phone, `%${lastNine}`),
                eq(patients.isActive, true)
            ));

        return byPartial || null;
    }

    /**
     * Find an existing lead or create a new one.
     */
    static async findOrCreateLead(clinicId: string, phone: string, name: string | null) {
        const [existing] = await db
            .select()
            .from(chatLeads)
            .where(and(
                eq(chatLeads.clinicId, clinicId),
                eq(chatLeads.phone, phone)
            ));

        if (existing) return existing;

        const [lead] = await db.insert(chatLeads).values({
            clinicId,
            phone,
            firstName: name || null,
            source: 'whatsapp',
            status: 'NEW',
        }).returning();

        logger.info({ leadId: lead.id, clinicId, phone }, 'New lead created from WhatsApp');
        return lead;
    }

    // ========================================================================
    // AI Response Handling
    // ========================================================================

    private static async handleAiResponse(
        conversationId: string,
        clinicId: string,
        userMessageText: string,
        settings: any
    ) {
        try {
            if (!userMessageText) return;

            // Get conversation history
            const history = await db
                .select({
                    content: chatMessages.content,
                    direction: chatMessages.direction,
                })
                .from(chatMessages)
                .where(eq(chatMessages.conversationId, conversationId))
                .orderBy(chatMessages.createdAt)
                .limit(20);

            const conversationHistory = history
                .filter(m => m.content)
                .map(m => ({
                    role: m.direction === 'INBOUND' ? 'user' : 'assistant',
                    content: m.content!,
                }));

            // Generate AI response
            const aiResult = await ChatbotAiService.generateResponse(
                clinicId,
                conversationId,
                userMessageText,
                conversationHistory,
                settings.systemPrompt,
            );

            // Send via WhatsApp
            const sendResult = await WhatsAppService.sendTextMessage(
                { phoneNumberId: settings.phoneNumberId, accessToken: settings.accessToken },
                (await this.getConversation(conversationId, clinicId))?.waContactPhone || '',
                aiResult.response
            );

            // Save outbound message
            const [savedAiMessage] = await db.insert(chatMessages).values({
                conversationId,
                clinicId,
                direction: 'OUTBOUND',
                content: aiResult.response,
                messageType: 'text',
                wamid: sendResult.wamid || null,
                status: sendResult.success ? 'SENT' : 'FAILED',
                isFromAi: true,
                errorMessage: sendResult.error || null,
            }).returning();

            // Emit WebSocket event so frontend shows the AI reply in real-time
            if (savedAiMessage) {
                emitToClinic(clinicId, 'chatbot:new-message', {
                    conversationId,
                    message: {
                        id: savedAiMessage.id,
                        content: savedAiMessage.content,
                        direction: savedAiMessage.direction,
                        messageType: savedAiMessage.messageType,
                        isFromAi: true,
                        status: savedAiMessage.status,
                        createdAt: savedAiMessage.createdAt,
                    },
                });
            }

        } catch (error) {
            logger.error({ error, conversationId }, 'Failed to handle AI response');
        }
    }

    // ========================================================================
    // Control Mode (Human Takeover)
    // ========================================================================

    /**
     * Switch conversation control mode (AI → HUMAN or back).
     */
    static async switchControlMode(
        conversationId: string,
        clinicId: string,
        mode: 'AI' | 'HUMAN' | 'PAUSED',
        assignedToId?: string
    ) {
        const [updated] = await db
            .update(chatConversations)
            .set({
                controlMode: mode,
                assignedToId: mode === 'HUMAN' ? assignedToId || null : null,
                updatedAt: new Date(),
            })
            .where(and(
                eq(chatConversations.id, conversationId),
                eq(chatConversations.clinicId, clinicId)
            ))
            .returning();

        logger.info({ conversationId, mode, assignedToId }, 'Conversation control mode changed');
        return updated;
    }

    /**
     * Send a manual (human) message.
     */
    static async sendHumanMessage(
        conversationId: string,
        clinicId: string,
        userId: string,
        text: string
    ) {
        const conversation = await this.getConversation(conversationId, clinicId);
        if (!conversation) throw new Error('Conversation not found');

        const settings = await this.getSettingsRaw(clinicId);
        if (!settings?.accessToken || !settings.phoneNumberId) {
            throw new Error('WhatsApp not configured for this clinic');
        }

        // Send via WhatsApp API
        const result = await WhatsAppService.sendTextMessage(
            { phoneNumberId: settings.phoneNumberId, accessToken: settings.accessToken },
            conversation.waContactPhone,
            text
        );

        // Save message
        const [message] = await db.insert(chatMessages).values({
            conversationId,
            clinicId,
            direction: 'OUTBOUND',
            content: text,
            messageType: 'text',
            wamid: result.wamid || null,
            status: result.success ? 'SENT' : 'FAILED',
            isFromAi: false,
            sentById: userId,
            errorMessage: result.error || null,
        }).returning();

        // Update conversation
        await db.update(chatConversations).set({
            lastMessageAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(chatConversations.id, conversationId));

        return message;
    }

    /**
     * Get a human-readable label for a media message type.
     */
    private static getMediaLabel(messageType: string): string {
        switch (messageType) {
            case 'image': return 'Imagen';
            case 'document': return 'Documento';
            case 'audio': return 'Audio';
            case 'video': return 'Vídeo';
            case 'sticker': return 'Sticker';
            default: return 'Archivo';
        }
    }

    /**
     * Save a downloaded media file to local storage.
     * Returns the relative URL path for serving.
     */
    private static async saveMediaFile(
        buffer: Buffer,
        mimeType: string,
        clinicId: string,
        conversationId: string,
        messageId: string
    ): Promise<string> {
        const ext = this.mimeToExtension(mimeType);
        const dir = path.join(process.cwd(), 'uploads', 'whatsapp-media', clinicId, conversationId);
        fs.mkdirSync(dir, { recursive: true });

        const filename = `${messageId}${ext}`;
        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, buffer);

        logger.info({ filePath, size: buffer.length, mimeType }, 'Media file saved');
        return `/uploads/whatsapp-media/${clinicId}/${conversationId}/${filename}`;
    }

    /**
     * Map MIME type to file extension.
     */
    private static mimeToExtension(mimeType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'audio/ogg': '.ogg',
            'audio/mpeg': '.mp3',
            'audio/aac': '.aac',
            'video/mp4': '.mp4',
            'application/pdf': '.pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        };
        return map[mimeType] || '.bin';
    }

    /**
     * Send a media message (image or document) from a human agent.
     * Uploads the file to Meta, sends it to the patient, and saves the message.
     */
    static async sendHumanMediaMessage(
        conversationId: string,
        clinicId: string,
        userId: string,
        file: { buffer: Buffer; mimetype: string; originalname: string },
        caption?: string
    ) {
        const conversation = await this.getConversation(conversationId, clinicId);
        if (!conversation) throw new Error('Conversation not found');

        const settings = await this.getSettingsRaw(clinicId);
        if (!settings?.accessToken || !settings.phoneNumberId) {
            throw new Error('WhatsApp not configured for this clinic');
        }

        const credentials = {
            phoneNumberId: settings.phoneNumberId,
            accessToken: settings.accessToken,
        };

        // 1. Upload media to Meta
        const uploaded = await WhatsAppService.uploadMedia(
            credentials,
            file.buffer,
            file.mimetype,
            file.originalname
        );

        if (!uploaded) {
            throw new Error('Failed to upload media to WhatsApp');
        }

        // 2. Determine media type and send
        const isImage = file.mimetype.startsWith('image/');
        let result;

        if (isImage) {
            result = await WhatsAppService.sendImage(credentials, conversation.waContactPhone, {
                mediaId: uploaded.mediaId,
                ...(caption ? { caption } : {}),
            });
        } else {
            result = await WhatsAppService.sendDocument(credentials, conversation.waContactPhone, {
                mediaId: uploaded.mediaId,
                filename: file.originalname,
                ...(caption ? { caption } : {}),
            });
        }

        // 3. Save file locally
        const mediaUrl = await this.saveMediaFile(
            file.buffer,
            file.mimetype,
            clinicId,
            conversationId,
            `out-${Date.now()}`
        );

        // 4. Save message to DB
        const messageType = isImage ? 'image' : 'document';
        const [message] = await db.insert(chatMessages).values({
            conversationId,
            clinicId,
            direction: 'OUTBOUND',
            content: caption || `📎 ${file.originalname}`,
            messageType,
            mediaUrl,
            wamid: result.wamid || null,
            status: result.success ? 'SENT' : 'FAILED',
            isFromAi: false,
            sentById: userId,
            errorMessage: result.error || null,
            metadata: {
                originalFilename: file.originalname,
                mimeType: file.mimetype,
                mediaId: uploaded.mediaId,
            },
        }).returning();

        // 5. Update conversation
        await db.update(chatConversations).set({
            lastMessageAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(chatConversations.id, conversationId));

        return message;
    }

    /**
     * Close a conversation.
     */
    static async closeConversation(
        conversationId: string,
        clinicId: string,
        closedById: string
    ) {
        const [updated] = await db
            .update(chatConversations)
            .set({
                status: 'CLOSED',
                closedAt: new Date(),
                closedById,
                updatedAt: new Date(),
            })
            .where(and(
                eq(chatConversations.id, conversationId),
                eq(chatConversations.clinicId, clinicId)
            ))
            .returning();
        return updated;
    }

    /**
     * Mark all messages in a conversation as read (internal).
     */
    static async markConversationAsRead(conversationId: string, clinicId: string) {
        await db.update(chatConversations).set({
            unreadCount: 0,
            updatedAt: new Date(),
        }).where(and(
            eq(chatConversations.id, conversationId),
            eq(chatConversations.clinicId, clinicId)
        ));
    }

    // ========================================================================
    // Notes
    // ========================================================================

    static async addNote(conversationId: string, userId: string, content: string) {
        const [note] = await db.insert(chatConversationNotes).values({
            conversationId,
            createdById: userId,
            content,
        }).returning();
        return note;
    }

    static async getNotes(conversationId: string) {
        return db
            .select()
            .from(chatConversationNotes)
            .where(eq(chatConversationNotes.conversationId, conversationId))
            .orderBy(desc(chatConversationNotes.createdAt));
    }

    // ========================================================================
    // Quick Replies
    // ========================================================================

    static async getQuickReplies(clinicId: string) {
        return db
            .select()
            .from(chatQuickReplies)
            .where(eq(chatQuickReplies.clinicId, clinicId))
            .orderBy(chatQuickReplies.sortOrder);
    }

    static async createQuickReply(clinicId: string, data: { title: string; content: string; category?: string }) {
        const [qr] = await db.insert(chatQuickReplies).values({
            clinicId,
            title: data.title,
            content: data.content,
            category: data.category || null,
        }).returning();
        return qr;
    }

    static async deleteQuickReply(id: string, clinicId: string) {
        const [deleted] = await db
            .delete(chatQuickReplies)
            .where(and(
                eq(chatQuickReplies.id, id),
                eq(chatQuickReplies.clinicId, clinicId)
            ))
            .returning();
        return !!deleted;
    }

    // ========================================================================
    // Leads
    // ========================================================================

    static async getLeads(clinicId: string, filters?: { status?: string; limit?: number; offset?: number }) {
        const conditions = [eq(chatLeads.clinicId, clinicId)];
        if (filters?.status) {
            conditions.push(eq(chatLeads.status, filters.status as any));
        }

        return db
            .select()
            .from(chatLeads)
            .where(and(...conditions))
            .orderBy(desc(chatLeads.createdAt))
            .limit(filters?.limit || 50)
            .offset(filters?.offset || 0);
    }

    static async updateLead(leadId: string, clinicId: string, data: {
        firstName?: string;
        lastName?: string;
        email?: string;
        notes?: string;
        status?: string;
    }) {
        const [updated] = await db
            .update(chatLeads)
            .set({
                ...(data.firstName !== undefined && { firstName: data.firstName }),
                ...(data.lastName !== undefined && { lastName: data.lastName }),
                ...(data.email !== undefined && { email: data.email }),
                ...(data.notes !== undefined && { notes: data.notes }),
                ...(data.status && { status: data.status as any }),
                updatedAt: new Date(),
            })
            .where(and(
                eq(chatLeads.id, leadId),
                eq(chatLeads.clinicId, clinicId)
            ))
            .returning();
        return updated;
    }

    /**
     * Convert a lead to a patient (marks the lead as converted).
     */
    static async convertLead(leadId: string, clinicId: string, patientId: string, userId: string) {
        const [updated] = await db
            .update(chatLeads)
            .set({
                status: 'CONVERTED',
                convertedPatientId: patientId,
                convertedById: userId,
                convertedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(and(
                eq(chatLeads.id, leadId),
                eq(chatLeads.clinicId, clinicId)
            ))
            .returning();

        // Also update conversations to link to the patient
        if (updated) {
            await db.update(chatConversations).set({
                patientId,
                updatedAt: new Date(),
            }).where(and(
                eq(chatConversations.leadId, leadId),
                eq(chatConversations.clinicId, clinicId)
            ));
        }

        return updated;
    }
}
