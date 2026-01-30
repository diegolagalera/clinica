import type { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { success, paginated, parsePaginationParams } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { db } from '../db/index.js';
import { stockPacks, stockPackItems, inventoryItems } from '../db/schema.js';
import { eq, and, ilike, sql, asc, desc } from 'drizzle-orm';

// Validation schemas
export const createPackSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    category: z.string().max(100).optional(),
    items: z.array(z.object({
        itemId: z.string().uuid(),
        quantity: z.number().int().min(1).default(1),
    })).optional(),
});

export const updatePackSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    category: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
    items: z.array(z.object({
        itemId: z.string().uuid(),
        quantity: z.number().int().min(1).default(1),
    })).optional(),
});

/**
 * GET /stock/packs
 * List stock packs with optional filtering
 */
export const listPacks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const params = parsePaginationParams(req.query);
    const search = req.query['search'] as string | undefined;
    const category = req.query['category'] as string | undefined;
    const isActive = req.query['isActive'] !== 'false';

    // Build conditions
    const conditions = [eq(stockPacks.clinicId, req.tenantContext.clinicId)];

    if (isActive !== undefined) {
        conditions.push(eq(stockPacks.isActive, isActive));
    }

    if (category) {
        conditions.push(eq(stockPacks.category, category));
    }

    let whereClause = and(...conditions);
    if (search) {
        whereClause = and(whereClause, ilike(stockPacks.name, `%${search}%`));
    }

    // Count total
    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(stockPacks)
        .where(whereClause);

    const total = Number(countResult?.count ?? 0);

    // Get packs with item count using LEFT JOIN
    const packsWithCounts = await db
        .select({
            id: stockPacks.id,
            clinicId: stockPacks.clinicId,
            name: stockPacks.name,
            description: stockPacks.description,
            category: stockPacks.category,
            isActive: stockPacks.isActive,
            createdById: stockPacks.createdById,
            createdAt: stockPacks.createdAt,
            updatedAt: stockPacks.updatedAt,
        })
        .from(stockPacks)
        .where(whereClause)
        .orderBy(asc(stockPacks.name))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit);

    // Get item counts for each pack
    const packIds = packsWithCounts.map(p => p.id);
    const itemCounts = packIds.length > 0
        ? await db
            .select({
                packId: stockPackItems.packId,
                count: sql<number>`count(*)`.as('count'),
            })
            .from(stockPackItems)
            .where(sql`${stockPackItems.packId} IN (${sql.join(packIds.map(id => sql`${id}`), sql`, `)})`)
            .groupBy(stockPackItems.packId)
        : [];

    // Merge counts into packs
    const countMap = new Map(itemCounts.map(c => [c.packId, Number(c.count)]));
    const packs = packsWithCounts.map(p => ({
        ...p,
        itemCount: countMap.get(p.id) || 0,
    }));

    res.json(success(paginated(packs, total, params)));
});

/**
 * GET /stock/packs/categories
 * Get list of unique pack categories
 */
export const getPackCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const categories = await db
        .selectDistinct({ category: stockPacks.category })
        .from(stockPacks)
        .where(and(
            eq(stockPacks.clinicId, req.tenantContext.clinicId),
            sql`${stockPacks.category} IS NOT NULL`
        ))
        .orderBy(asc(stockPacks.category));

    res.json(success(categories.map(c => c.category).filter(Boolean)));
});

/**
 * GET /stock/packs/:id
 * Get pack with items
 */
export const getPack = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Get pack
    const [pack] = await db
        .select()
        .from(stockPacks)
        .where(and(
            eq(stockPacks.id, id!),
            eq(stockPacks.clinicId, req.tenantContext.clinicId)
        ));

    if (!pack) {
        throw new NotFoundError('Pack not found');
    }

    // Get pack items with inventory details
    const items = await db
        .select({
            id: stockPackItems.id,
            itemId: stockPackItems.itemId,
            quantity: stockPackItems.quantity,
            item: {
                id: inventoryItems.id,
                name: inventoryItems.name,
                sku: inventoryItems.sku,
                category: inventoryItems.category,
                unit: inventoryItems.unit,
                currentStock: inventoryItems.currentStock,
                imageUrl: inventoryItems.imageUrl,
            },
        })
        .from(stockPackItems)
        .innerJoin(inventoryItems, eq(stockPackItems.itemId, inventoryItems.id))
        .where(eq(stockPackItems.packId, id!));

    res.json(success({
        ...pack,
        items,
    }));
});

/**
 * POST /stock/packs
 * Create new stock pack
 */
