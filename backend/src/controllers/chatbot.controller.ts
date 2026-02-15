import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ChatbotConversationService } from '../services/chatbot-conversation.service.js';
import { ChatbotKnowledgeService } from '../services/chatbot-knowledge.service.js';
import { whatsappSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { encrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';
import type { Database } from '../db/index.js';
import { AiUsageService } from '../services/ai-usage.service.js';
import { authenticate, requirePermission } from '../middleware/index.js';

const router = Router();

// Configure multer for PDF uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB max file size
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'));
        }
    },
});

// Configure multer for media uploads (images + documents)
const mediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max
    },
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword',
            'application/vnd.ms-excel',
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'));
        }
    },
});

// ============================================================================
// MIDDLEWARE: Extract clinic ID
// ============================================================================
const extractClinicId = (req: Request, res: Response, next: NextFunction): void => {
    const clinicId = req.headers['x-clinic-id'] as string;
    if (!clinicId) {
        res.status(400).json({ error: 'X-Clinic-Id header is required' });
        return;
    }
    (req as any).clinicId = clinicId;
    next();
};

router.use(authenticate);
router.use(extractClinicId);
router.use(requirePermission('whatsapp'));

// ============================================================================
// AI STATUS
// ============================================================================

// GET /api/v1/chatbot/ai-status
router.get('/ai-status', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const quota = await AiUsageService.checkQuota(((req as any).db as Database), clinicId);
        res.json({
            data: {
                active: quota.allowed,
                aiEnabled: quota.aiEnabled,
                reason: !quota.aiEnabled
                    ? 'La IA no está habilitada para esta clínica. Contacte con el administrador para activarla.'
                    : !quota.allowed
                        ? 'Se ha superado el límite mensual de tokens de IA. Contacte con el administrador para ampliar el límite.'
                        : null,
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to get AI status');
        res.status(500).json({ error: 'Failed to get AI status' });
    }
});

// GET /api/v1/chatbot/ai-usage?month=YYYY-MM
router.get('/ai-usage', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const month = req.query['month'] as string | undefined;

        let monthDate: Date | undefined;
        if (month) {
            monthDate = new Date(`${month}-01`);
            if (isNaN(monthDate.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM.' });
                return;
            }
        }

        const usageSummary = await AiUsageService.getUsageSummary(((req as any).db as Database), clinicId, monthDate);
        res.json({ success: true, data: usageSummary });
    } catch (error) {
        logger.error({ error }, 'Failed to get AI usage');
        res.status(500).json({ error: 'Failed to get AI usage' });
    }
});

// ============================================================================
// WHATSAPP SETTINGS
// ============================================================================

// GET /api/v1/chatbot/settings
router.get('/settings', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const settings = await ChatbotConversationService.getSettings(((req as any).db as Database), clinicId);
        res.json({ data: settings });
    } catch (error) {
        logger.error({ error }, 'Failed to get WhatsApp settings');
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// PUT /api/v1/chatbot/settings
router.put('/settings', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const {
            phoneNumberId,
            accessToken,
            businessAccountId,
            webhookVerifyToken,
            systemPrompt,
            autoReplyEnabled,
            inactivityTimeoutHours,
            isEnabled,
        } = req.body;

        // Check if settings exist
        const [existing] = await ((req as any).db as Database)
            .select()
            .from(whatsappSettings)
            .where(eq(whatsappSettings.clinicId, clinicId));

        const data: Record<string, any> = {
            updatedAt: new Date(),
        };

        if (phoneNumberId !== undefined) data.phoneNumberId = phoneNumberId;
        if (businessAccountId !== undefined) data.businessAccountId = businessAccountId;
        if (webhookVerifyToken !== undefined) data.webhookVerifyToken = webhookVerifyToken;
        if (systemPrompt !== undefined) data.systemPrompt = systemPrompt;
        if (autoReplyEnabled !== undefined) data.autoReplyEnabled = autoReplyEnabled;
        if (inactivityTimeoutHours !== undefined) data.inactivityTimeoutHours = inactivityTimeoutHours;
        if (isEnabled !== undefined) data.isEnabled = isEnabled;

        // Encrypt access token if provided (and not masked placeholder)
        if (accessToken && accessToken !== '••••••••') {
            data.accessToken = encrypt(accessToken);
        }

        // Check if we have enough to consider it "configured"
        const hasPhoneId = phoneNumberId || existing?.phoneNumberId;
        const hasToken = (accessToken && accessToken !== '••••••••') || existing?.accessToken;
        data.isConfigured = !!(hasPhoneId && hasToken);

        let result;
        if (existing) {
            [result] = await ((req as any).db as Database)
                .update(whatsappSettings)
                .set(data)
                .where(eq(whatsappSettings.clinicId, clinicId))
                .returning();
        } else {
            [result] = await ((req as any).db as Database)
                .insert(whatsappSettings)
                .values({
                    clinicId,
                    ...data,
                })
                .returning();
        }

        // Mask token in response
        res.json({
            data: result ? {
                ...result,
                accessToken: result.accessToken ? '••••••••' : null,
            } : null,
        });
    } catch (error) {
        logger.error({ error }, 'Failed to update WhatsApp settings');
        res.status(500).json({ error: 'Failed to update settings' });
    }
});



