import type { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { db } from '../db/index.js';
import {
    appointmentStockUsage,
    appointments,
    inventoryItems,
    stockPacks,
    stockPackItems,
    stockMovements
} from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

// Validation schemas
export const addStockUsageSchema = z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().min(1),
    notes: z.string().optional(),
});

export const addMultipleStockUsageSchema = z.object({
    items: z.array(z.object({
        itemId: z.string().uuid(),
        quantity: z.number().int().min(1),
        notes: z.string().optional(),
    })),
});

/**
 * GET /appointments/:appointmentId/stock
 * Get stock usage for an appointment
 */
export const getAppointmentStock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Check appointment exists and belongs to clinic
    const [appointment] = await db
        .select()
        .from(appointments)
        .where(and(
            eq(appointments.id, appointmentId!),
            eq(appointments.clinicId, req.tenantContext.clinicId)
        ));

    if (!appointment) {
        throw new NotFoundError('Appointment not found');
    }

    // Get stock usage with item details
    const usage = await db
        .select({
            id: appointmentStockUsage.id,
            itemId: appointmentStockUsage.itemId,
            quantity: appointmentStockUsage.quantity,
            unitCost: appointmentStockUsage.unitCost,
            notes: appointmentStockUsage.notes,
            createdAt: appointmentStockUsage.createdAt,
            item: {
                id: inventoryItems.id,
                name: inventoryItems.name,
                sku: inventoryItems.sku,
                category: inventoryItems.category,
                unit: inventoryItems.unit,
                imageUrl: inventoryItems.imageUrl,
            },
        })
        .from(appointmentStockUsage)
        .innerJoin(inventoryItems, eq(appointmentStockUsage.itemId, inventoryItems.id))
        .where(eq(appointmentStockUsage.appointmentId, appointmentId!))
        .orderBy(desc(appointmentStockUsage.createdAt));

    // Calculate total cost
    const totalCost = usage.reduce((sum, item) => {
        const cost = parseFloat(item.unitCost || '0') * item.quantity;
        return sum + cost;
    }, 0);

    res.json(success({
        appointmentId,
        items: usage,
        totalItems: usage.length,
        totalCost: totalCost.toFixed(2),
    }));
});

/**
 * POST /appointments/:appointmentId/stock
 * Add stock usage to an appointment
 */
export const addStockUsage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = addStockUsageSchema.parse(req.body);

    // Check appointment exists
    const [appointment] = await db
        .select()
        .from(appointments)
        .where(and(
            eq(appointments.id, appointmentId!),
            eq(appointments.clinicId, req.tenantContext.clinicId)
        ));

    if (!appointment) {
        throw new NotFoundError('Appointment not found');
    }

    // Check item exists and get current stock
    const [item] = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.id, input.itemId),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId)
        ));

    if (!item) {
        throw new NotFoundError('Item not found');
    }

    if (item.currentStock < input.quantity) {
        throw new BadRequestError(`Insufficient stock for ${item.name}. Available: ${item.currentStock}`);
    }

    // Create stock usage record
    const [usage] = await db.insert(appointmentStockUsage).values({
        clinicId: req.tenantContext.clinicId,
        appointmentId: appointmentId!,
        itemId: input.itemId,
        quantity: input.quantity,
        unitCost: item.costPrice ?? null,
        notes: input.notes ?? null,
        registeredById: req.user!.userId,
    }).returning();

    // Decrement stock
    const newStock = item.currentStock - input.quantity;
    await db
        .update(inventoryItems)
        .set({ currentStock: newStock, updatedAt: new Date() })
        .where(eq(inventoryItems.id, input.itemId));

    // Record stock movement
    await db.insert(stockMovements).values({
        clinicId: req.tenantContext.clinicId,
        itemId: input.itemId,
        type: 'OUT',
        quantity: input.quantity,
        previousStock: item.currentStock,
        newStock,
        reason: `Used in appointment ${appointmentId}`,
        reference: appointmentId!,
        performedById: req.user!.userId,
    });

    res.status(201).json(success({
        ...usage,
        item: {
            id: item.id,
            name: item.name,
            sku: item.sku,
        },
    }, 'Stock usage recorded'));
});

/**
 * POST /appointments/:appointmentId/stock/bulk
 * Add multiple stock items to an appointment
 */
export const addBulkStockUsage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = addMultipleStockUsageSchema.parse(req.body);

    // Check appointment exists
    const [appointment] = await db
        .select()
        .from(appointments)
        .where(and(
            eq(appointments.id, appointmentId!),
            eq(appointments.clinicId, req.tenantContext.clinicId)
        ));

    if (!appointment) {
        throw new NotFoundError('Appointment not found');
    }

    const results = [];

    for (const usage of input.items) {
        // Get item
        const [item] = await db
            .select()
            .from(inventoryItems)
            .where(and(
                eq(inventoryItems.id, usage.itemId),
                eq(inventoryItems.clinicId, req.tenantContext.clinicId)
            ));

        if (!item) {
            throw new NotFoundError(`Item ${usage.itemId} not found`);
        }

        if (item.currentStock < usage.quantity) {
            throw new BadRequestError(`Insufficient stock for ${item.name}. Available: ${item.currentStock}`);
        }

        // Create stock usage record
        const [usageRecord] = await db.insert(appointmentStockUsage).values({
            clinicId: req.tenantContext.clinicId,
            appointmentId: appointmentId!,
            itemId: usage.itemId,
            quantity: usage.quantity,
            unitCost: item.costPrice ?? null,
            notes: usage.notes ?? null,
            registeredById: req.user!.userId,
        }).returning();

        // Decrement stock
        const newStock = item.currentStock - usage.quantity;
        await db
            .update(inventoryItems)
            .set({ currentStock: newStock, updatedAt: new Date() })
            .where(eq(inventoryItems.id, usage.itemId));

        // Record stock movement
        await db.insert(stockMovements).values({
            clinicId: req.tenantContext.clinicId,
            itemId: usage.itemId,
            type: 'OUT',
            quantity: usage.quantity,
            previousStock: item.currentStock,
            newStock,
            reason: `Used in appointment ${appointmentId}`,
            reference: appointmentId!,
            performedById: req.user!.userId,
        });

        results.push({
            ...usageRecord,
            item: { id: item.id, name: item.name },
        });
    }

    res.status(201).json(success(results, `${results.length} items added to appointment`));
});

