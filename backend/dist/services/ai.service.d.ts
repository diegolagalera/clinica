import type { TemplateBlock } from './email-template.service.js';
export declare class AIServiceError extends Error {
    code: 'API_KEY_MISSING' | 'RATE_LIMIT' | 'INVALID_REQUEST' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'UNKNOWN';
    constructor(message: string, code: 'API_KEY_MISSING' | 'RATE_LIMIT' | 'INVALID_REQUEST' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'UNKNOWN');
}
interface AITemplateResponse {
    subject: string;
    blocks: TemplateBlock[];
    error?: string;
}
/**
 * Generate email template blocks using AI
 */
export declare const generateEmailTemplate: (userPrompt: string) => Promise<{
    success: true;
    data: AITemplateResponse;
} | {
    success: false;
    error: string;
    code: string;
}>;
/**
 * Check if AI service is available
 */
export declare const isAIAvailable: () => boolean;
export {};
//# sourceMappingURL=ai.service.d.ts.map