// POST /api/v1/chatbot/settings/test
router.post('/settings/test', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const { testPhone } = req.body;

        if (!testPhone) {
            res.status(400).json({ error: 'testPhone is required' });
            return;
        }

        const settings = await ChatbotConversationService.getSettingsRaw(((req as any).db as Database), clinicId);
        if (!settings?.accessToken || !settings?.phoneNumberId) {
            res.status(400).json({ error: 'WhatsApp is not configured for this clinic' });
            return;
        }

        const { WhatsAppService } = await import('../services/whatsapp.service.js');
        const result = await WhatsAppService.testConnection(
            { phoneNumberId: settings.phoneNumberId, accessToken: settings.accessToken },
            testPhone
        );

        res.json({ data: result });
    } catch (error) {
        logger.error({ error }, 'Failed to test WhatsApp connection');
        res.status(500).json({ error: 'Test failed' });
    }
});

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

// GET /api/v1/chatbot/templates — List approved templates from Meta
router.get('/templates', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const settings = await ChatbotConversationService.getSettingsRaw(((req as any).db as Database), clinicId);

        if (!settings?.accessToken || !settings.businessAccountId) {
            res.status(400).json({ error: 'WhatsApp not configured or missing Business Account ID' });
            return;
        }

        const { WhatsAppService } = await import('../services/whatsapp.service.js');
        const result = await WhatsAppService.getMessageTemplates(
            settings.accessToken,
            settings.businessAccountId
        );

        if (result.error) {
            res.status(502).json({ error: result.error });
            return;
        }

        res.json({ data: result.templates });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch templates');
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// POST /api/v1/chatbot/conversations/send-template — Send template to start/continue conversation
router.post('/conversations/send-template', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const userId = (req as any).user?.id as string;
        const { phone, templateName, languageCode, components, templateBody } = req.body;

        if (!phone || !templateName) {
            res.status(400).json({ error: 'phone and templateName are required' });
            return;
        }

        const result = await ChatbotConversationService.sendTemplateMessage(((req as any).db as Database),
            clinicId,
            userId,
            phone,
            templateName,
            languageCode || 'es',
            components || [],
            templateBody
        );

        res.json({ data: result });
    } catch (error: any) {
        logger.error({ error }, 'Failed to send template message');
        res.status(500).json({ error: error.message || 'Failed to send template' });
    }
});

// ============================================================================
// CONVERSATIONS
// ============================================================================

