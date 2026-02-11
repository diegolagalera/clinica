import type { Database } from '../db/index.js';
import {
    chatConversations,
    chatMessages,
    chatLeads,
    chatAiLogs,
    whatsappSettings,
} from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { ChatbotKnowledgeService } from './chatbot-knowledge.service.js';
import { decrypt } from '../utils/encryption.js';
import { AiUsageService } from './ai-usage.service.js';

const DEFAULT_SYSTEM_PROMPT = `Eres un asistente virtual profesional de una clínica dental. Tu objetivo es:
1. Responder preguntas sobre la clínica, servicios, horarios y precios de manera clara y amigable.
2. Ayudar a los pacientes a agendar citas cuando sea posible.
3. Proporcionar información general sobre tratamientos dentales.
4. Si no tienes información suficiente, indica amablemente que un miembro del equipo se pondrá en contacto.

Reglas:
- Responde siempre en español.
- Sé profesional pero cercano.
- No inventes información médica — usa solo la base de conocimiento proporcionada.
- Si te piden algo fuera de tu capacidad (diagnóstico, recetar medicamentos), sugiere que el paciente visite la clínica.
- Mantén las respuestas concisas (máximo 3-4 párrafos cortos).`;

/**
 * Chatbot AI Service
 * Handles AI-powered response generation using RAG context and conversation history.
 */
export class ChatbotAiService {

    /**
     * Generate an AI response for an incoming message.
     */
    static async generateResponse(db: Database,
        clinicId: string,
        conversationId: string,
        userMessage: string,
        conversationHistory: { role: string; content: string }[],
        systemPrompt?: string | null,
    ): Promise<{ response: string; ragChunksUsed: number; ragContext: string; tokens: { prompt: number; completion: number; total: number }; quotaBlocked?: boolean; quotaReason?: string }> {
        const startTime = Date.now();

        try {
            // Enforce AI quota — if blocked, signal caller to skip sending
            try {
                await AiUsageService.enforceQuota(db, clinicId);
            } catch (quotaError: any) {
                logger.warn({ clinicId, error: quotaError.message }, 'AI quota blocked for chatbot');
                return {
                    response: '',
                    ragChunksUsed: 0,
                    ragContext: '',
                    tokens: { prompt: 0, completion: 0, total: 0 },
                    quotaBlocked: true,
                    quotaReason: quotaError.message,
                };
            }

            // 1. Retrieve relevant knowledge via RAG
            const relevantChunks = await ChatbotKnowledgeService.searchRelevantChunks(
                db,
                clinicId,
                userMessage,
                5
            );

            // Debug: Log RAG search results
            logger.info({
                clinicId,
                userMessage,
                chunksFound: relevantChunks.length,
                chunks: relevantChunks.map(c => ({
                    articleTitle: c.articleTitle,
                    similarity: c.similarity.toFixed(4),
                    contentPreview: c.content.substring(0, 80) + '...',
                })),
            }, 'RAG search results');

            // 2. Build RAG context
            const filteredChunks = relevantChunks.filter(c => c.similarity > 0.3);
            const ragContext = filteredChunks.length > 0
                ? filteredChunks
                    .map((c, i) => `[Fuente: ${c.articleTitle}]\n${c.content}`)
                    .join('\n\n---\n\n')
                : '';

            logger.info({
                filteredChunks: filteredChunks.length,
                ragContextLength: ragContext.length,
            }, 'RAG context built');

            // 3. Build system prompt
            const prompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;
            const fullSystemPrompt = ragContext
                ? `${prompt}\n\n## Base de Conocimiento (usa esta información para responder):\n\n${ragContext}`
                : prompt;

            // 4. Build messages for OpenAI
            const messages = [
                { role: 'system', content: fullSystemPrompt },
                // Include last 10 messages for context
                ...conversationHistory.slice(-10),
                { role: 'user', content: userMessage },
            ];

            // 5. Call OpenAI
            const apiKey = config.openai.apiKey;
            if (!apiKey) {
                throw new Error('OPENAI_API_KEY is not configured');
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages,
                    temperature: 0.7,
                    max_tokens: 500,
                }),
            });

            const data = await response.json() as any;

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${data.error?.message || response.status}`);
            }

            const aiResponse = data.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
            const latencyMs = Date.now() - startTime;
            const tokens = {
                prompt: data.usage?.prompt_tokens || 0,
                completion: data.usage?.completion_tokens || 0,
                total: data.usage?.total_tokens || 0,
            };

            // 6. Log AI interaction
            await db.insert(chatAiLogs).values({
                conversationId,
                clinicId,
                promptTokens: tokens.prompt,
                completionTokens: tokens.completion,
                totalTokens: tokens.total,
                model: 'gpt-4o-mini',
                latencyMs,
                ragChunksUsed: relevantChunks.filter(c => c.similarity > 0.3).length,
                ragContext: ragContext || null,
            });

            // 7. Log AI usage for billing
            await AiUsageService.logUsage(db, clinicId, 'chatbot', 'gpt-4o-mini', tokens, { conversationId });

            logger.info({
                conversationId,
                tokens: tokens.total,
                latencyMs,
                ragChunks: relevantChunks.length,
            }, 'AI response generated');

            return {
                response: aiResponse,
                ragChunksUsed: relevantChunks.filter(c => c.similarity > 0.3).length,
                ragContext,
                tokens,
            };
        } catch (error) {
            const latencyMs = Date.now() - startTime;
            logger.error({ error, conversationId, latencyMs }, 'Failed to generate AI response');

            // Log the error
            await db.insert(chatAiLogs).values({
                conversationId,
                clinicId,
                model: 'gpt-4o-mini',
                latencyMs,
                errorMessage: String(error),
            }).catch(() => { });

            return {
                response: 'Lo siento, estoy experimentando problemas técnicos. Un miembro de nuestro equipo se pondrá en contacto contigo pronto.',
                ragChunksUsed: 0,
                ragContext: '',
                tokens: { prompt: 0, completion: 0, total: 0 },
            };
        }
    }
    /**
     * Transcribe audio using OpenAI Whisper.
     */
    static async transcribeAudio(db: Database,
        audioBuffer: Buffer,
        mimeType: string = 'audio/ogg',
        clinicId?: string
    ): Promise<string> {
        try {
            const apiKey = config.openai.apiKey;
            if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

            // Enforce AI quota for WhatsApp audio transcription
            if (clinicId) {
                await AiUsageService.enforceQuota(db, clinicId);
            }

            const formData = new FormData();
            // Append file with filename and correct mime type
            const blob = new Blob([audioBuffer], { type: mimeType });
            formData.append('file', blob, 'audio.ogg');
            formData.append('model', 'whisper-1');
            formData.append('language', 'es'); // Force Spanish for better accuracy

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: formData,
            });

            const data = await response.json() as any;

            if (!response.ok) {
                throw new Error(`OpenAI Whisper error: ${data.error?.message || response.status}`);
            }

            const transcription = data.text || '';

            // Log whisper usage (estimate ~750 tokens per minute of audio)
            if (clinicId && transcription) {
                await AiUsageService.logUsage(db, clinicId, 'chatbot', 'whisper-1', { prompt: 750, completion: 0, total: 750 });
            }

            return transcription;
        } catch (error) {
            logger.error({ error }, 'Failed to transcribe audio');
            return ''; // Return empty string on failure to avoid crashing flow
        }
    }
}
