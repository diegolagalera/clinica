import { eq, and, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emailTemplates } from '../db/schema.js';
import { logger } from '../utils/logger.js';

// Template block types for visual editor
export interface TemplateBlock {
    id: string;
    type: 'logo' | 'text' | 'button' | 'divider' | 'spacer' | 'header';
    content?: string | Record<string, any>; // Can be string (legacy) or object (AI format)
    url?: string;
    align?: 'left' | 'center' | 'right';
    color?: string;
    backgroundColor?: string;
}

export type EmailTemplateType =
    | 'APPOINTMENT_CREATED'
    | 'APPOINTMENT_REMINDER_24H'
    | 'APPOINTMENT_REMINDER_1H'
    | 'APPOINTMENT_CANCELLED'
    | 'DOCUMENT_SIGNED'
    | 'VISIT_RATING_REQUEST'
    | 'CUSTOM';

// Template variables that can be used
export const TEMPLATE_VARIABLES = {
    patient_name: 'Nombre del paciente',
    patient_email: 'Email del paciente',
    appointment_date: 'Fecha de la cita',
    appointment_time: 'Hora de la cita',
    appointment_type: 'Tipo de cita',
    clinic_name: 'Nombre de la clínica',
    clinic_phone: 'Teléfono de la clínica',
    clinic_address: 'Dirección de la clínica',
    doctor_name: 'Nombre del profesional',
};

// Default templates
const DEFAULT_TEMPLATES: Record<EmailTemplateType, { name: string; subject: string; blocks: TemplateBlock[] }> = {
    APPOINTMENT_CREATED: {
        name: 'Cita Confirmada',
        subject: '✅ Tu cita ha sido confirmada - {{clinic_name}}',
        blocks: [
            { id: '1', type: 'text', content: '<h2 style="color: #0891b2;">¡Cita confirmada!</h2>', align: 'center' },
            { id: '2', type: 'text', content: '<p>Hola <strong>{{patient_name}}</strong>,</p><p>Tu cita ha sido programada con éxito.</p>' },
            { id: '3', type: 'divider' },
            { id: '4', type: 'text', content: '<p><strong>📅 Fecha:</strong> {{appointment_date}}</p><p><strong>🕐 Hora:</strong> {{appointment_time}}</p><p><strong>🏥 Clínica:</strong> {{clinic_name}}</p>' },
            { id: '5', type: 'divider' },
            { id: '6', type: 'text', content: '<p style="color: #6b7280; font-size: 14px;">Si necesitas cancelar o modificar tu cita, por favor contacta con nosotros.</p>' },
            { id: '7', type: 'text', content: '<p style="color: #6b7280; font-size: 12px;">{{clinic_name}} | {{clinic_phone}}</p>', align: 'center' },
        ],
    },
    APPOINTMENT_REMINDER_24H: {
        name: 'Recordatorio 24h',
        subject: '⏰ Recordatorio: Mañana tienes cita - {{clinic_name}}',
        blocks: [
            { id: '1', type: 'text', content: '<h2 style="color: #f59e0b;">⏰ Recordatorio de cita</h2>', align: 'center' },
            { id: '2', type: 'text', content: '<p>Hola <strong>{{patient_name}}</strong>,</p><p>Te recordamos que <strong>mañana</strong> tienes cita programada.</p>' },
            { id: '3', type: 'divider' },
            { id: '4', type: 'text', content: '<p><strong>📅 Fecha:</strong> {{appointment_date}}</p><p><strong>🕐 Hora:</strong> {{appointment_time}}</p><p><strong>🏥 Clínica:</strong> {{clinic_name}}</p>' },
            { id: '5', type: 'divider' },
            { id: '6', type: 'text', content: '<p style="color: #6b7280; font-size: 12px;">{{clinic_name}} | {{clinic_phone}}</p>', align: 'center' },
        ],
    },
    APPOINTMENT_REMINDER_1H: {
        name: 'Recordatorio 1h',
        subject: '🔔 Tu cita es en 1 hora - {{clinic_name}}',
        blocks: [
            { id: '1', type: 'text', content: '<h2 style="color: #ef4444;">🔔 Tu cita es pronto</h2>', align: 'center' },
            { id: '2', type: 'text', content: '<p>Hola <strong>{{patient_name}}</strong>,</p><p>Tu cita es en <strong>1 hora</strong>.</p>' },
            { id: '3', type: 'text', content: '<p><strong>🕐 Hora:</strong> {{appointment_time}}</p><p><strong>🏥 Clínica:</strong> {{clinic_name}}</p>' },
        ],
    },
    APPOINTMENT_CANCELLED: {
        name: 'Cita Cancelada',
        subject: '❌ Tu cita ha sido cancelada - {{clinic_name}}',
        blocks: [
            { id: '1', type: 'text', content: '<h2 style="color: #ef4444;">Cita cancelada</h2>', align: 'center' },
            { id: '2', type: 'text', content: '<p>Hola <strong>{{patient_name}}</strong>,</p><p>Tu cita del <strong>{{appointment_date}}</strong> a las <strong>{{appointment_time}}</strong> ha sido cancelada.</p>' },
            { id: '3', type: 'text', content: '<p>Si deseas reprogramar, por favor contacta con nosotros.</p>' },
            { id: '4', type: 'text', content: '<p style="color: #6b7280; font-size: 12px;">{{clinic_name}} | {{clinic_phone}}</p>', align: 'center' },
        ],
    },
    DOCUMENT_SIGNED: {
        name: 'Documento Firmado',
        subject: '📄 Documento firmado correctamente - {{clinic_name}}',
        blocks: [
            { id: '1', type: 'text', content: '<h2 style="color: #10b981;">✅ Documento firmado</h2>', align: 'center' },
            { id: '2', type: 'text', content: '<p>Hola <strong>{{patient_name}}</strong>,</p><p>Has firmado correctamente el documento de consentimiento.</p>' },
            { id: '3', type: 'text', content: '<p style="color: #6b7280; font-size: 12px;">{{clinic_name}}</p>', align: 'center' },
        ],
    },
    VISIT_RATING_REQUEST: {
        name: 'Valoración de Visita',
        subject: '⭐ ¿Cómo fue tu visita en {{clinic_name}}?',
        blocks: [
            { id: '1', type: 'text', content: '<h2 style="color: #8b5cf6;">⭐ Valora tu visita</h2>', align: 'center' },
            { id: '2', type: 'text', content: '<p>Hola <strong>{{patient_name}}</strong>,</p><p>Gracias por visitarnos el {{appointment_date}}.</p>' },
            { id: '3', type: 'text', content: '<p>Tu opinión es muy importante para nosotros. ¿Podrías dedicarnos un momento para valorar tu experiencia?</p>' },
            { id: '4', type: 'button', content: 'Valorar mi visita', url: '{{rating_url}}', align: 'center', backgroundColor: '#8b5cf6' },
            { id: '5', type: 'text', content: '<p style="color: #6b7280; font-size: 12px;">Este enlace es válido durante 7 días.</p>', align: 'center' },
        ],
    },
    CUSTOM: {
        name: 'Plantilla Personalizada',
        subject: 'Mensaje de {{clinic_name}}',
        blocks: [
            { id: '1', type: 'text', content: '<p>Escribe tu contenido aquí...</p>' },
        ],
    },
};