// GET /api/v1/chatbot/conversations
router.get('/conversations', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const { status, controlMode, search } = req.query;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

        const conversations = await ChatbotConversationService.getConversations(((req as any).db as Database), clinicId, {
            ...(status !== undefined && { status: status as string }),
            ...(controlMode !== undefined && { controlMode: controlMode as string }),
            ...(search !== undefined && { search: search as string }),
            ...(limit !== undefined && { limit }),
            ...(offset !== undefined && { offset }),
        });

        res.json({ data: conversations });
    } catch (error) {
        logger.error({ error }, 'Failed to get conversations');
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// GET /api/v1/chatbot/conversations/:id
router.get('/conversations/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const conversation = await ChatbotConversationService.getConversation(((req as any).db as Database), req.params.id!, clinicId);

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        res.json({ data: conversation });
    } catch (error) {
        logger.error({ error }, 'Failed to get conversation');
        res.status(500).json({ error: 'Failed to get conversation' });
    }
});

// GET /api/v1/chatbot/conversations/:id/messages
router.get('/conversations/:id/messages', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

        const messages = await ChatbotConversationService.getConversationMessages(((req as any).db as Database),
            req.params.id!,
            clinicId,
            limit,
            offset
        );

        res.json({ data: messages });
    } catch (error) {
        logger.error({ error }, 'Failed to get conversation messages');
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// POST /api/v1/chatbot/conversations/:id/messages — Human sends a message
router.post('/conversations/:id/messages', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const userId = (req as any).user?.id as string;
        const { text } = req.body;

        if (!text) {
            res.status(400).json({ error: 'text is required' });
            return;
        }

        const message = await ChatbotConversationService.sendHumanMessage(((req as any).db as Database),
            req.params.id!,
            clinicId,
            userId,
            text
        );

        res.json({ data: message });
    } catch (error) {
        logger.error({ error }, 'Failed to send message');
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// POST /api/v1/chatbot/conversations/:id/messages/media — Human sends a media file
router.post('/conversations/:id/messages/media', mediaUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const userId = (req as any).user?.id as string;
        const file = req.file;
        const caption = req.body.caption || undefined;

        if (!file) {
            res.status(400).json({ error: 'file is required' });
            return;
        }

        const tenantSlug = (req as any).user?.tenantSlug as string | undefined;

        const message = await ChatbotConversationService.sendHumanMediaMessage(((req as any).db as Database),
            req.params.id!,
            clinicId,
            userId,
            {
                buffer: file.buffer,
                mimetype: file.mimetype,
                originalname: file.originalname,
            },
            caption,
            tenantSlug
        );

        res.json({ data: message });
    } catch (error) {
        logger.error({ error }, 'Failed to send media message');
        res.status(500).json({ error: 'Failed to send media message' });
    }
});

// PUT /api/v1/chatbot/conversations/:id/control — Switch AI/HUMAN mode
router.put('/conversations/:id/control', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const userId = (req as any).user?.id as string;
        const { mode } = req.body;

        if (!['AI', 'HUMAN', 'PAUSED'].includes(mode)) {
            res.status(400).json({ error: 'mode must be AI, HUMAN, or PAUSED' });
            return;
        }

        const conversation = await ChatbotConversationService.switchControlMode(((req as any).db as Database),
            req.params.id!,
            clinicId,
            mode,
            userId
        );

        // Emit WebSocket event for real-time UI sync
        try {
            const { getIO } = await import('../websocket.js');
            getIO().to(`clinic:${clinicId}`).emit('chatbot:conversation-updated', {
                conversationId: req.params.id!,
                controlMode: mode,
                status: conversation?.status,
            });
        } catch { /* WebSocket may not be initialized */ }

        res.json({ data: conversation });
    } catch (error) {
        logger.error({ error }, 'Failed to switch control mode');
        res.status(500).json({ error: 'Failed to switch control mode' });
    }
});

// PUT /api/v1/chatbot/conversations/:id/close
router.put('/conversations/:id/close', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const userId = (req as any).user?.id as string;

        const conversation = await ChatbotConversationService.closeConversation(((req as any).db as Database),
            req.params.id!,
            clinicId,
            userId
        );

        // Emit WebSocket event for real-time UI sync
        try {
            const { getIO } = await import('../websocket.js');
            getIO().to(`clinic:${clinicId}`).emit('chatbot:conversation-updated', {
                conversationId: req.params.id!,
                status: 'CLOSED',
            });
        } catch { /* WebSocket may not be initialized */ }

        res.json({ data: conversation });
    } catch (error) {
        logger.error({ error }, 'Failed to close conversation');
        res.status(500).json({ error: 'Failed to close conversation' });
    }
});

