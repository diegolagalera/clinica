import { Response } from 'express';
/**
 * GET /sms/settings
 */
export declare const getSettings: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /sms/settings
 */
export declare const updateSettings: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /sms/settings/test
 */
export declare const testConnection: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /sms/settings/test-sms
 */
export declare const sendTestSms: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /sms/templates
 */
export declare const getTemplates: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /sms/templates/defaults
 */
export declare const getDefaultTemplates: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /sms/templates/variables
 */
export declare const getVariables: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /sms/templates
 */
export declare const createTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /sms/templates/:id
 */
export declare const updateTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /sms/templates/:id
 */
export declare const deleteTemplate: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=sms.controller.d.ts.map