/**
 * Get all templates for a clinic
 */
export const getTemplates = async (clinicId: string) => {
    return db.query.emailTemplates.findMany({
        where: eq(emailTemplates.clinicId, clinicId),
        orderBy: (t, { asc }) => [asc(t.type), asc(t.name)],
    });
};

/**
 * Get a specific template by ID
 */
export const getTemplateById = async (id: string, clinicId: string) => {
    return db.query.emailTemplates.findFirst({
        where: and(eq(emailTemplates.id, id), eq(emailTemplates.clinicId, clinicId)),
    });
};

/**
 * Get active template for a specific type
 */
export const getActiveTemplate = async (clinicId: string, type: EmailTemplateType) => {
    logger.info(`getActiveTemplate called with clinicId=${clinicId}, type=${type}`);

    // First try to get clinic's custom template
    const customTemplate = await db.query.emailTemplates.findFirst({
        where: and(
            eq(emailTemplates.clinicId, clinicId),
            eq(emailTemplates.type, type),
            eq(emailTemplates.isActive, true)
        ),
    });

    if (customTemplate) {
        logger.info(`Found custom template: ${customTemplate.name} (id: ${customTemplate.id})`);
        return customTemplate;
    }

    logger.info(`No custom template found, using default for type: ${type}`);

    // Return default template
    return {
        id: null,
        type,
        ...DEFAULT_TEMPLATES[type],
        isDefault: true,
    };
};

/**
 * Create a new template
 */
export const createTemplate = async (
    clinicId: string,
    data: {
        type: EmailTemplateType;
        name: string;
        subject: string;
        blocks: TemplateBlock[];
    }
) => {
    const [template] = await db
        .insert(emailTemplates)
        .values({
            clinicId,
            type: data.type,
            name: data.name,
            subject: data.subject,
            blocks: data.blocks,
        })
        .returning();

    return template;
};

/**
 * Update a template
 */