/**
 * POST /appointments/:appointmentId/stock/pack/:packId
 * Apply a stock pack to an appointment
 */
export const applyPackToAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId, packId } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Check appointment exists
    const [appointment] = await db
        .select()
        .from(appointments)
        .where(and(
            eq(appointments.id, appointmentId!),
            eq(appointments.clinicId, req.tenantContext.clinicId)
        ));

    if (!appointment) {
        throw new NotFoundError('Appointment not found');
    }

    // Check pack exists and get items
    const [pack] = await db
        .select()
        .from(stockPacks)
        .where(and(
            eq(stockPacks.id, packId!),
            eq(stockPacks.clinicId, req.tenantContext.clinicId),
            eq(stockPacks.isActive, true)
        ));

    if (!pack) {
        throw new NotFoundError('Pack not found');
    }

    // Get pack items
    const packItems = await db
        .select({
            itemId: stockPackItems.itemId,
            quantity: stockPackItems.quantity,
        })
        .from(stockPackItems)
        .where(eq(stockPackItems.packId, packId!));

    if (packItems.length === 0) {
        throw new BadRequestError('Pack has no items');
    }

    const results = [];

    for (const packItem of packItems) {
        // Get inventory item
        const [item] = await db
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.id, packItem.itemId));

        if (!item || !item.isActive) {
            continue; // Skip inactive or missing items
        }

        if (item.currentStock < packItem.quantity) {
            throw new BadRequestError(`Insufficient stock for ${item.name}. Available: ${item.currentStock}, Required: ${packItem.quantity}`);
        }

        // Create stock usage record
        const [usageRecord] = await db.insert(appointmentStockUsage).values({
            clinicId: req.tenantContext.clinicId,
            appointmentId: appointmentId!,
            itemId: packItem.itemId,
            quantity: packItem.quantity,
            unitCost: item.costPrice ?? null,
            notes: `Applied from pack: ${pack.name}`,
            registeredById: req.user!.userId,
        }).returning();

        // Decrement stock
        const newStock = item.currentStock - packItem.quantity;
        await db
            .update(inventoryItems)
            .set({ currentStock: newStock, updatedAt: new Date() })
            .where(eq(inventoryItems.id, packItem.itemId));

        // Record stock movement
        await db.insert(stockMovements).values({
            clinicId: req.tenantContext.clinicId,
            itemId: packItem.itemId,
            type: 'OUT',
            quantity: packItem.quantity,
            previousStock: item.currentStock,
            newStock,
            reason: `Pack "${pack.name}" applied to appointment ${appointmentId}`,
            reference: appointmentId!,
            performedById: req.user!.userId,
        });

        results.push({
            ...usageRecord,
            item: { id: item.id, name: item.name },
        });
    }

    res.status(201).json(success({
        packName: pack.name,
        items: results,
    }, `Pack "${pack.name}" applied successfully`));
});

/**
 * DELETE /appointments/:appointmentId/stock/:usageId
 * Remove stock usage from appointment (and restore stock)
 */
export const removeStockUsage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId, usageId } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Get the usage record
    const [usage] = await db
        .select()
        .from(appointmentStockUsage)
        .where(and(
            eq(appointmentStockUsage.id, usageId!),
            eq(appointmentStockUsage.appointmentId, appointmentId!),
            eq(appointmentStockUsage.clinicId, req.tenantContext.clinicId)
        ));

    if (!usage) {
        throw new NotFoundError('Stock usage record not found');
    }

    // Get current item stock
    const [item] = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, usage.itemId));

    if (item) {
        // Restore stock
        const newStock = item.currentStock + usage.quantity;
        await db
            .update(inventoryItems)
            .set({ currentStock: newStock, updatedAt: new Date() })
            .where(eq(inventoryItems.id, usage.itemId));

        // Record stock movement (reversal)
        await db.insert(stockMovements).values({
            clinicId: req.tenantContext.clinicId,
            itemId: usage.itemId,
            type: 'IN',
            quantity: usage.quantity,
            previousStock: item.currentStock,
            newStock,
            reason: `Reversed usage from appointment ${appointmentId}`,
            reference: appointmentId!,
            performedById: req.user!.userId,
        });
    }

    // Delete usage record
    await db
        .delete(appointmentStockUsage)
        .where(eq(appointmentStockUsage.id, usageId!));

    res.json(success(null, 'Stock usage removed and inventory restored'));
});
