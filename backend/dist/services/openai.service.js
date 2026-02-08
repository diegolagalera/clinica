"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStockItemImage = exports.checkOpenAIHealth = exports.analyzeRadiograph = void 0;
const openai_1 = __importDefault(require("openai"));
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
// Initialize OpenAI client
const openai = new openai_1.default({
    apiKey: env_js_1.config.openai?.apiKey || process.env.OPENAI_API_KEY,
});
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
const analyzeRadiograph = async (imageBase64, mimeType = 'image/png') => {
    const startTime = Date.now();
    try {
        logger_js_1.logger.info('Starting radiograph AI analysis');
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
        let parsedResult;
        try {
            // Extract JSON from response (in case there's extra text around it)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            parsedResult = JSON.parse(jsonMatch[0]);
        }
        catch (parseError) {
            logger_js_1.logger.error('Failed to parse OpenAI response:', { content, error: parseError });
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
        logger_js_1.logger.info(`Radiograph analysis completed in ${processingTime}ms`);
        return {
            ...parsedResult,
            rawResponse: response,
        };
    }
    catch (error) {
        const processingTime = Date.now() - startTime;
        logger_js_1.logger.error('OpenAI radiograph analysis failed:', {
            error: error.message,
            processingTime,
        });
        // Re-throw with meaningful error message
        if (error.code === 'insufficient_quota') {
            throw new Error('Cuota de API de OpenAI agotada. Por favor contacte al administrador.');
        }
        else if (error.code === 'invalid_api_key') {
            throw new Error('API Key de OpenAI inválida. Por favor verifique la configuración.');
        }
        else if (error.status === 429) {
            throw new Error('Demasiadas peticiones a OpenAI. Por favor intente de nuevo en unos minutos.');
        }
        else if (error.status === 503 || error.status === 500) {
            throw new Error('Servicio de OpenAI temporalmente no disponible. Por favor intente más tarde.');
        }
        throw new Error(`Error al analizar la radiografía: ${error.message}`);
    }
};
exports.analyzeRadiograph = analyzeRadiograph;
/**
 * Check if OpenAI service is available
 */
const checkOpenAIHealth = async () => {
    try {
        await openai.models.list();
        return true;
    }
    catch {
        return false;
    }
};
exports.checkOpenAIHealth = checkOpenAIHealth;
// List of allowed categories for stock item image generation
const ALLOWED_ITEM_CATEGORIES = [
    'dental', 'médico', 'medico', 'quirúrgico', 'quirurgico', 'clínico', 'clinico',
    'higiene', 'farmacéutico', 'farmaceutico', 'sanitario', 'ortodoncía', 'ortodoncia',
    'endodoncia', 'periodoncia', 'implante', 'prótesis', 'protesis', 'radiología', 'radiologia',
    'anestesia', 'esterilización', 'esterilizacion', 'desinfección', 'desinfeccion',
    'instrumental', 'guantes', 'mascarilla', 'bata', 'gorro', 'jeringa', 'aguja',
    'algodón', 'algodon', 'gasa', 'sutura', 'cemento', 'composite', 'amalgama',
    'resina', 'fresa', 'turbina', 'pieza de mano', 'lámpara', 'lampara', 'espejo',
    'explorador', 'sonda', 'cureta', 'fórceps', 'forceps', 'elevador', 'portaimpresiones',
    'material de impresión', 'material de impresion', 'silicona', 'alginato',
    'brackets', 'arco', 'ligadura', 'banda', 'separador', 'retenedor',
    'flúor', 'fluor', 'sellador', 'barniz', 'pasta profiláctica', 'pasta profilactica',
    'dique de goma', 'clamp', 'portaclamp', 'lima', 'obturador', 'gutapercha',
    'blanqueamiento', 'peróxido', 'peroxido', 'lámpara de fotocurado', 'lampara de fotocurado',
    'autoclave', 'ultrasonido', 'cavitron', 'aeropulidor',
    'medicina', 'hospital', 'clínica', 'clinica', 'consultorio', 'laboratorio',
    'pinza', 'pinzas', 'tijera', 'tijeras', 'bisturí', 'bisturi', 'escalpelo',
    'vendaje', 'apósito', 'aposito', 'esparadrapo', 'cinta', 'alcohol', 'yodo',
    'termómetro', 'termometro', 'tensiómetro', 'tensiometro', 'estetoscopio',
    'oxímetro', 'oximetro', 'desfibrilador', 'monitor', 'camilla', 'silla',
    'equipo', 'máquina', 'maquina', 'aparato', 'dispositivo', 'instrumento',
];
/**
 * Validate if an item name is related to dental/medical supplies
 */
const isValidMedicalItem = (itemName) => {
    const normalizedName = itemName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return ALLOWED_ITEM_CATEGORIES.some(category => {
        const normalizedCategory = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return normalizedName.includes(normalizedCategory) || normalizedCategory.includes(normalizedName);
    });
};
/**
 * Generate a stock item image using DALL-E
 */
const generateStockItemImage = async (itemName, itemDescription) => {
    const startTime = Date.now();
    try {
        // Validate the item is medical/dental related
        const isValid = isValidMedicalItem(itemName) ||
            (itemDescription && isValidMedicalItem(itemDescription));
        if (!isValid) {
            // Use GPT to validate if it could be a medical item
            const validationResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Eres un validador. Responde solo "SI" o "NO". ¿Es el siguiente item un producto/material/instrumento relacionado con clínicas dentales, medicina, sanidad, higiene médica, o equipamiento de consultorios médicos/dentales?'
                    },
                    {
                        role: 'user',
                        content: `Item: "${itemName}"${itemDescription ? ` - Descripción: "${itemDescription}"` : ''}`
                    }
                ],
                max_tokens: 10,
                temperature: 0,
            });
            const validation = validationResponse.choices[0]?.message?.content?.trim().toUpperCase();
            if (validation !== 'SI' && validation !== 'SÍ') {
                throw new Error('Solo se pueden generar imágenes de productos médicos, dentales o sanitarios.');
            }
        }
        logger_js_1.logger.info('Starting stock item image generation', { itemName });
        // Build a detailed prompt for DALL-E
        const prompt = `Fotografía profesional de producto para catálogo médico: ${itemName}${itemDescription ? `. ${itemDescription}` : ''}. 
Estilo: Fotografía de producto sobre fondo blanco limpio, iluminación profesional de estudio, alta calidad, vista frontal clara del producto, sin texto ni logos, enfocado y nítido.
El producto debe verse realista y profesional, como para un catálogo de suministros médicos/dentales.`;
        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
            style: 'natural',
        });
        const imageUrl = response.data[0]?.url;
        const revisedPrompt = response.data[0]?.revised_prompt || prompt;
        if (!imageUrl) {
            throw new Error('No se pudo generar la imagen');
        }
        const processingTime = Date.now() - startTime;
        logger_js_1.logger.info(`Stock item image generated in ${processingTime}ms`);
        return {
            imageUrl,
            revisedPrompt,
        };
    }
    catch (error) {
        const processingTime = Date.now() - startTime;
        logger_js_1.logger.error('DALL-E image generation failed:', {
            error: error.message,
            itemName,
            processingTime,
        });
        if (error.code === 'content_policy_violation') {
            throw new Error('El contenido de la solicitud no cumple las políticas. Intente con un nombre de producto diferente.');
        }
        else if (error.code === 'insufficient_quota') {
            throw new Error('Cuota de API de OpenAI agotada. Por favor contacte al administrador.');
        }
        else if (error.code === 'invalid_api_key') {
            throw new Error('API Key de OpenAI inválida. Por favor verifique la configuración.');
        }
        else if (error.status === 429) {
            throw new Error('Demasiadas peticiones a OpenAI. Por favor intente de nuevo en unos minutos.');
        }
        throw new Error(error.message || 'Error al generar la imagen');
    }
};
exports.generateStockItemImage = generateStockItemImage;
//# sourceMappingURL=openai.service.js.map