// PUT /api/v1/chatbot/conversations/:id/read
router.put('/conversations/:id/read', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        await ChatbotConversationService.markConversationAsRead(((req as any).db as Database), req.params.id!, clinicId);
        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, 'Failed to mark as read');
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// ============================================================================
// DELETE CONVERSATION
// ============================================================================

// DELETE /api/v1/chatbot/conversations/:id
router.delete('/conversations/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        await ChatbotConversationService.deleteConversation(((req as any).db as Database), req.params.id!, clinicId);
        res.json({ success: true });
    } catch (error: any) {
        if (error.message === 'Conversation not found') {
            res.status(404).json({ error: 'Conversación no encontrada' });
            return;
        }
        logger.error({ error }, 'Failed to delete conversation');
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// ============================================================================
// CONVERSATION NOTES
// ============================================================================

// GET /api/v1/chatbot/conversations/:id/notes
router.get('/conversations/:id/notes', async (req: Request, res: Response): Promise<void> => {
    try {
        const notes = await ChatbotConversationService.getNotes(((req as any).db as Database), req.params.id!);
        res.json({ data: notes });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get notes' });
    }
});

// POST /api/v1/chatbot/conversations/:id/notes
router.post('/conversations/:id/notes', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id as string;
        const { content } = req.body;

        if (!content) {
            res.status(400).json({ error: 'content is required' });
            return;
        }

        const note = await ChatbotConversationService.addNote(((req as any).db as Database), req.params.id!, userId, content);
        res.json({ data: note });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add note' });
    }
});

// ============================================================================
// KNOWLEDGE BASE
// ============================================================================

// GET /api/v1/chatbot/knowledge
router.get('/knowledge', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const bases = await ChatbotKnowledgeService.getKnowledgeBases(((req as any).db as Database), clinicId);
        res.json({ data: bases });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get knowledge bases' });
    }
});

// POST /api/v1/chatbot/knowledge
router.post('/knowledge', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const userId = (req as any).user?.id as string;
        const { name, description, icon } = req.body;

        if (!name) {
            res.status(400).json({ error: 'name is required' });
            return;
        }

        const kb = await ChatbotKnowledgeService.createKnowledgeBase(((req as any).db as Database),
            clinicId,
            { name, description, icon },
            userId
        );
        res.status(201).json({ data: kb });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create knowledge base' });
    }
});

// PUT /api/v1/chatbot/knowledge/:id
router.put('/knowledge/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const { name, description, icon } = req.body;

        const kb = await ChatbotKnowledgeService.updateKnowledgeBase(((req as any).db as Database),
            req.params.id!,
            clinicId,
            { name, description, icon }
        );

        if (!kb) {
            res.status(404).json({ error: 'Knowledge base not found' });
            return;
        }

        res.json({ data: kb });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update knowledge base' });
    }
});

// DELETE /api/v1/chatbot/knowledge/:id
router.delete('/knowledge/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const deleted = await ChatbotKnowledgeService.deleteKnowledgeBase(((req as any).db as Database), req.params.id!, clinicId);

        if (!deleted) {
            res.status(404).json({ error: 'Knowledge base not found' });
            return;
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete knowledge base' });
    }
});

// GET /api/v1/chatbot/knowledge/:id/articles
router.get('/knowledge/:id/articles', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const articles = await ChatbotKnowledgeService.getArticles(((req as any).db as Database), req.params.id!, clinicId);
        res.json({ data: articles });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get articles' });
    }
});

// POST /api/v1/chatbot/knowledge/:id/articles — Text article
router.post('/knowledge/:id/articles', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const userId = (req as any).user?.id as string;
        const { title, content } = req.body;

        if (!title || !content) {
            res.status(400).json({ error: 'title and content are required' });
            return;
        }

        const article = await ChatbotKnowledgeService.createArticle(((req as any).db as Database), {
            knowledgeBaseId: req.params.id!,
            clinicId,
            title,
            content,
            sourceType: 'text',
            userId,
        });

        res.status(201).json({ data: article });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create article' });
    }
});