export const createPack = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = createPackSchema.parse(req.body);

    // Create pack
    const [pack] = await db
        .insert(stockPacks)
        .values({
            clinicId: req.tenantContext.clinicId,
            name: input.name,
            description: input.description ?? null,
            category: input.category ?? null,
            createdById: req.user!.userId,
        })
        .returning();

    // Add items if provided
    if (input.items && input.items.length > 0) {
        await db.insert(stockPackItems).values(
            input.items.map(item => ({
                packId: pack.id,
                itemId: item.itemId,
                quantity: item.quantity,
            }))
        );
    }

    // Return pack with items
    const items = input.items && input.items.length > 0
        ? await db
            .select({
                id: stockPackItems.id,
                itemId: stockPackItems.itemId,
                quantity: stockPackItems.quantity,
                item: {
                    id: inventoryItems.id,
                    name: inventoryItems.name,
                    sku: inventoryItems.sku,
                },
            })
            .from(stockPackItems)
            .innerJoin(inventoryItems, eq(stockPackItems.itemId, inventoryItems.id))
            .where(eq(stockPackItems.packId, pack.id))
        : [];

    res.status(201).json(success({ ...pack, items }, 'Pack created successfully'));
});

/**
 * PUT /stock/packs/:id
 * Update stock pack
 */
export const updatePack = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = updatePackSchema.parse(req.body);

    // Check pack exists
    const [existing] = await db
        .select()
        .from(stockPacks)
        .where(and(
            eq(stockPacks.id, id!),
            eq(stockPacks.clinicId, req.tenantContext.clinicId)
        ));

    if (!existing) {
        throw new NotFoundError('Pack not found');
    }

    // Update pack details
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.category !== undefined) updateData.category = input.category ?? null;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const [pack] = await db
        .update(stockPacks)
        .set(updateData)
        .where(eq(stockPacks.id, id!))
        .returning();

    // Update items if provided (replace all)
    if (input.items !== undefined) {
        // Delete existing items
        await db.delete(stockPackItems).where(eq(stockPackItems.packId, id!));

        // Insert new items
        if (input.items.length > 0) {
            await db.insert(stockPackItems).values(
                input.items.map(item => ({
                    packId: id!,
                    itemId: item.itemId,
                    quantity: item.quantity,
                }))
            );
        }
    }

    // Get updated items
    const items = await db
        .select({
            id: stockPackItems.id,
            itemId: stockPackItems.itemId,
            quantity: stockPackItems.quantity,
            item: {
                id: inventoryItems.id,
                name: inventoryItems.name,
                sku: inventoryItems.sku,
            },
        })
        .from(stockPackItems)
        .innerJoin(inventoryItems, eq(stockPackItems.itemId, inventoryItems.id))
        .where(eq(stockPackItems.packId, id!));

    res.json(success({ ...pack, items }, 'Pack updated successfully'));
});

/**
 * DELETE /stock/packs/:id
 * Soft delete stock pack
 */
export const deletePack = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Check pack exists
    const [existing] = await db
        .select()
        .from(stockPacks)
        .where(and(
            eq(stockPacks.id, id!),
            eq(stockPacks.clinicId, req.tenantContext.clinicId)
        ));

    if (!existing) {
        throw new NotFoundError('Pack not found');
    }

    // Soft delete
    await db
        .update(stockPacks)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(stockPacks.id, id!));

    res.json(success(null, 'Pack deleted successfully'));
});

/**
 * POST /stock/packs/:id/items
 * Add item to pack
 */
export const addPackItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { itemId, quantity = 1 } = req.body;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    if (!itemId) {
        throw new BadRequestError('Item ID is required');
    }

    // Check pack exists
    const [pack] = await db
        .select()
        .from(stockPacks)
        .where(and(
            eq(stockPacks.id, id!),
            eq(stockPacks.clinicId, req.tenantContext.clinicId)
        ));

    if (!pack) {
        throw new NotFoundError('Pack not found');
    }

    // Check item exists and belongs to clinic
    const [item] = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.id, itemId),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId)
        ));

    if (!item) {
        throw new NotFoundError('Item not found');
    }

    // Check if item already in pack
    const [existingItem] = await db
        .select()
        .from(stockPackItems)
        .where(and(
            eq(stockPackItems.packId, id!),
            eq(stockPackItems.itemId, itemId)
        ));

    if (existingItem) {
        // Update quantity
        await db
            .update(stockPackItems)
            .set({ quantity: existingItem.quantity + quantity })
            .where(eq(stockPackItems.id, existingItem.id));
    } else {
        // Add new item
        await db.insert(stockPackItems).values({
            packId: id!,
            itemId,
            quantity,
        });
    }

    // Update pack timestamp
    await db
        .update(stockPacks)
        .set({ updatedAt: new Date() })
        .where(eq(stockPacks.id, id!));

    res.json(success(null, 'Item added to pack'));
});

/**
 * DELETE /stock/packs/:id/items/:itemId
 * Remove item from pack
 */
export const removePackItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, itemId } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Check pack exists
    const [pack] = await db
        .select()
        .from(stockPacks)
        .where(and(
            eq(stockPacks.id, id!),
            eq(stockPacks.clinicId, req.tenantContext.clinicId)
        ));

    if (!pack) {
        throw new NotFoundError('Pack not found');
    }

    // Delete item from pack
    await db
        .delete(stockPackItems)
        .where(and(
            eq(stockPackItems.packId, id!),
            eq(stockPackItems.itemId, itemId!)
        ));

    // Update pack timestamp
    await db
        .update(stockPacks)
        .set({ updatedAt: new Date() })
        .where(eq(stockPacks.id, id!));

    res.json(success(null, 'Item removed from pack'));
});
