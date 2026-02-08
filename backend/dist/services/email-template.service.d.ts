export interface TemplateBlock {
    id: string;
    type: 'logo' | 'text' | 'button' | 'divider' | 'spacer' | 'header';
    content?: string | Record<string, any>;
    url?: string;
    align?: 'left' | 'center' | 'right';
    color?: string;
    backgroundColor?: string;
}
export type EmailTemplateType = 'APPOINTMENT_CREATED' | 'APPOINTMENT_REMINDER_24H' | 'APPOINTMENT_REMINDER_1H' | 'APPOINTMENT_CANCELLED' | 'DOCUMENT_SIGNED' | 'VISIT_RATING_REQUEST' | 'CUSTOM';
export declare const TEMPLATE_VARIABLES: {
    patient_name: string;
    patient_email: string;
    appointment_date: string;
    appointment_time: string;
    appointment_type: string;
    clinic_name: string;
    clinic_phone: string;
    clinic_address: string;
    doctor_name: string;
};
/**
 * Get all templates for a clinic
 */
export declare const getTemplates: (clinicId: string) => Promise<{
    type: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "DOCUMENT_SIGNED" | "VISIT_RATING_REQUEST" | "CUSTOM";
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    subject: string;
    blocks: unknown;
    isDefault: boolean;
}[]>;
/**
 * Get a specific template by ID
 */
export declare const getTemplateById: (id: string, clinicId: string) => Promise<{
    type: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "DOCUMENT_SIGNED" | "VISIT_RATING_REQUEST" | "CUSTOM";
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    subject: string;
    blocks: unknown;
    isDefault: boolean;
} | undefined>;
/**
 * Get active template for a specific type
 */
export declare const getActiveTemplate: (clinicId: string, type: EmailTemplateType) => Promise<{
    type: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "DOCUMENT_SIGNED" | "VISIT_RATING_REQUEST" | "CUSTOM";
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    subject: string;
    blocks: unknown;
    isDefault: boolean;
} | {
    isDefault: boolean;
    name: string;
    subject: string;
    blocks: TemplateBlock[];
    id: null;
    type: EmailTemplateType;
}>;
/**
 * Create a new template
 */
export declare const createTemplate: (clinicId: string, data: {
    type: EmailTemplateType;
    name: string;
    subject: string;
    blocks: TemplateBlock[];
}) => Promise<{
    type: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "DOCUMENT_SIGNED" | "VISIT_RATING_REQUEST" | "CUSTOM";
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    subject: string;
    blocks: unknown;
    isDefault: boolean;
} | undefined>;
/**
 * Update a template
 */
export declare const updateTemplate: (id: string, clinicId: string, data: {
    name?: string;
    subject?: string;
    blocks?: TemplateBlock[];
    isActive?: boolean;
}) => Promise<{
    type: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "DOCUMENT_SIGNED" | "VISIT_RATING_REQUEST" | "CUSTOM";
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    subject: string;
    blocks: unknown;
    isDefault: boolean;
} | undefined>;
/**
 * Delete a template
 */
export declare const deleteTemplate: (id: string, clinicId: string) => Promise<boolean>;
/**
 * Get default template for a type
 */
export declare const getDefaultTemplate: (type: EmailTemplateType) => {
    name: string;
    subject: string;
    blocks: TemplateBlock[];
};
/**
 * Render template blocks to HTML
 * Supports both legacy format (content as string) and AI format (content as object)
 */
export declare const renderBlocksToHtml: (blocks: TemplateBlock[]) => string;
/**
 * Replace template variables with actual values
 */
export declare const replaceVariables: (content: string, variables: Record<string, string>) => string;
/**
 * Get list of available template types with labels
 */
export declare const getTemplateTypes: () => {
    value: string;
    label: string;
}[];
//# sourceMappingURL=email-template.service.d.ts.map