// POST /api/v1/chatbot/knowledge/:id/articles/pdf — PDF upload
router.post('/knowledge/:id/articles/pdf', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const userId = (req as any).user?.id as string;
        const { title } = req.body;

        // Check if file was uploaded (multer file)
        const file = (req as any).file;
        if (!file) {
            res.status(400).json({ error: 'PDF file is required' });
            return;
        }

        // Parse PDF
        const text = await ChatbotKnowledgeService.parsePdf(((req as any).db as Database), file.buffer);

        if (!text.trim()) {
            res.status(400).json({ error: 'Could not extract text from PDF' });
            return;
        }

        const article = await ChatbotKnowledgeService.createArticle(((req as any).db as Database), {
            knowledgeBaseId: req.params.id!,
            clinicId,
            title: title || file.originalname,
            content: text,
            sourceType: 'pdf',
            sourceFilename: file.originalname,
            userId,
        });

        res.status(201).json({ data: article });
    } catch (error) {
        logger.error({ error: error instanceof Error ? { message: error.message, stack: error.stack } : error }, 'Failed to upload PDF article');
        res.status(500).json({ error: 'Failed to upload PDF article' });
    }
});

// PUT /api/v1/chatbot/knowledge/:kbId/articles/:articleId
router.put('/knowledge/:kbId/articles/:articleId', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const { title, content } = req.body;

        const article = await ChatbotKnowledgeService.updateArticle(((req as any).db as Database),
            req.params.articleId!,
            clinicId,
            { title, content }
        );

        if (!article) {
            res.status(404).json({ error: 'Article not found' });
            return;
        }

        res.json({ data: article });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update article' });
    }
});

// DELETE /api/v1/chatbot/knowledge/:kbId/articles/:articleId
router.delete('/knowledge/:kbId/articles/:articleId', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const deleted = await ChatbotKnowledgeService.deleteArticle(((req as any).db as Database), req.params.articleId!, clinicId);

        if (!deleted) {
            res.status(404).json({ error: 'Article not found' });
            return;
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete article' });
    }
});

// ============================================================================
// QUICK REPLIES
// ============================================================================

// GET /api/v1/chatbot/quick-replies
router.get('/quick-replies', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const replies = await ChatbotConversationService.getQuickReplies(((req as any).db as Database), clinicId);
        res.json({ data: replies });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get quick replies' });
    }
});

// POST /api/v1/chatbot/quick-replies
router.post('/quick-replies', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const { title, content, category } = req.body;

        if (!title || !content) {
            res.status(400).json({ error: 'title and content are required' });
            return;
        }

        const qr = await ChatbotConversationService.createQuickReply(((req as any).db as Database), clinicId, { title, content, category });
        res.status(201).json({ data: qr });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create quick reply' });
    }
});

// DELETE /api/v1/chatbot/quick-replies/:id
router.delete('/quick-replies/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const deleted = await ChatbotConversationService.deleteQuickReply(((req as any).db as Database), req.params.id!, clinicId);

        if (!deleted) {
            res.status(404).json({ error: 'Quick reply not found' });
            return;
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete quick reply' });
    }
});

// ============================================================================
// LEADS
// ============================================================================

// GET /api/v1/chatbot/leads
router.get('/leads', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const { status } = req.query;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

        const leads = await ChatbotConversationService.getLeads(((req as any).db as Database), clinicId, {
            ...(status !== undefined && { status: status as string }),
            ...(limit !== undefined && { limit }),
            ...(offset !== undefined && { offset }),
        });

        res.json({ data: leads });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get leads' });
    }
});

