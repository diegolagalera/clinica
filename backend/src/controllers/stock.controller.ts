import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { success, paginated, parsePaginationParams } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { db } from '../db/index.js';
import { inventoryItems, stockMovements } from '../db/schema.js';
import { eq, and, ilike, or, sql, desc, asc, lt, lte } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

// Upload directory for stock item images
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'stock');

// Validation schemas
export const createItemSchema = z.object({
    sku: z.string().max(100).optional(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    category: z.string().max(100).optional(),
    unit: z.string().max(50).default('unidades'),
    currentStock: z.number().int().min(0).default(0),
    minStock: z.number().int().min(0).default(0),
    maxStock: z.number().int().min(0).optional(),
    costPrice: z.union([z.string(), z.number()]).transform(v => v?.toString()).optional(),
    sellPrice: z.union([z.string(), z.number()]).transform(v => v?.toString()).optional(),
    supplier: z.string().max(255).optional(),
    supplierCode: z.string().max(100).optional(),
    expirationDate: z.string().transform(s => new Date(s)).optional(),
    location: z.string().max(100).optional(),
});

export const updateItemSchema = createItemSchema.partial().extend({
    isActive: z.boolean().optional(),
});

export const adjustStockSchema = z.object({
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'EXPIRED']),
    quantity: z.number().int().min(1),
    reason: z.string().optional(),
    reference: z.string().max(255).optional(),
});

/**
 * GET /stock/items
 * List inventory items with filtering
 */
export const listItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const params = parsePaginationParams(req.query);
    const search = req.query['search'] as string | undefined;
    const category = req.query['category'] as string | undefined;
    const lowStock = req.query['lowStock'] === 'true';
    const isActive = req.query['isActive'] !== 'false'; // Default to active items

    // Build conditions
    const conditions = [eq(inventoryItems.clinicId, req.tenantContext.clinicId)];

    if (isActive !== undefined) {
        conditions.push(eq(inventoryItems.isActive, isActive));
    }

    if (category) {
        conditions.push(eq(inventoryItems.category, category));
    }

    if (lowStock) {
        conditions.push(lte(inventoryItems.currentStock, inventoryItems.minStock));
    }

    // Search by name, sku, or supplier
    let whereClause = and(...conditions);
    if (search) {
        const searchConditions = or(
            ilike(inventoryItems.name, `%${search}%`),
            ilike(inventoryItems.sku, `%${search}%`),
            ilike(inventoryItems.supplier, `%${search}%`)
        );
        whereClause = and(whereClause, searchConditions);
    }

    // Get total count
    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(inventoryItems)
        .where(whereClause);

    const total = Number(countResult?.count ?? 0);

    // Get items with pagination
    const items = await db
        .select()
        .from(inventoryItems)
        .where(whereClause)
        .orderBy(asc(inventoryItems.name))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit);

    res.json(success(paginated(items, total, params)));
});

/**
 * GET /stock/items/categories
 * Get list of unique categories
 */
export const getCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const categories = await db
        .selectDistinct({ category: inventoryItems.category })
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.clinicId, req.tenantContext.clinicId),
            sql`${inventoryItems.category} IS NOT NULL`
        ))
        .orderBy(asc(inventoryItems.category));

    res.json(success(categories.map(c => c.category).filter(Boolean)));
});

/**
 * GET /stock/items/:id
 * Get single item by ID
 */
export const getItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const [item] = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.id, id!),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId!)
        ));

    if (!item) {
        throw new NotFoundError('Item not found');
    }

    res.json(success(item));
});

/**
 * POST /stock/items
 * Create new inventory item
 */
export const createItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = createItemSchema.parse(req.body);

    const [item] = await db
        .insert(inventoryItems)
        .values({
            clinicId: req.tenantContext.clinicId,
            name: input.name,
            sku: input.sku ?? null,
            description: input.description ?? null,
            category: input.category ?? null,
            unit: input.unit,
            currentStock: input.currentStock,
            minStock: input.minStock,
            maxStock: input.maxStock ?? null,
            costPrice: input.costPrice ?? null,
            sellPrice: input.sellPrice ?? null,
            supplier: input.supplier ?? null,
            supplierCode: input.supplierCode ?? null,
            expirationDate: input.expirationDate ?? null,
            location: input.location ?? null,
        })
        .returning();

    res.status(201).json(success(item, 'Item created successfully'));
});

