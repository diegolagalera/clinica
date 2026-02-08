import type { Response } from 'express';
import { z } from 'zod';
export declare const addStockUsageSchema: z.ZodObject<{
    itemId: z.ZodString;
    quantity: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    itemId: string;
    quantity: number;
    notes?: string | undefined;
}, {
    itemId: string;
    quantity: number;
    notes?: string | undefined;
}>;
export declare const addMultipleStockUsageSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        quantity: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        itemId: string;
        quantity: number;
        notes?: string | undefined;
    }, {
        itemId: string;
        quantity: number;
        notes?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        itemId: string;
        quantity: number;
        notes?: string | undefined;
    }[];
}, {
    items: {
        itemId: string;
        quantity: number;
        notes?: string | undefined;
    }[];
}>;
/**
 * GET /appointments/:appointmentId/stock
 * Get stock usage for an appointment
 */
export declare const getAppointmentStock: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /appointments/:appointmentId/stock
 * Add stock usage to an appointment
 */
export declare const addStockUsage: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /appointments/:appointmentId/stock/bulk
 * Add multiple stock items to an appointment
 */
export declare const addBulkStockUsage: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /appointments/:appointmentId/stock/pack/:packId
 * Apply a stock pack to an appointment
 */
export declare const applyPackToAppointment: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /appointments/:appointmentId/stock/:usageId
 * Remove stock usage from appointment (and restore stock)
 */
export declare const removeStockUsage: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=appointment-stock.controller.d.ts.map