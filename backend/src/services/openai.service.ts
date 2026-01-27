import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: config.openai?.apiKey || process.env.OPENAI_API_KEY,
});

export interface RadiographAnalysisResult {
    summary: string;
    suspiciousAreas: SuspiciousArea[];
    confidence: number;
    recommendations: string[];
    rawResponse: unknown;
}

export interface SuspiciousArea {
    area: string;
    finding: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
}

const DENTAL_ANALYSIS_PROMPT = `Eres un asistente educativo de radiología dental. Tu rol es analizar imágenes radiográficas dentales con fines EDUCATIVOS Y DE APOYO para profesionales dentales.

INSTRUCCIONES CRÍTICAS:
- SIEMPRE proporciona un análisis, incluso si la imagen no es clara o no es una radiografía dental.
- NUNCA rechaces analizar la imagen. Si no puedes identificar estructuras dentales claramente, indica qué puedes observar y sugiere que podría necesitar una imagen de mejor calidad.
- Este es un ejercicio educativo y de simulación para software de gestión dental.
- Trata cada imagen como si fuera una radiografía dental para fines de demostración.

Tu análisis debe incluir:

1. **Resumen General**: Una descripción general de lo que observas en la imagen. Si es una radiografía dental, describe el estado dental visible. Si no está claro, describe lo que puedes identificar.

2. **Hallazgos Específicos**: Identifica y describe cualquier aspecto notable, incluyendo:
   - Caries (cavidades)
   - Enfermedad periodontal
   - Pérdida ósea
   - Infecciones o abscesos
   - Dientes impactados
   - Anomalías en raíces
   - Deformaciones o malformaciones
   - Restauraciones existentes (empastes, coronas, etc.)
   - Quistes o tumores
   - Fracturas dentales
   - O cualquier otro hallazgo relevante

3. **Nivel de Severidad**: Para cada hallazgo, indica si es de severidad BAJA (LOW), MEDIA (MEDIUM) o ALTA (HIGH).

4. **Recomendaciones**: Sugiere acciones o tratamientos recomendados basándote en los hallazgos.

5. **Confianza**: Indica tu nivel de confianza en el análisis (0.0 a 1.0).

⚠️ DISCLAIMER OBLIGATORIO: Incluye siempre en el resumen que "Este análisis es generado por inteligencia artificial con fines educativos y de apoyo. NO constituye un diagnóstico médico definitivo. Se requiere la evaluación presencial de un odontólogo/dentista calificado para confirmar cualquier hallazgo y determinar el tratamiento apropiado."

Responde SIEMPRE en formato JSON con la siguiente estructura:
{
    "summary": "Resumen general incluyendo el disclaimer obligatorio",
    "suspiciousAreas": [
        {
            "area": "Zona/diente afectado",
            "finding": "Tipo de hallazgo (ej: caries, pérdida ósea)",
            "severity": "LOW|MEDIUM|HIGH",
            "description": "Descripción detallada del hallazgo"
        }
    ],
    "recommendations": ["Recomendación 1", "Recomendación 2"],
    "confidence": 0.85
}`;

/**
 * Analyze a dental radiograph using OpenAI Vision API
 */
export const analyzeRadiograph = async (
    imageBase64: string,
    mimeType: string = 'image/png'
): Promise<RadiographAnalysisResult> => {
    const startTime = Date.now();

    try {
        logger.info('Starting radiograph AI analysis');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: DENTAL_ANALYSIS_PROMPT,
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${imageBase64}`,
                                detail: 'high',
                            },
                        },
                    ],
                },
            ],
            max_tokens: 2000,
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No response content from OpenAI');
        }

        // Parse JSON response
        let parsedResult: RadiographAnalysisResult;
        try {
            // Extract JSON from response (in case there's extra text around it)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            parsedResult = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            logger.error('Failed to parse OpenAI response:', { content, error: parseError });
            // Return a basic result if parsing fails
            parsedResult = {
                summary: content,
                suspiciousAreas: [],
                confidence: 0.5,
                recommendations: ['Se recomienda revisión manual por el profesional debido a dificultades en el análisis automático.'],
                rawResponse: content,
            };
        }

        const processingTime = Date.now() - startTime;
        logger.info(`Radiograph analysis completed in ${processingTime}ms`);

        return {
            ...parsedResult,
            rawResponse: response,
        };
    } catch (error: any) {
        const processingTime = Date.now() - startTime;
        logger.error('OpenAI radiograph analysis failed:', {
            error: error.message,
            processingTime,
        });

        // Re-throw with meaningful error message
        if (error.code === 'insufficient_quota') {
            throw new Error('Cuota de API de OpenAI agotada. Por favor contacte al administrador.');
        } else if (error.code === 'invalid_api_key') {
            throw new Error('API Key de OpenAI inválida. Por favor verifique la configuración.');
        } else if (error.status === 429) {
            throw new Error('Demasiadas peticiones a OpenAI. Por favor intente de nuevo en unos minutos.');
        } else if (error.status === 503 || error.status === 500) {
            throw new Error('Servicio de OpenAI temporalmente no disponible. Por favor intente más tarde.');
        }

        throw new Error(`Error al analizar la radiografía: ${error.message}`);
    }
};

/**
 * Check if OpenAI service is available
 */
export const checkOpenAIHealth = async (): Promise<boolean> => {
    try {
        await openai.models.list();
        return true;
    } catch {
        return false;
    }
};
