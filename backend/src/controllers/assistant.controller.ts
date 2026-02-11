import { Response } from 'express';
import { chatWithAssistant, AssistantMessage } from '../services/assistant.service.js';
import { logger } from '../utils/logger.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../middleware/error.middleware.js';

/**
 * Rate limiting map (in-memory for simplicity)
 * In production, consider using Redis
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 15; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

/**
 * Check rate limit for user
 */
const checkRateLimit = (userId: string): boolean => {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
        return true;
    }

    if (userLimit.count >= RATE_LIMIT) {
        return false;
    }

    userLimit.count++;
    return true;
};

/**
 * POST /api/v1/assistant/chat
 * Send a message to the FAQ assistant
 */
export const chat = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || 'anonymous';
    const { message, history } = req.body;

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({
            success: false,
            error: 'El mensaje es requerido',
        });
        return;
    }

    // Check message length
    if (message.length > 1000) {
        res.status(400).json({
            success: false,
            error: 'El mensaje es demasiado largo (máximo 1000 caracteres)',
        });
        return;
    }

    // Rate limiting
    if (!checkRateLimit(userId)) {
        logger.warn('Assistant rate limit exceeded', { userId });
        res.status(429).json({
            success: false,
            error: 'Has enviado demasiados mensajes. Espera un momento antes de intentar de nuevo.',
        });
        return;
    }

    // Validate and sanitize history
    let conversationHistory: AssistantMessage[] = [];
    if (Array.isArray(history)) {
        conversationHistory = history
            .filter((msg): msg is AssistantMessage =>
                typeof msg === 'object' &&
                (msg.role === 'user' || msg.role === 'assistant') &&
                typeof msg.content === 'string'
            )
            .slice(-10); // Keep last 10 messages for context
    }

    // Get response from assistant
    const clinicId = req.tenantContext?.clinicId || undefined;
    const response = await chatWithAssistant(req.db!, message.trim(), conversationHistory, clinicId);

    if (!response.success) {
        res.status(500).json({
            success: false,
            error: response.error,
        });
        return;
    }

    res.json({
        success: true,
        message: response.message,
    });
});