// PUT /api/v1/chatbot/leads/:id
router.put('/leads/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const { firstName, lastName, email, notes, status } = req.body;

        const lead = await ChatbotConversationService.updateLead(((req as any).db as Database), req.params.id!, clinicId, {
            firstName,
            lastName,
            email,
            notes,
            status,
        });

        if (!lead) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }

        res.json({ data: lead });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// POST /api/v1/chatbot/leads/:id/convert
router.post('/leads/:id/convert', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const userId = (req as any).user?.id as string;
        const { firstName, lastName, phone, email } = req.body;

        if (!firstName || !lastName) {
            res.status(400).json({ error: 'firstName and lastName are required' });
            return;
        }

        const result = await ChatbotConversationService.convertLead(((req as any).db as Database),
            req.params.id!,
            clinicId,
            { firstName, lastName, phone, email },
            userId
        );

        if (!result) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }

        res.json({ data: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to convert lead' });
    }
});

// ============================================================================
// WHATSAPP APPOINTMENT NOTIFICATION SETTINGS
// ============================================================================

// GET /api/v1/chatbot/settings/wa-notifications — Get WA notification config
router.get('/settings/wa-notifications', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const settings = await ((req as any).db as Database).query.whatsappSettings.findFirst({
            where: eq(whatsappSettings.clinicId, clinicId),
        });

        if (!settings) {
            res.json({ data: null });
            return;
        }

        res.json({
            data: {
                waNotifyEnabled: settings.waNotifyEnabled,
                waTemplateCreated: settings.waTemplateCreated,
                waTemplateMappingCreated: settings.waTemplateMappingCreated,
                waTemplateModified: settings.waTemplateModified,
                waTemplateMappingModified: settings.waTemplateMappingModified,
                waTemplateCancelled: settings.waTemplateCancelled,
                waTemplateMappingCancelled: settings.waTemplateMappingCancelled,
                waTemplateReminder24h: settings.waTemplateReminder24h,
                waTemplateMappingReminder24h: settings.waTemplateMappingReminder24h,
                waTemplateReminder1h: settings.waTemplateReminder1h,
                waTemplateMappingReminder1h: settings.waTemplateMappingReminder1h,
                waReminder24hEnabled: settings.waReminder24hEnabled,
                waReminder1hEnabled: settings.waReminder1hEnabled,
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch WA notification settings');
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// PUT /api/v1/chatbot/settings/wa-notifications — Update WA notification config
router.put('/settings/wa-notifications', async (req: Request, res: Response): Promise<void> => {
    try {
        const clinicId = (req as any).clinicId as string;
        const {
            waNotifyEnabled,
            waTemplateCreated,
            waTemplateMappingCreated,
            waTemplateModified,
            waTemplateMappingModified,
            waTemplateCancelled,
            waTemplateMappingCancelled,
            waTemplateReminder24h,
            waTemplateMappingReminder24h,
            waTemplateReminder1h,
            waTemplateMappingReminder1h,
            waReminder24hEnabled,
            waReminder1hEnabled,
        } = req.body;

        await ((req as any).db as Database).update(whatsappSettings)
            .set({
                waNotifyEnabled: waNotifyEnabled ?? false,
                waTemplateCreated: waTemplateCreated || null,
                waTemplateMappingCreated: waTemplateMappingCreated || null,
                waTemplateModified: waTemplateModified || null,
                waTemplateMappingModified: waTemplateMappingModified || null,
                waTemplateCancelled: waTemplateCancelled || null,
                waTemplateMappingCancelled: waTemplateMappingCancelled || null,
                waTemplateReminder24h: waTemplateReminder24h || null,
                waTemplateMappingReminder24h: waTemplateMappingReminder24h || null,
                waTemplateReminder1h: waTemplateReminder1h || null,
                waTemplateMappingReminder1h: waTemplateMappingReminder1h || null,
                waReminder24hEnabled: waReminder24hEnabled ?? false,
                waReminder1hEnabled: waReminder1hEnabled ?? false,
                updatedAt: new Date(),
            })
            .where(eq(whatsappSettings.clinicId, clinicId));

        logger.info({ clinicId }, 'WA notification settings updated');
        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, 'Failed to update WA notification settings');
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

export default router;
