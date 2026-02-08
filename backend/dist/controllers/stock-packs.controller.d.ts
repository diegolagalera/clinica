import type { Response } from 'express';
import { z } from 'zod';
export declare const createPackSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        quantity: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        itemId: string;
        quantity: number;
    }, {
        itemId: string;
        quantity?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    category?: string | undefined;
    items?: {
        itemId: string;
        quantity: number;
    }[] | undefined;
}, {
    name: string;
    description?: string | undefined;
    category?: string | undefined;
    items?: {
        itemId: string;
        quantity?: number | undefined;
    }[] | undefined;
}>;
export declare const updatePackSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        quantity: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        itemId: string;
        quantity: number;
    }, {
        itemId: string;
        quantity?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    description?: string | undefined;
    category?: string | undefined;
    items?: {
        itemId: string;
        quantity: number;
    }[] | undefined;
}, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    description?: string | undefined;
    category?: string | undefined;
    items?: {
        itemId: string;
        quantity?: number | undefined;
    }[] | undefined;
}>;
/**
 * GET /stock/packs
 * List stock packs with optional filtering
 */
export declare const listPacks: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/packs/categories
 * Get list of unique pack categories
 */
export declare const getPackCategories: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/packs/:id
 * Get pack with items
 */
export declare const getPack: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /stock/packs
 * Create new stock pack
 */
export declare const createPack: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /stock/packs/:id
 * Update stock pack
 */
export declare const updatePack: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /stock/packs/:id
 * Soft delete stock pack
 */
export declare const deletePack: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /stock/packs/:id/items
 * Add item to pack
 */
export declare const addPackItem: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /stock/packs/:id/items/:itemId
 * Remove item from pack
 */
export declare const removePackItem: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=stock-packs.controller.d.ts.map