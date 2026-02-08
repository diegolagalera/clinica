"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVoiceRecording = exports.extractFieldsFromTranscription = exports.transcribeAudio = void 0;
const openai_1 = __importDefault(require("openai"));
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
// Initialize OpenAI client
const openai = new openai_1.default({
    apiKey: env_js_1.config.openai?.apiKey || process.env.OPENAI_API_KEY,
});
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
const transcribeAudio = async (audioBuffer, filename = 'audio.webm') => {
    const startTime = Date.now();
    try {
        logger_js_1.logger.info('Starting audio transcription with Whisper');
        // Create a File-like object using OpenAI's toFile helper
        const file = await openai_1.default.toFile(audioBuffer, filename, { type: 'audio/webm' });
        const response = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'es',
            response_format: 'text',
        });
        const processingTime = Date.now() - startTime;
        logger_js_1.logger.info(`Audio transcription completed in ${processingTime}ms`);
        return response;
    }
    catch (error) {
        logger_js_1.logger.error('Whisper transcription failed:', { error: error.message });
        throw new Error(`Error al transcribir el audio: ${error.message}`);
    }
};
exports.transcribeAudio = transcribeAudio;
/**
 * Extract structured fields from transcription using GPT-4
 */
const extractFieldsFromTranscription = async (transcription) => {
    const startTime = Date.now();
    try {
        logger_js_1.logger.info('Extracting fields from transcription with GPT-4');
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
        let parsedResult;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            parsedResult = JSON.parse(jsonMatch[0]);
        }
        catch (parseError) {
            logger_js_1.logger.error('Failed to parse OpenAI response:', { content, error: parseError });
            // Return basic result if parsing fails
            parsedResult = {
                title: 'Nota de voz',
                content: transcription,
                diagnosis: '',
                treatment: '',
            };
        }
        const processingTime = Date.now() - startTime;
        logger_js_1.logger.info(`Field extraction completed in ${processingTime}ms`);
        return {
            ...parsedResult,
            rawTranscription: transcription,
        };
    }
    catch (error) {
        logger_js_1.logger.error('GPT-4 field extraction failed:', { error: error.message });
        throw new Error(`Error al procesar la transcripción: ${error.message}`);
    }
};
exports.extractFieldsFromTranscription = extractFieldsFromTranscription;
/**
 * Full pipeline: transcribe audio and extract fields
 */
const processVoiceRecording = async (audioBuffer, filename = 'audio.webm') => {
    // Step 1: Transcribe audio to text
    const transcription = await (0, exports.transcribeAudio)(audioBuffer, filename);
    if (!transcription || transcription.trim().length === 0) {
        throw new Error('No se pudo transcribir el audio. Por favor intente de nuevo.');
    }
    // Step 2: Extract structured fields
    const result = await (0, exports.extractFieldsFromTranscription)(transcription);
    return result;
};
exports.processVoiceRecording = processVoiceRecording;
//# sourceMappingURL=voice-transcription.service.js.map