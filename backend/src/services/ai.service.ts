import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { TemplateBlock } from './email-template.service.js';
import { AiUsageService } from './ai-usage.service.js';
import type { Database } from '../db/index.js';

// Initialize OpenAI client
const openai = config.openai.apiKey
    ? new OpenAI({ apiKey: config.openai.apiKey })
    : null;

// System prompt - Focused but not overly restrictive
const SYSTEM_PROMPT = `Eres un asistente especializado en crear plantillas de email profesionales para clínicas (dentales, médicas, estéticas, etc.).

TU MISIÓN:
Generar plantillas de email atractivas y profesionales basándote en la descripción del usuario.

TIPOS DE EMAILS QUE PUEDES CREAR:
- Confirmación de citas
- Recordatorios de citas (24h, 1h antes, etc.)
- Cancelación de citas (invitando a reagendar)
- Bienvenida a nuevos pacientes
- Documentos firmados
- Promociones y ofertas especiales
- Felicitaciones (Navidad, cumpleaños, etc.)
- Seguimiento post-tratamiento
- Cualquier comunicación profesional clínica-paciente

RECHAZA ÚNICAMENTE si el usuario pide:
- Código de programación
- Ensayos o textos académicos
- Contenido no relacionado con comunicación clínica-paciente
En ese caso responde: {"error": "Solo puedo crear plantillas de email para comunicación con pacientes."}

VARIABLES DISPONIBLES (úsalas en el contenido):
- {{patient_name}} - Nombre del paciente
- {{appointment_date}} - Fecha de la cita
- {{appointment_time}} - Hora de la cita
- {{clinic_name}} - Nombre de la clínica
- {{doctor_name}} - Nombre del profesional
- {{clinic_phone}} - Teléfono de la clínica

FORMATO DE RESPUESTA (JSON estricto, sin texto adicional):
{
  "subject": "Asunto del email con emojis opcionales",
  "blocks": [
    {"type": "header", "content": {"text": "Título", "backgroundColor": "#0891b2", "textColor": "#ffffff"}},
    {"type": "text", "content": {"html": "<p>Contenido HTML</p>"}},
    {"type": "button", "content": {"buttonText": "Texto", "buttonUrl": "#", "buttonColor": "#0891b2"}},
    {"type": "divider", "content": {}},
    {"type": "spacer", "content": {"height": 20}}
  ]
}

TIPOS DE BLOQUES: header, text, button, divider, spacer

Sé creativo con los colores, emojis y diseño según el contexto (navideño, profesional, amigable, etc.).`;

// Error types for better handling
export class AIServiceError extends Error {
    constructor(
        message: string,
        public code: 'API_KEY_MISSING' | 'RATE_LIMIT' | 'INVALID_REQUEST' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'UNKNOWN'
    ) {
        super(message);
        this.name = 'AIServiceError';
    }
}

// Interface for AI response
interface AITemplateResponse {
    subject: string;
    blocks: TemplateBlock[];
    error?: string;
}

/**
 * Generate email template blocks using AI
 */
export const generateEmailTemplate = async (
    db: Database,
    userPrompt: string,
    clinicId?: string
): Promise<{ success: true; data: AITemplateResponse } | { success: false; error: string; code: string }> => {
    // Check if OpenAI is configured
    if (!openai) {
        logger.warn('OpenAI API key not configured');
        return {
            success: false,
            error: 'La API de IA no está configurada. Contacta con el administrador.',
            code: 'API_KEY_MISSING'
        };
    }

    // Enforce AI quota
    if (clinicId) {
        try {
            await AiUsageService.enforceQuota(db, clinicId);
        } catch (e: any) {
            return {
                success: false,
                error: e.message,
                code: 'AI_QUOTA_EXCEEDED'
            };
        }
    }

    // Validate prompt is not empty
    if (!userPrompt || userPrompt.trim().length < 5) {
        return {
            success: false,
            error: 'Por favor, describe la plantilla que deseas crear.',
            code: 'INVALID_REQUEST'
        };
    }

    // Limit prompt length for safety
    const sanitizedPrompt = userPrompt.trim().slice(0, 500);

    try {
        logger.info(`Generating email template with AI. Prompt: "${sanitizedPrompt.slice(0, 50)}..."`);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: sanitizedPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            logger.error('Empty response from OpenAI');
            return {
                success: false,
                error: 'No se recibió respuesta de la IA. Inténtalo de nuevo.',
                code: 'INVALID_RESPONSE'
            };
        }

        // Parse JSON response
        let parsed: AITemplateResponse;
        try {
            parsed = JSON.parse(content);
        } catch (parseError) {
            logger.error(`Failed to parse AI response: ${content}`);
            return {
                success: false,
                error: 'La respuesta de la IA no tiene el formato correcto. Inténtalo de nuevo.',
                code: 'INVALID_RESPONSE'
            };
        }

        // Check if AI refused (non-email request)
        if (parsed.error) {
            return {
                success: false,
                error: parsed.error,
                code: 'INVALID_REQUEST'
            };
        }

        // Validate response structure
        if (!parsed.blocks || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
            logger.error('Invalid blocks structure in AI response');
            return {
                success: false,
                error: 'La IA no generó bloques válidos. Intenta ser más específico.',
                code: 'INVALID_RESPONSE'
            };
        }

        // Normalize blocks to ensure they have IDs
        const normalizedBlocks = parsed.blocks.map((block, index) => ({
            ...block,
            id: block.id || `ai-${Date.now()}-${index}`,
        }));

        logger.info(`AI successfully generated ${normalizedBlocks.length} blocks`);

        // Log AI usage
        if (clinicId) {
            const tokens = {
                prompt: response.usage?.prompt_tokens || 500,
                completion: response.usage?.completion_tokens || 1000,
                total: response.usage?.total_tokens || 1500,
            };
            await AiUsageService.logUsage(db, clinicId, 'email_template', 'gpt-4o-mini', tokens);
        }

        return {
            success: true,
            data: {
                subject: parsed.subject || 'Email generado por IA',
                blocks: normalizedBlocks
            }
        };

    } catch (error: any) {
        logger.error(`OpenAI API error: ${error.message}`);

        // Handle specific OpenAI errors
        if (error?.status === 429) {
            return {
                success: false,
                error: 'La API de IA está saturada. Espera unos segundos e inténtalo de nuevo.',
                code: 'RATE_LIMIT'
            };
        }

        if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
            return {
                success: false,
                error: 'No se pudo conectar con la IA. Verifica tu conexión.',
                code: 'TIMEOUT'
            };
        }

        return {
            success: false,
            error: 'Error al generar la plantilla. Inténtalo de nuevo.',
            code: 'UNKNOWN'
        };
    }
};

/**
 * Check if AI service is available
 */
export const isAIAvailable = (): boolean => {
    return !!openai;
};
