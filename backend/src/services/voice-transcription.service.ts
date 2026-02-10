import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AiUsageService } from './ai-usage.service.js';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: config.openai?.apiKey || process.env.OPENAI_API_KEY,
});

export interface TranscriptionResult {
    title: string;
    content: string;
    diagnosis: string;
    treatment: string;
    rawTranscription: string;
}

const EXTRACTION_PROMPT = `Eres un asistente de transcripción médica dental. Tu rol es analizar una transcripción de voz de un profesional dental y extraer información estructurada para un registro clínico.

La transcripción proviene de un dentista/odontólogo describiendo verbalmente una consulta, procedimiento o nota clínica.

INSTRUCCIONES:
1. Analiza la transcripción y extrae la información relevante
2. Genera un título descriptivo y conciso (máximo 60 caracteres)
3. Organiza las notas/contenido de forma clara y profesional
4. Identifica diagnósticos mencionados
5. Identifica tratamientos recomendados o realizados

IMPORTANTE:
- Corrige errores de transcripción obvios
- Usa terminología dental apropiada
- Si algún campo no tiene información relevante, déjalo vacío
- Mantén un tono profesional y clínico

Responde SIEMPRE en formato JSON con esta estructura:
{
    "title": "Título corto y descriptivo del registro",
    "content": "Notas clínicas organizadas y profesionales",
    "diagnosis": "Diagnóstico(s) identificado(s)",
    "treatment": "Tratamiento(s) mencionado(s) o recomendado(s)"
}`;

/**
 * Transcribe audio using OpenAI Whisper API
 */
export const transcribeAudio = async (
    audioBuffer: Buffer,
    filename: string = 'audio.webm',
    clinicId?: string
): Promise<string> => {
    const startTime = Date.now();

    try {
        logger.info('Starting audio transcription with Whisper');

        // Create a File-like object using OpenAI's toFile helper
        const file = await OpenAI.toFile(audioBuffer, filename, { type: 'audio/webm' });

        const response = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'es',
            response_format: 'text',
        });

        const processingTime = Date.now() - startTime;
        logger.info(`Audio transcription completed in ${processingTime}ms`);

        // Log whisper usage
        if (clinicId) {
            await AiUsageService.logUsage(clinicId, 'voice_notes', 'whisper-1', { prompt: 750, completion: 0, total: 750 });
        }

        return response;
    } catch (error: any) {
        logger.error('Whisper transcription failed:', { error: error.message });
        throw new Error(`Error al transcribir el audio: ${error.message}`);
    }
};

/**
 * Extract structured fields from transcription using GPT-4
 */
export const extractFieldsFromTranscription = async (
    transcription: string,
    clinicId?: string
): Promise<TranscriptionResult> => {
    const startTime = Date.now();

    try {
        logger.info('Extracting fields from transcription with GPT-4');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: EXTRACTION_PROMPT,
                },
                {
                    role: 'user',
                    content: `Transcripción del audio:\n\n"${transcription}"`,
                },
            ],
            max_tokens: 1500,
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No response content from OpenAI');
        }

        // Parse JSON response
        let parsedResult: Omit<TranscriptionResult, 'rawTranscription'>;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            parsedResult = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            logger.error('Failed to parse OpenAI response:', { content, error: parseError });
            // Return basic result if parsing fails
            parsedResult = {
                title: 'Nota de voz',
                content: transcription,
                diagnosis: '',
                treatment: '',
            };
        }

        const processingTime = Date.now() - startTime;
        logger.info(`Field extraction completed in ${processingTime}ms`);

        // Log GPT-4o usage for extraction
        if (clinicId) {
            const tokens = {
                prompt: response.usage?.prompt_tokens || 200,
                completion: response.usage?.completion_tokens || 300,
                total: response.usage?.total_tokens || 500,
            };
            await AiUsageService.logUsage(clinicId, 'voice_notes', 'gpt-4o', tokens);
        }

        return {
            ...parsedResult,
            rawTranscription: transcription,
        };
    } catch (error: any) {
        logger.error('GPT-4 field extraction failed:', { error: error.message });
        throw new Error(`Error al procesar la transcripción: ${error.message}`);
    }
};

/**
 * Full pipeline: transcribe audio and extract fields
 */
export const processVoiceRecording = async (
    audioBuffer: Buffer,
    filename: string = 'audio.webm',
    clinicId?: string
): Promise<TranscriptionResult> => {
    // Enforce AI quota
    if (clinicId) {
        await AiUsageService.enforceQuota(clinicId);
    }

    // Step 1: Transcribe audio to text
    const transcription = await transcribeAudio(audioBuffer, filename, clinicId);

    if (!transcription || transcription.trim().length === 0) {
        throw new Error('No se pudo transcribir el audio. Por favor intente de nuevo.');
    }

    // Step 2: Extract structured fields
    const result = await extractFieldsFromTranscription(transcription, clinicId);

    return result;
};