/**
 * PUT /stock/items/:id
 * Update inventory item
 */
export const updateItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = updateItemSchema.parse(req.body);

    // Check item exists and belongs to clinic
    const [existing] = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.id, id!),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId)
        ));

    if (!existing) {
        throw new NotFoundError('Item not found');
    }

    // Build update object without undefined values
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.sku !== undefined) updateData.sku = input.sku ?? null;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.category !== undefined) updateData.category = input.category ?? null;
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.currentStock !== undefined) updateData.currentStock = input.currentStock;
    if (input.minStock !== undefined) updateData.minStock = input.minStock;
    if (input.maxStock !== undefined) updateData.maxStock = input.maxStock ?? null;
    if (input.costPrice !== undefined) updateData.costPrice = input.costPrice ?? null;
    if (input.sellPrice !== undefined) updateData.sellPrice = input.sellPrice ?? null;
    if (input.supplier !== undefined) updateData.supplier = input.supplier ?? null;
    if (input.supplierCode !== undefined) updateData.supplierCode = input.supplierCode ?? null;
    if (input.expirationDate !== undefined) updateData.expirationDate = input.expirationDate ?? null;
    if (input.location !== undefined) updateData.location = input.location ?? null;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const [updated] = await db
        .update(inventoryItems)
        .set(updateData)
        .where(eq(inventoryItems.id, id!))
        .returning();

    res.json(success(updated, 'Item updated successfully'));
});

/**
 * DELETE /stock/items/:id
 * Soft delete inventory item
 */
export const deleteItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Check item exists
    const [existing] = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.id, id!),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId)
        ));

    if (!existing) {
        throw new NotFoundError('Item not found');
    }

    // Soft delete
    await db
        .update(inventoryItems)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(inventoryItems.id, id!));

    res.json(success(null, 'Item deleted successfully'));
});

/**
 * POST /stock/items/:id/adjust
 * Adjust stock level (in, out, adjustment, expired)
 */
export const adjustStock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = adjustStockSchema.parse(req.body);

    // Get current item
    const [item] = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.id, id!),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId)
        ));

    if (!item) {
        throw new NotFoundError('Item not found');
    }

    // Calculate new stock
    let newStock = item.currentStock;
    if (input.type === 'IN') {
        newStock += input.quantity;
    } else if (input.type === 'OUT' || input.type === 'EXPIRED') {
        newStock -= input.quantity;
        if (newStock < 0) {
            throw new BadRequestError('Insufficient stock');
        }
    } else if (input.type === 'ADJUSTMENT') {
        // Adjustment can be positive or negative - quantity is absolute target
        newStock = input.quantity;
    }

    // Create movement record
    await db.insert(stockMovements).values({
        clinicId: req.tenantContext.clinicId,
        itemId: id!,
        type: input.type,
        quantity: input.quantity,
        previousStock: item.currentStock,
        newStock,
        reason: input.reason ?? null,
        reference: input.reference ?? null,
        performedById: req.user!.userId,
    });

    // Update item stock
    const [updated] = await db
        .update(inventoryItems)
        .set({ currentStock: newStock, updatedAt: new Date() })
        .where(eq(inventoryItems.id, id!))
        .returning();

    res.json(success(updated, 'Stock adjusted successfully'));
});

/**
 * GET /stock/items/:id/movements
 * Get stock movement history for an item
 */
export const getItemMovements = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const params = parsePaginationParams(req.query);

    // Count total
    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(stockMovements)
        .where(and(
            eq(stockMovements.itemId, id!),
            eq(stockMovements.clinicId, req.tenantContext.clinicId)
        ));

    const total = Number(countResult?.count ?? 0);

    // Get movements
    const movements = await db
        .select()
        .from(stockMovements)
        .where(and(
            eq(stockMovements.itemId, id!),
            eq(stockMovements.clinicId, req.tenantContext.clinicId)
        ))
        .orderBy(desc(stockMovements.createdAt))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit);

    res.json(success(paginated(movements, total, params)));
});

/**
 * POST /stock/items/:id/image
 * Upload image for a stock item
 */
