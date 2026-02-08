import type { Response } from 'express';
/**
 * GET /notifications/settings
 */
export declare const getSettings: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /notifications/settings
 */
export declare const updateSettings: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /notifications/settings/test
 */
export declare const testConnection: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /notifications/settings/test-email
 */
export declare const sendTestEmail: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /notifications/send-test (custom HTML test)
 */
export declare const sendCustomTestEmail: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /notifications/templates
 */
export declare const getTemplates: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /notifications/templates/types
 */
export declare const getTemplateTypes: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /notifications/templates/default/:type
 */
export declare const getDefaultTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /notifications/templates/:id
 */
export declare const getTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /notifications/templates
 */
export declare const createTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /notifications/templates/:id
 */
export declare const updateTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /notifications/templates/:id
 */
export declare const deleteTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /notifications/templates/:id/preview
 */
export declare const previewTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /notifications/templates/:id/test
 */
export declare const testTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /notifications/logs
 */
export declare const getLogs: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /notifications/stats
 */
export declare const getStats: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /notifications/templates/generate (AI generation)
 */
export declare const generateTemplateWithAI: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=notification.controller.d.ts.map