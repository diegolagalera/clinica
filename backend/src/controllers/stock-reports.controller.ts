import type { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/index.js';
import { BadRequestError } from '../utils/errors.js';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { db } from '../db/index.js';
import {
    inventoryItems,
    appointmentStockUsage,
    stockMovements,
    patients,
    appointments,
    users
} from '../db/schema.js';
import { eq, and, sql, gte, lte, desc, asc } from 'drizzle-orm';

/**
 * GET /stock/reports/summary
 * Get overall stock summary for the clinic
 */
export const getStockSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const clinicId = req.tenantContext.clinicId;

    // Total items and value
    const [totals] = await db
        .select({
            totalItems: sql<number>`COUNT(*)`,
            totalStock: sql<number>`SUM(${inventoryItems.currentStock})`,
            totalValue: sql<string>`SUM(${inventoryItems.currentStock} * COALESCE(${inventoryItems.costPrice}, 0))`,
        })
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.clinicId, clinicId),
            eq(inventoryItems.isActive, true)
        ));

    // Low stock count
    const [lowStock] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.clinicId, clinicId),
            eq(inventoryItems.isActive, true),
            lte(inventoryItems.currentStock, inventoryItems.minStock)
        ));

    // Out of stock count
    const [outOfStock] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.clinicId, clinicId),
            eq(inventoryItems.isActive, true),
            eq(inventoryItems.currentStock, 0)
        ));

    // Items by category
    const categoryCounts = await db
        .select({
            category: inventoryItems.category,
            count: sql<number>`COUNT(*)`,
            totalValue: sql<string>`SUM(${inventoryItems.currentStock} * COALESCE(${inventoryItems.costPrice}, 0))`,
        })
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.clinicId, clinicId),
            eq(inventoryItems.isActive, true)
        ))
        .groupBy(inventoryItems.category)
        .orderBy(desc(sql`COUNT(*)`));

    res.json(success({
        totalItems: Number(totals?.totalItems ?? 0),
        totalStock: Number(totals?.totalStock ?? 0),
        totalValue: parseFloat(totals?.totalValue ?? '0').toFixed(2),
        lowStockCount: Number(lowStock?.count ?? 0),
        outOfStockCount: Number(outOfStock?.count ?? 0),
        byCategory: categoryCounts.map(c => ({
            category: c.category || 'Sin categoría',
            count: Number(c.count),
            totalValue: parseFloat(c.totalValue ?? '0').toFixed(2),
        })),
    }));
});

/**
 * GET /stock/reports/low-stock
 * Get items with low stock
 */
export const getLowStockItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const items = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.clinicId, req.tenantContext.clinicId),
            eq(inventoryItems.isActive, true),
            lte(inventoryItems.currentStock, inventoryItems.minStock)
        ))
        .orderBy(asc(inventoryItems.currentStock));

    res.json(success(items));
});

/**
 * GET /stock/reports/consumption
 * Get consumption report for a date range
 */
export const getConsumptionReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const { startDate, endDate, groupBy } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const clinicId = req.tenantContext.clinicId;

    // Get consumption by item
    const consumption = await db
        .select({
            itemId: appointmentStockUsage.itemId,
            itemName: inventoryItems.name,
            itemSku: inventoryItems.sku,
            category: inventoryItems.category,
            totalQuantity: sql<number>`SUM(${appointmentStockUsage.quantity})`,
            totalCost: sql<string>`SUM(${appointmentStockUsage.quantity} * COALESCE(${appointmentStockUsage.unitCost}, 0))`,
            usageCount: sql<number>`COUNT(*)`,
        })
        .from(appointmentStockUsage)
        .innerJoin(inventoryItems, eq(appointmentStockUsage.itemId, inventoryItems.id))
        .where(and(
            eq(appointmentStockUsage.clinicId, clinicId),
            gte(appointmentStockUsage.createdAt, start),
            lte(appointmentStockUsage.createdAt, end)
        ))
        .groupBy(appointmentStockUsage.itemId, inventoryItems.name, inventoryItems.sku, inventoryItems.category)
        .orderBy(desc(sql`SUM(${appointmentStockUsage.quantity})`));

    // Total summary
    const [totals] = await db
        .select({
            totalQuantity: sql<number>`SUM(${appointmentStockUsage.quantity})`,
            totalCost: sql<string>`SUM(${appointmentStockUsage.quantity} * COALESCE(${appointmentStockUsage.unitCost}, 0))`,
            appointmentCount: sql<number>`COUNT(DISTINCT ${appointmentStockUsage.appointmentId})`,
        })
        .from(appointmentStockUsage)
        .where(and(
            eq(appointmentStockUsage.clinicId, clinicId),
            gte(appointmentStockUsage.createdAt, start),
            lte(appointmentStockUsage.createdAt, end)
        ));

    res.json(success({
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        summary: {
            totalQuantity: Number(totals?.totalQuantity ?? 0),
            totalCost: parseFloat(totals?.totalCost ?? '0').toFixed(2),
            appointmentCount: Number(totals?.appointmentCount ?? 0),
        },
        items: consumption.map(c => ({
            itemId: c.itemId,
            itemName: c.itemName,
            itemSku: c.itemSku,
            category: c.category,
            totalQuantity: Number(c.totalQuantity),
            totalCost: parseFloat(c.totalCost ?? '0').toFixed(2),
            usageCount: Number(c.usageCount),
        })),
    }));
});