export const updateTemplate = async (
    id: string,
    clinicId: string,
    data: {
        name?: string;
        subject?: string;
        blocks?: TemplateBlock[];
        isActive?: boolean;
    }
) => {
    // If activating this template, deactivate others of the same type
    if (data.isActive === true) {
        // First get the template to know its type
        const template = await db.query.emailTemplates.findFirst({
            where: and(eq(emailTemplates.id, id), eq(emailTemplates.clinicId, clinicId)),
        });

        if (template) {
            // Deactivate all other templates of the same type (excluding current)
            await db
                .update(emailTemplates)
                .set({ isActive: false, updatedAt: new Date() })
                .where(
                    and(
                        eq(emailTemplates.clinicId, clinicId),
                        eq(emailTemplates.type, template.type),
                        ne(emailTemplates.id, id) // Exclude current template
                    )
                );
        }
    }

    const [updated] = await db
        .update(emailTemplates)
        .set({
            ...data,
            updatedAt: new Date(),
        })
        .where(and(eq(emailTemplates.id, id), eq(emailTemplates.clinicId, clinicId)))
        .returning();

    return updated;
};

/**
 * Delete a template
 */
export const deleteTemplate = async (id: string, clinicId: string) => {
    await db
        .delete(emailTemplates)
        .where(and(eq(emailTemplates.id, id), eq(emailTemplates.clinicId, clinicId)));

    return true;
};

/**
 * Get default template for a type
 */
export const getDefaultTemplate = (type: EmailTemplateType) => {
    return DEFAULT_TEMPLATES[type] || DEFAULT_TEMPLATES.CUSTOM;
};

/**
 * Render template blocks to HTML
 * Supports both legacy format (content as string) and AI format (content as object)
 */
export const renderBlocksToHtml = (blocks: TemplateBlock[]): string => {
    const blockHtmls = blocks.map((block) => {
        const align = block.align || 'left';
        const style = `text-align: ${align};`;

        // Handle content - can be string or object
        const getContentText = (block: any): string => {
            if (typeof block.content === 'string') {
                return block.content;
            }
            if (typeof block.content === 'object' && block.content !== null) {
                // AI format: content.html or content.text
                return block.content.html || block.content.text || '';
            }
            return '';
        };

        switch (block.type) {
            case 'header': {
                // AI format: {"type": "header", "content": {"text": "...", "backgroundColor": "...", "textColor": "..."}}
                const text = typeof block.content === 'object' ? block.content?.text : block.content || '';
                const bgColor = typeof block.content === 'object' ? block.content?.backgroundColor : '#0891b2';
                const textColor = typeof block.content === 'object' ? block.content?.textColor : '#ffffff';
                return `<div style="background-color: ${bgColor}; color: ${textColor}; padding: 24px; text-align: center; font-size: 24px; font-weight: bold; border-radius: 8px;">${text}</div>`;
            }
            case 'logo': {
                // Check both legacy block.url and new content.url format
                const logoUrl = block.url || (typeof block.content === 'object' ? block.content?.url : null);
                return logoUrl
                    ? `<div style="${style}"><img src="${logoUrl}" alt="Logo" style="max-width: 200px; height: auto;" /></div>`
                    : '';
            }
            case 'text': {
                const textContent = getContentText(block);
                return `<div style="${style}">${textContent}</div>`;
            }
            case 'button': {
                // AI format: {"type": "button", "content": {"buttonText": "...", "buttonUrl": "...", "buttonColor": "..."}}
                let buttonText: string, buttonUrl: string, buttonColor: string;
                if (typeof block.content === 'object' && block.content !== null) {
                    buttonText = block.content.buttonText || 'Botón';
                    buttonUrl = block.content.buttonUrl || '#';
                    buttonColor = block.content.buttonColor || '#0891b2';
                } else {
                    buttonText = block.content || 'Botón';
                    buttonUrl = block.url || '#';
                    buttonColor = block.backgroundColor || '#0891b2';
                }
                return `<div style="${style}"><a href="${buttonUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${buttonColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">${buttonText}</a></div>`;
            }
            case 'divider':
                return '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />';
            case 'spacer': {
                const height = typeof block.content === 'object' ? block.content?.height || 24 : 24;
                return `<div style="height: ${height}px;"></div>`;
            }
            default:
                return '';
        }
    });

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #ffffff;">
            ${blockHtmls.join('\n')}
        </div>
    `;
};

/**
 * Replace template variables with actual values
 */
export const replaceVariables = (
    content: string,
    variables: Record<string, string>
): string => {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
};

/**
 * Get list of available template types with labels
 */
export const getTemplateTypes = () => [
    { value: 'APPOINTMENT_CREATED', label: 'Cita Confirmada' },
    { value: 'APPOINTMENT_REMINDER_24H', label: 'Recordatorio 24h' },
    { value: 'APPOINTMENT_REMINDER_1H', label: 'Recordatorio 1h' },
    { value: 'APPOINTMENT_CANCELLED', label: 'Cita Cancelada' },
    { value: 'DOCUMENT_SIGNED', label: 'Documento Firmado' },
    { value: 'VISIT_RATING_REQUEST', label: 'Valoración de Visita' },
    { value: 'CUSTOM', label: 'Personalizada' },
];
