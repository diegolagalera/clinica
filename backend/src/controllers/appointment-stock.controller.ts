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
import { stockEvents } from '../websocket.js';

/**
 * Helper to emit stock:updated event with current stock list
 */
async function emitStockUpdate(appointmentId: string) {
    try {
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
            .where(eq(appointmentStockUsage.appointmentId, appointmentId))
            .orderBy(desc(appointmentStockUsage.createdAt));

        stockEvents.updated(appointmentId, usage);
    } catch (error) {
        // Don't fail the request if WebSocket emit fails
        console.error('Failed to emit stock:updated event', error);
    }
}

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
 * Add stock usage to an appointment (unconfirmed - no stock deduction yet)
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

    // Validate stock availability (but don't deduct yet)
    if (item.currentStock < input.quantity) {
        throw new BadRequestError(`Insufficient stock for ${item.name}. Available: ${item.currentStock}`);
    }

    // Create stock usage record as UNCONFIRMED (isConfirmed = false by default)
    // Stock will be deducted only when appointment is completed
    const [usage] = await db.insert(appointmentStockUsage).values({
        clinicId: req.tenantContext.clinicId,
        appointmentId: appointmentId!,
        itemId: input.itemId,
        quantity: input.quantity,
        unitCost: item.costPrice ?? null,
        notes: input.notes ?? null,
        registeredById: req.user!.userId,
        // isConfirmed defaults to false - stock not deducted yet
    }).returning();

    // Emit WebSocket event to users watching this appointment
    await emitStockUpdate(appointmentId!);

    res.status(201).json(success({
        ...usage,
        item: {
            id: item.id,
            name: item.name,
            sku: item.sku,
        },
    }, 'Stock usage recorded (pending confirmation)'));
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

        // Validate stock availability (but don't deduct yet)
        if (item.currentStock < usage.quantity) {
            throw new BadRequestError(`Insufficient stock for ${item.name}. Available: ${item.currentStock}`);
        }

        // Create stock usage record as UNCONFIRMED
        const [usageRecord] = await db.insert(appointmentStockUsage).values({
            clinicId: req.tenantContext.clinicId,
            appointmentId: appointmentId!,
            itemId: usage.itemId,
            quantity: usage.quantity,
            unitCost: item.costPrice ?? null,
            notes: usage.notes ?? null,
            registeredById: req.user!.userId,
            // isConfirmed defaults to false
        }).returning();

        results.push({
            ...usageRecord,
            item: { id: item.id, name: item.name },
        });
    }

    // Emit WebSocket event to users watching this appointment
    await emitStockUpdate(appointmentId!);

    res.status(201).json(success(results, `${results.length} items added (pending confirmation)`));
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

        // Validate stock availability (but don't deduct yet)
        if (item.currentStock < packItem.quantity) {
            throw new BadRequestError(`Insufficient stock for ${item.name}. Available: ${item.currentStock}, Required: ${packItem.quantity}`);
        }

        // Create stock usage record as UNCONFIRMED
        // Stock will be deducted only when appointment is completed
        const [usageRecord] = await db.insert(appointmentStockUsage).values({
            clinicId: req.tenantContext.clinicId,
            appointmentId: appointmentId!,
            itemId: packItem.itemId,
            quantity: packItem.quantity,
            unitCost: item.costPrice ?? null,
            notes: `Applied from pack: ${pack.name}`,
            registeredById: req.user!.userId,
            // isConfirmed defaults to false - stock not deducted yet
        }).returning();

        results.push({
            ...usageRecord,
            item: { id: item.id, name: item.name },
        });
    }

    // Emit WebSocket event to users watching this appointment
    await emitStockUpdate(appointmentId!);

    res.status(201).json(success({
        packName: pack.name,
        items: results,
    }, `Pack "${pack.name}" applied (pending confirmation)`));
});

/**
 * DELETE /appointments/:appointmentId/stock/:usageId
 * Remove stock usage from appointment (only restore stock if it was confirmed)
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

    // Only restore stock if the usage was confirmed (already deducted)
    if (usage.isConfirmed) {
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
                reason: `Reversed confirmed usage from appointment ${appointmentId}`,
                reference: appointmentId!,
                performedById: req.user!.userId,
            });
        }
    }
    // If not confirmed, just delete the record without affecting inventory

    // Delete usage record
    await db
        .delete(appointmentStockUsage)
        .where(eq(appointmentStockUsage.id, usageId!));

    // Emit WebSocket event to users watching this appointment
    await emitStockUpdate(appointmentId!);

    res.json(success(null, usage.isConfirmed
        ? 'Stock usage removed and inventory restored'
        : 'Pending stock usage removed'));
});

/**
 * POST /appointments/:appointmentId/stock/confirm
 * Confirm all pending stock usage for an appointment (called when completing appointment)
 * This deducts stock and creates stock movements for all unconfirmed items
 */
export const confirmAppointmentStock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.params;

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

    // Get all unconfirmed stock usage for this appointment
    const pendingUsage = await db
        .select()
        .from(appointmentStockUsage)
        .where(and(
            eq(appointmentStockUsage.appointmentId, appointmentId!),
            eq(appointmentStockUsage.isConfirmed, false)
        ));

    if (pendingUsage.length === 0) {
        res.json(success({ confirmedCount: 0 }, 'No pending stock to confirm'));
        return;
    }

    const now = new Date();
    let confirmedCount = 0;
    const errors: string[] = [];

    // Process each pending usage
    for (const usage of pendingUsage) {
        // Get current item stock
        const [item] = await db
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.id, usage.itemId));

        if (!item) {
            errors.push(`Item ${usage.itemId} not found`);
            continue;
        }

        // Check if there's enough stock
        if (item.currentStock < usage.quantity) {
            errors.push(`Insufficient stock for ${item.name}. Available: ${item.currentStock}, Required: ${usage.quantity}`);
            continue;
        }

        // Deduct stock
        const newStock = item.currentStock - usage.quantity;
        await db
            .update(inventoryItems)
            .set({ currentStock: newStock, updatedAt: now })
            .where(eq(inventoryItems.id, usage.itemId));

        // Create stock movement
        await db.insert(stockMovements).values({
            clinicId: req.tenantContext.clinicId,
            itemId: usage.itemId,
            type: 'OUT',
            quantity: usage.quantity,
            previousStock: item.currentStock,
            newStock,
            reason: `Confirmed usage from appointment ${appointmentId}`,
            reference: appointmentId!,
            performedById: req.user!.userId,
        });

        // Mark usage as confirmed
        await db
            .update(appointmentStockUsage)
            .set({
                isConfirmed: true,
                confirmedAt: now
            })
            .where(eq(appointmentStockUsage.id, usage.id));

        confirmedCount++;
    }

    if (errors.length > 0) {
        res.status(207).json(success({
            confirmedCount,
            totalPending: pendingUsage.length,
            errors,
        }, `Partially confirmed: ${confirmedCount}/${pendingUsage.length} items`));
    } else {
        res.json(success({
            confirmedCount,
        }, `All ${confirmedCount} stock items confirmed and deducted from inventory`));
    }
});
