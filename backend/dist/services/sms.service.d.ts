export type SmsTemplateType = 'APPOINTMENT_CREATED' | 'APPOINTMENT_REMINDER_24H' | 'APPOINTMENT_REMINDER_1H' | 'APPOINTMENT_CANCELLED' | 'CUSTOM';
export declare const SMS_VARIABLES: {
    patient_name: string;
    appointment_date: string;
    appointment_time: string;
    clinic_name: string;
    clinic_phone: string;
    doctor_name: string;
};
/**
 * Get SMS settings for a clinic
 */
export declare const getSmsSettings: (clinicId: string) => Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    isEnabled: boolean;
    isConfigured: boolean;
    sendOnCreate: boolean;
    sendOnCancel: boolean;
    reminder24hEnabled: boolean;
    reminder1hEnabled: boolean;
    accountSid: string | null;
    authToken: string | null;
    fromNumber: string | null;
} | undefined>;
/**
 * Update or create SMS settings
 */
export declare const updateSmsSettings: (clinicId: string, data: {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
    isEnabled?: boolean;
    sendOnCreate?: boolean;
    sendOnCancel?: boolean;
    reminder24hEnabled?: boolean;
    reminder1hEnabled?: boolean;
}) => Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    isEnabled: boolean;
    isConfigured: boolean;
    sendOnCreate: boolean;
    sendOnCancel: boolean;
    reminder24hEnabled: boolean;
    reminder1hEnabled: boolean;
    accountSid: string | null;
    authToken: string | null;
    fromNumber: string | null;
} | undefined>;
/**
 * Test Twilio connection
 */
export declare const testConnection: (clinicId: string) => Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Send test SMS
 */
export declare const sendTestSms: (clinicId: string, toNumber: string) => Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Send SMS
 */
export declare const sendSms: (clinicId: string, toNumber: string, content: string) => Promise<{
    success: boolean;
    sid?: string;
    error?: string;
}>;
/**
 * Get all SMS templates for a clinic
 */
export declare const getSmsTemplates: (clinicId: string) => Promise<{
    type: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "CUSTOM";
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    content: string;
    isDefault: boolean;
}[]>;
/**
 * Get active SMS template by type
 */
export declare const getActiveSmsTemplate: (clinicId: string, type: SmsTemplateType) => Promise<{
    type: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "CUSTOM";
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    content: string;
    isDefault: boolean;
} | {
    id: string;
    type: SmsTemplateType;
    name: string;
    content: string;
    isActive: boolean;
    isDefault: boolean;
} | null>;
/**
 * Create SMS template
 */
export declare const createSmsTemplate: (clinicId: string, data: {
    type: SmsTemplateType;
    name: string;
    content: string;
    isActive?: boolean;
}) => Promise<{
    type: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "CUSTOM";
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    content: string;
    isDefault: boolean;
} | undefined>;
/**
 * Update SMS template
 */
export declare const updateSmsTemplate: (templateId: string, data: {
    name?: string;
    content?: string;
    isActive?: boolean;
}) => Promise<{
    type: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "CUSTOM";
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    content: string;
    isDefault: boolean;
} | undefined>;
/**
 * Delete SMS template
 */
export declare const deleteSmsTemplate: (templateId: string) => Promise<void>;
/**
 * Render SMS content with variables
 */
export declare const renderSmsContent: (content: string, variables: Record<string, string>) => string;
/**
 * Get default templates list
 */
export declare const getDefaultSmsTemplates: () => {
    type: string;
    name: string;
    content: string;
    isDefault: boolean;
}[];
//# sourceMappingURL=sms.service.d.ts.map