export const uploadItemImage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    if (!req.file) {
        throw new BadRequestError('No image file provided');
    }

    // Check item exists
    const [item] = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.id, id!),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId)
        ));

    if (!item) {
        throw new NotFoundError('Item not found');
    }

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Generate filename
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `${id}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Delete old image if exists
    if (item.imageUrl) {
        try {
            await fs.unlink(item.imageUrl);
        } catch (err) {
            // Ignore if file doesn't exist
        }
    }

    // Save file
    await fs.writeFile(filepath, req.file.buffer);

    // Update item
    const [updated] = await db
        .update(inventoryItems)
        .set({ imageUrl: filepath, updatedAt: new Date() })
        .where(eq(inventoryItems.id, id!))
        .returning();

    res.json(success(updated, 'Image uploaded successfully'));
});

/**
 * DELETE /stock/items/:id/image
 * Delete image from a stock item
 */
export const deleteItemImage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Check item exists and has image
    const [item] = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.id, id!),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId)
        ));

    if (!item) {
        throw new NotFoundError('Item not found');
    }

    if (item.imageUrl) {
        try {
            await fs.unlink(item.imageUrl);
        } catch (err) {
            // Ignore if file doesn't exist
        }

        await db
            .update(inventoryItems)
            .set({ imageUrl: null, updatedAt: new Date() })
            .where(eq(inventoryItems.id, id!));
    }

    res.json(success(null, 'Image deleted successfully'));
});

/**
 * GET /stock/items/:id/image
 * Serve stock item image (public endpoint for img tags)
 */
export const getItemImage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
        throw new BadRequestError('Item ID required');
    }

    const [item] = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, id));

    if (!item || !item.imageUrl) {
        throw new NotFoundError('Image not found');
    }

    // Check if file exists
    try {
        await fs.access(item.imageUrl);
    } catch {
        throw new NotFoundError('Image file not found');
    }

    res.sendFile(item.imageUrl);
});

// Validation schema for image generation
const generateImageSchema = z.object({
    itemName: z.string().min(1).max(255),
    description: z.string().max(500).optional(),
});

/**
 * POST /stock/items/generate-image
 * Generate an AI image for a stock item
 */
export const generateItemImage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = generateImageSchema.parse(req.body);

    // Import the service dynamically to avoid circular dependencies
    const { generateStockItemImage } = await import('../services/openai.service.js');

    const result = await generateStockItemImage(input.itemName, input.description);

    res.json(success({
        imageUrl: result.imageUrl,
        revisedPrompt: result.revisedPrompt,
    }, 'Imagen generada correctamente'));
});

/**
 * POST /stock/items/:id/generate-image
 * Generate an AI image for an existing stock item and save it
 * OR save an already generated image URL if provided in the body
 */
export const generateAndSaveItemImage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { imageUrl: providedImageUrl } = req.body as { imageUrl?: string };

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Check item exists
    const [item] = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.id, id!),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId)
        ));

    if (!item) {
        throw new NotFoundError('Item not found');
    }

    let imageUrlToDownload: string;
    let revisedPrompt: string | undefined;

    // If an image URL was provided, use it directly (already generated)
    if (providedImageUrl) {
        imageUrlToDownload = providedImageUrl;
    } else {
        // Generate a new image
        const { generateStockItemImage } = await import('../services/openai.service.js');
        const result = await generateStockItemImage(item.name, item.description || undefined);
        imageUrlToDownload = result.imageUrl;
        revisedPrompt = result.revisedPrompt;
    }

    // Download and save the image
    const imageResponse = await fetch(imageUrlToDownload);
    if (!imageResponse.ok) {
        throw new BadRequestError('No se pudo descargar la imagen');
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Generate filename
    const filename = `${id}.png`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Delete old image if exists
    if (item.imageUrl) {
        try {
            await fs.unlink(item.imageUrl);
        } catch {
            // Ignore if file doesn't exist
        }
    }

    // Save file
    await fs.writeFile(filepath, imageBuffer);

    // Update item
    const [updated] = await db
        .update(inventoryItems)
        .set({ imageUrl: filepath, updatedAt: new Date() })
        .where(eq(inventoryItems.id, id!))
        .returning();

    res.json(success({
        item: updated,
        revisedPrompt,
    }, 'Imagen guardada correctamente'));
});
