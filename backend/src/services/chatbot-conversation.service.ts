import type { Database } from '../db/index.js';
import {
    chatConversations,
    chatMessages,
    chatLeads,
    chatAiLogs,
    whatsappSettings,
    patients,
    chatConversationNotes,
    chatQuickReplies,
    clinics,
} from '../db/schema.js';
import { eq, and, desc, sql, ilike, isNull } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { WhatsAppService, type ParsedWebhookMessage } from './whatsapp.service.js';
import { ChatbotAiService } from './chatbot-ai.service.js';
import { decrypt } from '../utils/encryption.js';
import { emitToClinic } from '../websocket.js';
import * as storage from './storage.service.js';

/**
 * Normalize a phone number to digits-only (no '+' prefix) so that
 * +34644404697 and 34644404697 match the same conversation.
 */
function normalizePhone(phone: string): string {
    return phone.replace(/^\+/, '');
}

// ============================================================================
// Per-contact rate limiter (in-memory)
// ============================================================================
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;   // 2 minutes
const RATE_LIMIT_PER_WINDOW = 7;                // max AI responses per 2-min window
const RATE_LIMIT_DAILY = 60;                    // max AI responses per day

interface ContactRateEntry {
    /** Timestamps of AI responses inside the current short window */
    windowHits: number[];
    /** Counter of AI responses today (resets at midnight) */
    dailyCount: number;
    /** The day string (YYYY-MM-DD) the dailyCount belongs to */
    dailyDate: string;
}

const rateLimitMap = new Map<string, ContactRateEntry>();

// Cleanup stale entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
        // Remove entries with no recent window hits and whose daily date is not today
        const today = new Date().toISOString().slice(0, 10);
        if (entry.dailyDate !== today && entry.windowHits.every(t => now - t > RATE_LIMIT_WINDOW_MS)) {
            rateLimitMap.delete(key);
        }
    }
}, 10 * 60 * 1000);

function checkChatbotRateLimit(conversationId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    let entry = rateLimitMap.get(conversationId);
    if (!entry || entry.dailyDate !== today) {
        entry = { windowHits: [], dailyCount: 0, dailyDate: today };
        rateLimitMap.set(conversationId, entry);
    }

    // Prune old window hits
    entry.windowHits = entry.windowHits.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

    // Check short-window limit
    if (entry.windowHits.length >= RATE_LIMIT_PER_WINDOW) {
        return { allowed: false, reason: `rate-limit: ${RATE_LIMIT_PER_WINDOW} msgs/${RATE_LIMIT_WINDOW_MS / 1000}s` };
    }

    // Check daily limit
    if (entry.dailyCount >= RATE_LIMIT_DAILY) {
        return { allowed: false, reason: `rate-limit: ${RATE_LIMIT_DAILY} msgs/day` };
    }

    return { allowed: true };
}

function recordChatbotResponse(conversationId: string): void {
    const entry = rateLimitMap.get(conversationId);
    if (entry) {
        entry.windowHits.push(Date.now());
        entry.dailyCount++;
    }
}

/**
 * Conversation Engine Service
 * Manages conversation lifecycle, message routing, patient/lead detection,
 * and AI vs human control modes.
 */
export class ChatbotConversationService {

    // ========================================================================
    // Settings
    // ========================================================================

