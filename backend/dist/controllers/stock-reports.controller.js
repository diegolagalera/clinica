"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpiringItems = exports.getMovementsReport = exports.getConsumptionByPatient = exports.getConsumptionReport = exports.getLowStockItems = exports.getStockSummary = void 0;
const index_js_1 = require("../middleware/index.js");
const errors_js_1 = require("../utils/errors.js");
const response_js_1 = require("../utils/response.js");
const index_js_2 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const drizzle_orm_1 = require("drizzle-orm");
/**
 * GET /stock/reports/summary
 * Get overall stock summary for the clinic
 */
exports.getStockSummary = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const clinicId = req.tenantContext.clinicId;
    // Total items and value
    const [totals] = await index_js_2.db
        .select({
        totalItems: (0, drizzle_orm_1.sql) `COUNT(*)`,
        totalStock: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.inventoryItems.currentStock})`,
        totalValue: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.inventoryItems.currentStock} * COALESCE(${schema_js_1.inventoryItems.costPrice}, 0))`,
    })
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, clinicId), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.isActive, true)));
    // Low stock count
    const [lowStock] = await index_js_2.db
        .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, clinicId), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.isActive, true), (0, drizzle_orm_1.lte)(schema_js_1.inventoryItems.currentStock, schema_js_1.inventoryItems.minStock)));
    // Out of stock count
    const [outOfStock] = await index_js_2.db
        .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, clinicId), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.isActive, true), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.currentStock, 0)));
    // Items by category
    const categoryCounts = await index_js_2.db
        .select({
        category: schema_js_1.inventoryItems.category,
        count: (0, drizzle_orm_1.sql) `COUNT(*)`,
        totalValue: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.inventoryItems.currentStock} * COALESCE(${schema_js_1.inventoryItems.costPrice}, 0))`,
    })
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, clinicId), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.isActive, true)))
        .groupBy(schema_js_1.inventoryItems.category)
        .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `COUNT(*)`));
    res.json((0, response_js_1.success)({
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
exports.getLowStockItems = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const items = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.isActive, true), (0, drizzle_orm_1.lte)(schema_js_1.inventoryItems.currentStock, schema_js_1.inventoryItems.minStock)))
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.inventoryItems.currentStock));
    res.json((0, response_js_1.success)(items));
});
/**
 * GET /stock/reports/consumption
 * Get consumption report for a date range
 */
exports.getConsumptionReport = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const { startDate, endDate, groupBy } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const clinicId = req.tenantContext.clinicId;
    // Get consumption by item
    const consumption = await index_js_2.db
        .select({
        itemId: schema_js_1.appointmentStockUsage.itemId,
        itemName: schema_js_1.inventoryItems.name,
        itemSku: schema_js_1.inventoryItems.sku,
        category: schema_js_1.inventoryItems.category,
        totalQuantity: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.appointmentStockUsage.quantity})`,
        totalCost: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.appointmentStockUsage.quantity} * COALESCE(${schema_js_1.appointmentStockUsage.unitCost}, 0))`,
        usageCount: (0, drizzle_orm_1.sql) `COUNT(*)`,
    })
        .from(schema_js_1.appointmentStockUsage)
        .innerJoin(schema_js_1.inventoryItems, (0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.itemId, schema_js_1.inventoryItems.id))
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.clinicId, clinicId), (0, drizzle_orm_1.gte)(schema_js_1.appointmentStockUsage.createdAt, start), (0, drizzle_orm_1.lte)(schema_js_1.appointmentStockUsage.createdAt, end)))
        .groupBy(schema_js_1.appointmentStockUsage.itemId, schema_js_1.inventoryItems.name, schema_js_1.inventoryItems.sku, schema_js_1.inventoryItems.category)
        .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `SUM(${schema_js_1.appointmentStockUsage.quantity})`));
    // Total summary
    const [totals] = await index_js_2.db
        .select({
        totalQuantity: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.appointmentStockUsage.quantity})`,
        totalCost: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.appointmentStockUsage.quantity} * COALESCE(${schema_js_1.appointmentStockUsage.unitCost}, 0))`,
        appointmentCount: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema_js_1.appointmentStockUsage.appointmentId})`,
    })
        .from(schema_js_1.appointmentStockUsage)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.clinicId, clinicId), (0, drizzle_orm_1.gte)(schema_js_1.appointmentStockUsage.createdAt, start), (0, drizzle_orm_1.lte)(schema_js_1.appointmentStockUsage.createdAt, end)));
    res.json((0, response_js_1.success)({
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
exports.getConsumptionByPatient = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const clinicId = req.tenantContext.clinicId;
    const consumption = await index_js_2.db
        .select({
        patientId: schema_js_1.appointments.patientId,
        patientFirstName: schema_js_1.patients.firstName,
        patientLastName: schema_js_1.patients.lastName,
        totalQuantity: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.appointmentStockUsage.quantity})`,
        totalCost: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.appointmentStockUsage.quantity} * COALESCE(${schema_js_1.appointmentStockUsage.unitCost}, 0))`,
        appointmentCount: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema_js_1.appointmentStockUsage.appointmentId})`,
    })
        .from(schema_js_1.appointmentStockUsage)
        .innerJoin(schema_js_1.appointments, (0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.appointmentId, schema_js_1.appointments.id))
        .innerJoin(schema_js_1.patients, (0, drizzle_orm_1.eq)(schema_js_1.appointments.patientId, schema_js_1.patients.id))
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.clinicId, clinicId), (0, drizzle_orm_1.gte)(schema_js_1.appointmentStockUsage.createdAt, start), (0, drizzle_orm_1.lte)(schema_js_1.appointmentStockUsage.createdAt, end)))
        .groupBy(schema_js_1.appointments.patientId, schema_js_1.patients.firstName, schema_js_1.patients.lastName)
        .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `SUM(${schema_js_1.appointmentStockUsage.quantity} * COALESCE(${schema_js_1.appointmentStockUsage.unitCost}, 0))`));
    res.json((0, response_js_1.success)({
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
exports.getMovementsReport = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const { startDate, endDate, type, itemId } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const clinicId = req.tenantContext.clinicId;
    // Build conditions
    const conditions = [
        (0, drizzle_orm_1.eq)(schema_js_1.stockMovements.clinicId, clinicId),
        (0, drizzle_orm_1.gte)(schema_js_1.stockMovements.createdAt, start),
        (0, drizzle_orm_1.lte)(schema_js_1.stockMovements.createdAt, end),
    ];
    if (type) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.stockMovements.type, type));
    }
    if (itemId) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.stockMovements.itemId, itemId));
    }
    const movements = await index_js_2.db
        .select({
        id: schema_js_1.stockMovements.id,
        itemId: schema_js_1.stockMovements.itemId,
        itemName: schema_js_1.inventoryItems.name,
        type: schema_js_1.stockMovements.type,
        quantity: schema_js_1.stockMovements.quantity,
        previousStock: schema_js_1.stockMovements.previousStock,
        newStock: schema_js_1.stockMovements.newStock,
        reason: schema_js_1.stockMovements.reason,
        reference: schema_js_1.stockMovements.reference,
        performedByName: schema_js_1.users.firstName,
        createdAt: schema_js_1.stockMovements.createdAt,
    })
        .from(schema_js_1.stockMovements)
        .innerJoin(schema_js_1.inventoryItems, (0, drizzle_orm_1.eq)(schema_js_1.stockMovements.itemId, schema_js_1.inventoryItems.id))
        .leftJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.stockMovements.performedById, schema_js_1.users.id))
        .where((0, drizzle_orm_1.and)(...conditions))
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.stockMovements.createdAt))
        .limit(500);
    // Summary by type
    const typeSummary = await index_js_2.db
        .select({
        type: schema_js_1.stockMovements.type,
        count: (0, drizzle_orm_1.sql) `COUNT(*)`,
        totalQuantity: (0, drizzle_orm_1.sql) `SUM(${schema_js_1.stockMovements.quantity})`,
    })
        .from(schema_js_1.stockMovements)
        .where((0, drizzle_orm_1.and)(...conditions))
        .groupBy(schema_js_1.stockMovements.type);
    res.json((0, response_js_1.success)({
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
exports.getExpiringItems = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const daysAhead = parseInt(req.query['days']) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const items = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.isActive, true), (0, drizzle_orm_1.sql) `${schema_js_1.inventoryItems.expirationDate} IS NOT NULL`, (0, drizzle_orm_1.lte)(schema_js_1.inventoryItems.expirationDate, futureDate)))
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.inventoryItems.expirationDate));
    res.json((0, response_js_1.success)({
        daysAhead,
        items: items.map(item => ({
            ...item,
            daysUntilExpiration: item.expirationDate
                ? Math.ceil((item.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null,
        })),
    }));
});
//# sourceMappingURL=stock-reports.controller.js.map