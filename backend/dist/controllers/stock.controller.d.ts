import type { Response } from 'express';
import { z } from 'zod';
export declare const createItemSchema: z.ZodObject<{
    sku: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    unit: z.ZodDefault<z.ZodString>;
    currentStock: z.ZodDefault<z.ZodNumber>;
    minStock: z.ZodDefault<z.ZodNumber>;
    maxStock: z.ZodOptional<z.ZodNumber>;
    costPrice: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, string, string | number>>;
    sellPrice: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, string, string | number>>;
    supplier: z.ZodOptional<z.ZodString>;
    supplierCode: z.ZodOptional<z.ZodString>;
    expirationDate: z.ZodOptional<z.ZodEffects<z.ZodString, Date, string>>;
    location: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    unit: string;
    currentStock: number;
    minStock: number;
    description?: string | undefined;
    sku?: string | undefined;
    category?: string | undefined;
    maxStock?: number | undefined;
    costPrice?: string | undefined;
    sellPrice?: string | undefined;
    supplier?: string | undefined;
    supplierCode?: string | undefined;
    expirationDate?: Date | undefined;
    location?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    sku?: string | undefined;
    category?: string | undefined;
    unit?: string | undefined;
    currentStock?: number | undefined;
    minStock?: number | undefined;
    maxStock?: number | undefined;
    costPrice?: string | number | undefined;
    sellPrice?: string | number | undefined;
    supplier?: string | undefined;
    supplierCode?: string | undefined;
    expirationDate?: string | undefined;
    location?: string | undefined;
}>;
export declare const updateItemSchema: z.ZodObject<{
    sku: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    unit: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    currentStock: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    minStock: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    maxStock: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    costPrice: z.ZodOptional<z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, string, string | number>>>;
    sellPrice: z.ZodOptional<z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, string, string | number>>>;
    supplier: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    supplierCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    expirationDate: z.ZodOptional<z.ZodOptional<z.ZodEffects<z.ZodString, Date, string>>>;
    location: z.ZodOptional<z.ZodOptional<z.ZodString>>;
} & {
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    description?: string | undefined;
    sku?: string | undefined;
    category?: string | undefined;
    unit?: string | undefined;
    currentStock?: number | undefined;
    minStock?: number | undefined;
    maxStock?: number | undefined;
    costPrice?: string | undefined;
    sellPrice?: string | undefined;
    supplier?: string | undefined;
    supplierCode?: string | undefined;
    expirationDate?: Date | undefined;
    location?: string | undefined;
}, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    description?: string | undefined;
    sku?: string | undefined;
    category?: string | undefined;
    unit?: string | undefined;
    currentStock?: number | undefined;
    minStock?: number | undefined;
    maxStock?: number | undefined;
    costPrice?: string | number | undefined;
    sellPrice?: string | number | undefined;
    supplier?: string | undefined;
    supplierCode?: string | undefined;
    expirationDate?: string | undefined;
    location?: string | undefined;
}>;
export declare const adjustStockSchema: z.ZodObject<{
    type: z.ZodEnum<["IN", "OUT", "ADJUSTMENT", "EXPIRED"]>;
    quantity: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
    reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "IN" | "OUT" | "ADJUSTMENT" | "EXPIRED";
    quantity: number;
    reason?: string | undefined;
    reference?: string | undefined;
}, {
    type: "IN" | "OUT" | "ADJUSTMENT" | "EXPIRED";
    quantity: number;
    reason?: string | undefined;
    reference?: string | undefined;
}>;
/**
 * GET /stock/items
 * List inventory items with filtering
 */
export declare const listItems: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/items/categories
 * Get list of unique categories
 */
export declare const getCategories: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/items/:id
 * Get single item by ID
 */
export declare const getItem: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /stock/items
 * Create new inventory item
 */
export declare const createItem: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /stock/items/:id
 * Update inventory item
 */
export declare const updateItem: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /stock/items/:id
 * Soft delete inventory item
 */
export declare const deleteItem: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /stock/items/:id/adjust
 * Adjust stock level (in, out, adjustment, expired)
 */
export declare const adjustStock: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/items/:id/movements
 * Get stock movement history for an item
 */
export declare const getItemMovements: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /stock/items/:id/image
 * Upload image for a stock item
 */
export declare const uploadItemImage: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /stock/items/:id/image
 * Delete image from a stock item
 */
export declare const deleteItemImage: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/items/:id/image
 * Serve stock item image (public endpoint for img tags)
 */
export declare const getItemImage: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /stock/items/generate-image
 * Generate an AI image for a stock item
 */
export declare const generateItemImage: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /stock/items/:id/generate-image
 * Generate an AI image for an existing stock item and save it
 * OR save an already generated image URL if provided in the body
 */
export declare const generateAndSaveItemImage: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=stock.controller.d.ts.map