    static async getSettings(db: Database, clinicId: string) {
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

    static async getSettingsRaw(db: Database, clinicId: string) {
        const [settings] = await db
            .select()
            .from(whatsappSettings)
            .where(eq(whatsappSettings.clinicId, clinicId));
        return settings || null;
    }

    // ========================================================================
    // Conversations
    // ========================================================================

    static async getConversations(db: Database, clinicId: string, filters?: {
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

        const rows = await db
            .select({
                conversation: chatConversations,
                patientFirstName: patients.firstName,
                patientLastName: patients.lastName,
            })
            .from(chatConversations)
            .leftJoin(patients, eq(chatConversations.patientId, patients.id))
            .where(and(...conditions))
            .orderBy(desc(chatConversations.lastMessageAt))
            .limit(filters?.limit || 50)
            .offset(filters?.offset || 0);

        // Enrich with last message preview + patient full name
        const enriched = await Promise.all(
            rows.map(async (row) => {
                const conv = row.conversation;
                const [lastMessage] = await db
                    .select()
                    .from(chatMessages)
                    .where(eq(chatMessages.conversationId, conv.id))
                    .orderBy(desc(chatMessages.createdAt))
                    .limit(1);

                return {
                    ...conv,
                    patientName: row.patientFirstName && row.patientLastName
                        ? `${row.patientFirstName} ${row.patientLastName}`
                        : null,
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

    static async getConversation(db: Database, conversationId: string, clinicId: string) {
        const [row] = await db
            .select({
                conversation: chatConversations,
                patientFirstName: patients.firstName,
                patientLastName: patients.lastName,
            })
            .from(chatConversations)
            .leftJoin(patients, eq(chatConversations.patientId, patients.id))
            .where(and(
                eq(chatConversations.id, conversationId),
                eq(chatConversations.clinicId, clinicId)
            ));
        if (!row) return null;
        return {
            ...row.conversation,
            patientName: row.patientFirstName && row.patientLastName
                ? `${row.patientFirstName} ${row.patientLastName}`
                : null,
        };
    }

    /**
     * Delete a conversation and all related data (messages, notes, AI logs).
     */
    static async deleteConversation(db: Database, conversationId: string, clinicId: string) {
        // Verify ownership
        const conversation = await this.getConversation(db, conversationId, clinicId);
        if (!conversation) throw new Error('Conversation not found');

        // Delete in dependency order
        await db.delete(chatConversationNotes).where(eq(chatConversationNotes.conversationId, conversationId));
        await db.delete(chatAiLogs).where(eq(chatAiLogs.conversationId, conversationId));
        await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
        await db.delete(chatConversations).where(eq(chatConversations.id, conversationId));

        logger.info({ conversationId, clinicId }, 'Conversation deleted');
        return true;
    }

    static async getConversationMessages(db: Database, conversationId: string, clinicId: string, limit = 50, offset = 0) {
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
    static async processIncomingMessage(db: Database, message: ParsedWebhookMessage, clinicId: string, tenantSlug?: string) {
        try {
            // 1. Find or create conversation
            const conversation = await this.findOrCreateConversation(db,
                clinicId,
                message.from,
                message.contactName
            );

            // Determine if this is a media message
            const isMediaMessage = message.messageType !== 'text' && message.messageType !== 'status';

            // 2. Save inbound message
            const [savedMessage] = await db.insert(chatMessages).values({
                conversationId: conversation!.id,
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
            if (!savedMessage) throw new Error('Failed to save message');

            // 2.5 If media, download and store locally
            if (isMediaMessage && message.mediaId) {
                const settings = await this.getSettingsRaw(db, clinicId);
                if (settings?.accessToken && settings.phoneNumberId) {
                    try {
                        const media = await WhatsAppService.downloadMedia(
                            { phoneNumberId: settings.phoneNumberId, accessToken: settings.accessToken },
                            message.mediaId
                        );
                        if (media) {
                            const mediaUrl = await this.saveMediaFile(db,
                                media.buffer, media.mimeType,
                                clinicId, conversation!.id, savedMessage!.id,
                                tenantSlug
                            );
                            // Update message with local media URL
                            await db.update(chatMessages).set({ mediaUrl })
                                .where(eq(chatMessages.id, savedMessage!.id));
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
            }).where(eq(chatConversations.id, conversation!.id));

            // 3.5 Emit inbound message via WebSocket BEFORE AI response
            // This ensures the user's question appears before the AI reply
            emitToClinic(clinicId, 'chatbot:new-message', {
                conversationId: conversation!.id,
                message: {
                    id: savedMessage!.id,
                    conversationId: savedMessage!.conversationId,
                    direction: savedMessage!.direction,
                    content: savedMessage!.content,
                    messageType: savedMessage!.messageType,
                    mediaUrl: (savedMessage as any).mediaUrl || null,
                    isFromAi: false,
                    status: savedMessage!.status,
                    createdAt: savedMessage!.createdAt,
                },
                from: message.from,
                contactName: message.contactName,
            });

            // 4. Mark as read on WhatsApp
            const settingsForRead = await this.getSettingsRaw(db, clinicId);
            if (settingsForRead?.accessToken && settingsForRead.phoneNumberId) {
                WhatsAppService.markAsRead(
                    { phoneNumberId: settingsForRead.phoneNumberId, accessToken: settingsForRead.accessToken },
                    message.wamid
                ).catch(() => { });
            }

            // 5. Handle Audio Messages separately (for AI Transcription)
            if (message.messageType === 'audio' && conversation!.controlMode === 'AI') {
                try {
                    const mediaBuffer = await WhatsAppService.downloadMedia(
                        { phoneNumberId: settingsForRead!.phoneNumberId!, accessToken: settingsForRead!.accessToken! },
                        message.mediaId!
                    );

                    if (mediaBuffer) {
                        const transcription = await ChatbotAiService.transcribeAudio(db, mediaBuffer.buffer, mediaBuffer.mimeType);

                        if (transcription) {
                            logger.info({ conversationId: conversation!.id, transcription }, 'Audio transcribed successfully');

                            // Update the message content with transcription
                            const transcribedContent = `[Transcripción de Audio]: ${transcription}`;
                            await db.update(chatMessages)
                                .set({ content: transcribedContent })
                                .where(eq(chatMessages.id, savedMessage!.id));

                            // Proceed to AI response with transcribed text
                            if (settingsForRead?.autoReplyEnabled) {
                                await this.handleAiResponse(db, conversation!.id, clinicId, transcription, settingsForRead);
                            }
                            return { conversation, message: { ...savedMessage, content: transcribedContent } };
                        }
                    }
                } catch (err) {
                    logger.error({ err, conversationId: conversation!.id }, 'Failed to process audio message for AI');
                    // Fall through to standard media handling (switch to HUMAN)
                }
            }

            // 6. Handle other Media Messages (Images, Documents, etc.) OR failed Audio
            if (isMediaMessage) {
                if (conversation!.controlMode === 'AI') {
                    await this.switchControlMode(db, conversation!.id, clinicId, 'HUMAN');
                    logger.info({ conversationId: conversation!.id }, 'Auto-switched to HUMAN mode — media received');
                }
                return { conversation, message: savedMessage };
            }

            // 6. If in AI mode (Text), generate and send response
            if (conversation!.controlMode === 'AI' && settingsForRead?.autoReplyEnabled) {
                await this.handleAiResponse(db, conversation!.id, clinicId, message.text || '', settingsForRead);
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
    static async processStatusUpdate(db: Database, message: ParsedWebhookMessage) {
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
    static async findOrCreateConversation(db: Database,
        clinicId: string,
        phone: string,
        contactName: string | null,
    ) {
        const normalized = normalizePhone(phone);

        // Check for existing conversation with this phone (one continuous thread per contact)
        const [existing] = await db
            .select()
            .from(chatConversations)
            .where(and(
                eq(chatConversations.clinicId, clinicId),
                eq(chatConversations.waContactPhone, normalized),
            ));

        if (existing) {
            // Reconcile: if conversation is linked to a lead but patient now exists,
            // upgrade the conversation to link to the patient instead
            if (existing.leadId && !existing.patientId) {
                const patient = await this.findPatientByPhone(db, clinicId, phone);
                if (patient) {
                    // Update conversation to point to the patient
                    await db.update(chatConversations)
                        .set({ patientId: patient.id, leadId: null })
                        .where(eq(chatConversations.id, existing.id));

                    // Mark the lead as converted
                    await db.update(chatLeads)
                        .set({
                            status: 'CONVERTED',
                            convertedPatientId: patient.id,
                            convertedAt: new Date(),
                        })
                        .where(eq(chatLeads.id, existing.leadId));

                    logger.info({
                        conversationId: existing.id,
                        leadId: existing.leadId,
                        patientId: patient.id,
                    }, 'Lead auto-reconciled to existing patient');

                    return { ...existing, patientId: patient.id, leadId: null };
                }
            }
            return existing;
        }

        // Look up patient by phone (use original phone for patient lookup flexibility)
        const patient = await this.findPatientByPhone(db, clinicId, phone);

        // Look up or create lead if no patient
        let leadId: string | null = null;
        if (!patient) {
            const lead = await this.findOrCreateLead(db, clinicId, normalized, contactName);
            leadId = lead.id;
        }

        // Create new conversation — always store normalized phone
        const [conversation] = await db.insert(chatConversations).values({
            clinicId,
            patientId: patient?.id || null,
            leadId,
            waContactPhone: normalized,
            waContactName: contactName,
            status: 'ACTIVE',
            controlMode: 'AI',
            lastMessageAt: new Date(),
        }).returning();

        logger.info({
            conversationId: conversation!.id,
            clinicId,
            phone,
            isPatient: !patient,
            isLead: !leadId,
        }, 'New conversation created');

        return conversation;
    }

    /**
     * Find a patient by phone number. Searches with and without country prefix.
     */
    static async findPatientByPhone(db: Database, clinicId: string, phone: string) {
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
    static async findOrCreateLead(db: Database, clinicId: string, phone: string, name: string | null) {
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

        logger.info({ leadId: lead!.id, clinicId, phone }, 'New lead created from WhatsApp');
        return lead!;
    }

    // ========================================================================
    // AI Response Handling
    // ========================================================================

    private static async handleAiResponse(db: Database,
        conversationId: string,
        clinicId: string,
        userMessageText: string,
        settings: any
    ) {
        try {
            if (!userMessageText) return;

            // Rate limit check — before spending tokens
            const rateCheck = checkChatbotRateLimit(conversationId);
            if (!rateCheck.allowed) {
                logger.info({ conversationId, reason: rateCheck.reason }, 'Chatbot rate-limited, skipping AI response');
                return;
            }

            // Get conversation history
            const history = await db
                .select({
                    content: chatMessages.content,
                    direction: chatMessages.direction,
                })
                .from(chatMessages)
                .where(eq(chatMessages.conversationId, conversationId))
                .orderBy(desc(chatMessages.createdAt))
                .limit(20);

            const conversationHistory = history
                .reverse() // Reverse to get chronological order (oldest -> newest) for AI context
                .filter(m => m.content)
                .map(m => ({
                    role: m.direction === 'INBOUND' ? 'user' : 'assistant',
                    content: m.content!,
                }));

            // Generate AI response
            const aiResult = await ChatbotAiService.generateResponse(
                db,
                clinicId,
                conversationId,
                userMessageText,
                conversationHistory,
                settings.systemPrompt,
            );

            // If AI is quota-blocked, don't send anything to the patient
            // Emit a WebSocket event so the frontend shows a banner
            if (aiResult.quotaBlocked) {
                emitToClinic(clinicId, 'chatbot:ai-status', {
                    active: false,
                    reason: aiResult.quotaReason || 'IA no disponible',
                });
                return;
            }

            // Send via WhatsApp
            const sendResult = await WhatsAppService.sendTextMessage(
                { phoneNumberId: settings.phoneNumberId, accessToken: settings.accessToken },
                (await this.getConversation(db, conversationId, clinicId))?.waContactPhone || '',
                aiResult.response
            );

            // Record successful AI response for rate limiting
            recordChatbotResponse(conversationId);

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
    static async switchControlMode(db: Database,
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
    static async sendHumanMessage(db: Database,
        conversationId: string,
        clinicId: string,
        userId: string,
        text: string
    ) {
        const conversation = await this.getConversation(db, conversationId, clinicId);
        if (!conversation) throw new Error('Conversation not found');

        const settings = await this.getSettingsRaw(db, clinicId);
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
    private static async saveMediaFile(db: Database,
        buffer: Buffer,
        mimeType: string,
        clinicId: string,
        conversationId: string,
        messageId: string,
        tenantSlug?: string
    ): Promise<string> {
        // Look up organization for tenant-isolated path
        const clinic = await db.query.clinics.findFirst({
            where: eq(clinics.id, clinicId),
            columns: { organizationId: true },
        });
        const orgId = clinic?.organizationId || 'unknown';

        const ext = this.mimeToExtension(mimeType);
        const filename = `${messageId}${ext}`;
        const storageKey = storage.buildKey(orgId, clinicId, 'whatsapp-media', conversationId, filename);

        await storage.uploadFile(storageKey, buffer, mimeType, tenantSlug);

        logger.info({ storageKey, size: buffer.length, mimeType }, 'Media file saved to MinIO');
        return storageKey;
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
    static async sendHumanMediaMessage(db: Database,
        conversationId: string,
        clinicId: string,
        userId: string,
        file: { buffer: Buffer; mimetype: string; originalname: string },
        caption?: string,
        tenantSlug?: string
    ) {
        const conversation = await this.getConversation(db, conversationId, clinicId);
        if (!conversation) throw new Error('Conversation not found');

        const settings = await this.getSettingsRaw(db, clinicId);
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
        const mediaUrl = await this.saveMediaFile(db,
            file.buffer,
            file.mimetype,
            clinicId,
            conversationId,
            `out-${Date.now()}`,
            tenantSlug
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
    static async closeConversation(db: Database,
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
    static async markConversationAsRead(db: Database, conversationId: string, clinicId: string) {
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

    static async addNote(db: Database, conversationId: string, userId: string, content: string) {
        const [note] = await db.insert(chatConversationNotes).values({
            conversationId,
            createdById: userId,
            content,
        }).returning();
        return note;
    }

    static async getNotes(db: Database, conversationId: string) {
        return db
            .select()
            .from(chatConversationNotes)
            .where(eq(chatConversationNotes.conversationId, conversationId))
            .orderBy(desc(chatConversationNotes.createdAt));
    }

    // ========================================================================
    // Quick Replies
    // ========================================================================

    static async getQuickReplies(db: Database, clinicId: string) {
        return db
            .select()
            .from(chatQuickReplies)
            .where(eq(chatQuickReplies.clinicId, clinicId))
            .orderBy(chatQuickReplies.sortOrder);
    }

    static async createQuickReply(db: Database, clinicId: string, data: { title: string; content: string; category?: string }) {
        const [qr] = await db.insert(chatQuickReplies).values({
            clinicId,
            title: data.title,
            content: data.content,
            category: data.category || null,
        }).returning();
        return qr;
    }

    static async deleteQuickReply(db: Database, id: string, clinicId: string) {
        const [deleted] = await db
            .delete(chatQuickReplies)
            .where(and(
                eq(chatQuickReplies.id, id),
                eq(chatQuickReplies.clinicId, clinicId)
            ))
            .returning();
        return !deleted;
    }

    // ========================================================================
    // Leads
    // ========================================================================

    static async getLeads(db: Database, clinicId: string, filters?: { status?: string; limit?: number; offset?: number }) {
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

    static async updateLead(db: Database, leadId: string, clinicId: string, data: {
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
     * Convert a lead to a patient: creates the patient record from provided data,
     * marks the lead as CONVERTED, and links conversations to the new patient.
     */
    static async convertLead(db: Database,
        leadId: string,
        clinicId: string,
        patientData: { firstName: string; lastName: string; phone?: string; email?: string },
        userId: string
    ) {
        // 1. Verify lead exists
        const [lead] = await db
            .select()
            .from(chatLeads)
            .where(and(eq(chatLeads.id, leadId), eq(chatLeads.clinicId, clinicId)));

        if (!lead) return null;

        // 2. Create the patient
        const [newPatient] = await db.insert(patients).values({
            clinicId,
            firstName: patientData.firstName,
            lastName: patientData.lastName,
            phone: patientData.phone || lead.phone,
            email: patientData.email || lead.email || null,
        }).returning();

        // 3. Mark lead as converted
        const [updated] = await db
            .update(chatLeads)
            .set({
                status: 'CONVERTED',
                convertedPatientId: newPatient!.id,
                convertedById: userId,
                convertedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(chatLeads.id, leadId))
            .returning();

        // 4. Link all conversations from this lead to the new patient
        await db.update(chatConversations).set({
            patientId: newPatient!.id,
            updatedAt: new Date(),
        }).where(and(
            eq(chatConversations.leadId, leadId),
            eq(chatConversations.clinicId, clinicId)
        ));

        logger.info({ leadId, patientId: newPatient!.id, clinicId }, 'Lead converted to patient');
        return { lead: updated, patient: newPatient };
    }

    /**
     * Send a template message to initiate a conversation.
     */
    static async sendTemplateMessage(db: Database,
        clinicId: string,
        userId: string | undefined,
        phone: string,
        templateName: string,
        languageCode: string = 'es',
        components: any[] = [],
        templateBody?: string,
    ) {
        const settings = await this.getSettingsRaw(db, clinicId);
        if (!settings?.accessToken || !settings.phoneNumberId) {
            throw new Error('WhatsApp not configured for this clinic');
        }

        // Find or create conversation for this phone
        const normalizedPhone = normalizePhone(phone);
        const conversation = (await this.findOrCreateConversation(db, clinicId, normalizedPhone, null))!;

        // Send template via WhatsApp API
        const result = await WhatsAppService.sendTemplateMessage(
            { phoneNumberId: settings.phoneNumberId, accessToken: settings.accessToken },
            normalizedPhone,
            templateName,
            languageCode,
            components
        );

        if (!result.success) {
            const err: any = new Error(result.error || 'Failed to send template message');
            err.errorCode = result.errorCode;
            throw err;
        }

        // Build a readable preview of the template for the message content
        const content = templateBody || `📋 Plantilla: ${templateName}`;

        // Save the outbound message
        const [message] = await db.insert(chatMessages).values({
            conversationId: conversation!.id,
            clinicId,
            direction: 'OUTBOUND',
            content,
            messageType: 'template',
            wamid: result.wamid || null,
            status: 'SENT',
            isFromAi: false,
            sentById: userId ?? null,
            metadata: { templateName, languageCode, components },
        }).returning();

        // Switch to HUMAN mode and update timestamps
        await db.update(chatConversations).set({
            controlMode: 'HUMAN',
            lastMessageAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(chatConversations.id, conversation!.id));

        logger.info({
            conversationId: conversation!.id,
            templateName,
            phone,
        }, 'Template message sent');

        return { conversation, message };
    }
}