/**
 * GET /stock/reports/consumption/by-patient
 * Get consumption grouped by patient
 */
export const getConsumptionByPatient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const clinicId = req.tenantContext.clinicId;

    const consumption = await db
        .select({
            patientId: appointments.patientId,
            patientFirstName: patients.firstName,
            patientLastName: patients.lastName,
            totalQuantity: sql<number>`SUM(${appointmentStockUsage.quantity})`,
            totalCost: sql<string>`SUM(${appointmentStockUsage.quantity} * COALESCE(${appointmentStockUsage.unitCost}, 0))`,
            appointmentCount: sql<number>`COUNT(DISTINCT ${appointmentStockUsage.appointmentId})`,
        })
        .from(appointmentStockUsage)
        .innerJoin(appointments, eq(appointmentStockUsage.appointmentId, appointments.id))
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .where(and(
            eq(appointmentStockUsage.clinicId, clinicId),
            gte(appointmentStockUsage.createdAt, start),
            lte(appointmentStockUsage.createdAt, end)
        ))
        .groupBy(appointments.patientId, patients.firstName, patients.lastName)
        .orderBy(desc(sql`SUM(${appointmentStockUsage.quantity} * COALESCE(${appointmentStockUsage.unitCost}, 0))`));

    res.json(success({
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        patients: consumption.map(c => ({
            patientId: c.patientId,
            patientName: `${c.patientFirstName} ${c.patientLastName}`,
            totalQuantity: Number(c.totalQuantity),
            totalCost: parseFloat(c.totalCost ?? '0').toFixed(2),
            appointmentCount: Number(c.appointmentCount),
        })),
    }));
});

/**
 * GET /stock/reports/movements
 * Get stock movement history
 */
export const getMovementsReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const { startDate, endDate, type, itemId } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const clinicId = req.tenantContext.clinicId;

    // Build conditions
    const conditions = [
        eq(stockMovements.clinicId, clinicId),
        gte(stockMovements.createdAt, start),
        lte(stockMovements.createdAt, end),
    ];

    if (type) {
        conditions.push(eq(stockMovements.type, type as 'IN' | 'OUT' | 'ADJUSTMENT' | 'EXPIRED'));
    }

    if (itemId) {
        conditions.push(eq(stockMovements.itemId, itemId as string));
    }

    const movements = await db
        .select({
            id: stockMovements.id,
            itemId: stockMovements.itemId,
            itemName: inventoryItems.name,
            type: stockMovements.type,
            quantity: stockMovements.quantity,
            unitCost: stockMovements.unitCost,
            previousStock: stockMovements.previousStock,
            newStock: stockMovements.newStock,
            reason: stockMovements.reason,
            reference: stockMovements.reference,
            performedByName: users.firstName,
            createdAt: stockMovements.createdAt,
        })
        .from(stockMovements)
        .innerJoin(inventoryItems, eq(stockMovements.itemId, inventoryItems.id))
        .leftJoin(users, eq(stockMovements.performedById, users.id))
        .where(and(...conditions))
        .orderBy(desc(stockMovements.createdAt))
        .limit(500);

    // Summary by type
    const typeSummary = await db
        .select({
            type: stockMovements.type,
            count: sql<number>`COUNT(*)`,
            totalQuantity: sql<number>`SUM(${stockMovements.quantity})`,
        })
        .from(stockMovements)
        .where(and(...conditions))
        .groupBy(stockMovements.type);

    res.json(success({
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        summary: typeSummary.map(t => ({
            type: t.type,
            count: Number(t.count),
            totalQuantity: Number(t.totalQuantity),
        })),
        movements: movements.map(m => ({
            ...m,
            performedBy: m.performedByName || 'Sistema',
        })),
    }));
});

/**
 * GET /stock/reports/expiring
 * Get items expiring soon
 */
export const getExpiringItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const daysAhead = parseInt(req.query['days'] as string) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const items = await db
        .select()
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.clinicId, req.tenantContext.clinicId),
            eq(inventoryItems.isActive, true),
            sql`${inventoryItems.expirationDate} IS NOT NULL`,
            lte(inventoryItems.expirationDate, futureDate)
        ))
        .orderBy(asc(inventoryItems.expirationDate));

    res.json(success({
        daysAhead,
        items: items.map(item => ({
            ...item,
            daysUntilExpiration: item.expirationDate
                ? Math.ceil((item.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null,
        })),
    }));
});
