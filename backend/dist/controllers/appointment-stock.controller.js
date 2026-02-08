"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeStockUsage = exports.applyPackToAppointment = exports.addBulkStockUsage = exports.addStockUsage = exports.getAppointmentStock = exports.addMultipleStockUsageSchema = exports.addStockUsageSchema = void 0;
const zod_1 = require("zod");
const index_js_1 = require("../middleware/index.js");
const errors_js_1 = require("../utils/errors.js");
const response_js_1 = require("../utils/response.js");
const index_js_2 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const drizzle_orm_1 = require("drizzle-orm");
// Validation schemas
exports.addStockUsageSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().int().min(1),
    notes: zod_1.z.string().optional(),
});
exports.addMultipleStockUsageSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().min(1),
        notes: zod_1.z.string().optional(),
    })),
});
/**
 * GET /appointments/:appointmentId/stock
 * Get stock usage for an appointment
 */
exports.getAppointmentStock = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { appointmentId } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // Check appointment exists and belongs to clinic
    const [appointment] = await index_js_2.db
        .select()
        .from(schema_js_1.appointments)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, appointmentId), (0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, req.tenantContext.clinicId)));
    if (!appointment) {
        throw new errors_js_1.NotFoundError('Appointment not found');
    }
    // Get stock usage with item details
    const usage = await index_js_2.db
        .select({
        id: schema_js_1.appointmentStockUsage.id,
        itemId: schema_js_1.appointmentStockUsage.itemId,
        quantity: schema_js_1.appointmentStockUsage.quantity,
        unitCost: schema_js_1.appointmentStockUsage.unitCost,
        notes: schema_js_1.appointmentStockUsage.notes,
        createdAt: schema_js_1.appointmentStockUsage.createdAt,
        item: {
            id: schema_js_1.inventoryItems.id,
            name: schema_js_1.inventoryItems.name,
            sku: schema_js_1.inventoryItems.sku,
            category: schema_js_1.inventoryItems.category,
            unit: schema_js_1.inventoryItems.unit,
            imageUrl: schema_js_1.inventoryItems.imageUrl,
        },
    })
        .from(schema_js_1.appointmentStockUsage)
        .innerJoin(schema_js_1.inventoryItems, (0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.itemId, schema_js_1.inventoryItems.id))
        .where((0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.appointmentId, appointmentId))
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.appointmentStockUsage.createdAt));
    // Calculate total cost
    const totalCost = usage.reduce((sum, item) => {
        const cost = parseFloat(item.unitCost || '0') * item.quantity;
        return sum + cost;
    }, 0);
    res.json((0, response_js_1.success)({
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
exports.addStockUsage = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { appointmentId } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = exports.addStockUsageSchema.parse(req.body);
    // Check appointment exists
    const [appointment] = await index_js_2.db
        .select()
        .from(schema_js_1.appointments)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, appointmentId), (0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, req.tenantContext.clinicId)));
    if (!appointment) {
        throw new errors_js_1.NotFoundError('Appointment not found');
    }
    // Check item exists and get current stock
    const [item] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, input.itemId), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
    if (!item) {
        throw new errors_js_1.NotFoundError('Item not found');
    }
    if (item.currentStock < input.quantity) {
        throw new errors_js_1.BadRequestError(`Insufficient stock for ${item.name}. Available: ${item.currentStock}`);
    }
    // Create stock usage record
    const [usage] = await index_js_2.db.insert(schema_js_1.appointmentStockUsage).values({
        clinicId: req.tenantContext.clinicId,
        appointmentId: appointmentId,
        itemId: input.itemId,
        quantity: input.quantity,
        unitCost: item.costPrice ?? null,
        notes: input.notes ?? null,
        registeredById: req.user.userId,
    }).returning();
    // Decrement stock
    const newStock = item.currentStock - input.quantity;
    await index_js_2.db
        .update(schema_js_1.inventoryItems)
        .set({ currentStock: newStock, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, input.itemId));
    // Record stock movement
    await index_js_2.db.insert(schema_js_1.stockMovements).values({
        clinicId: req.tenantContext.clinicId,
        itemId: input.itemId,
        type: 'OUT',
        quantity: input.quantity,
        previousStock: item.currentStock,
        newStock,
        reason: `Used in appointment ${appointmentId}`,
        reference: appointmentId,
        performedById: req.user.userId,
    });
    res.status(201).json((0, response_js_1.success)({
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
exports.addBulkStockUsage = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { appointmentId } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = exports.addMultipleStockUsageSchema.parse(req.body);
    // Check appointment exists
    const [appointment] = await index_js_2.db
        .select()
        .from(schema_js_1.appointments)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, appointmentId), (0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, req.tenantContext.clinicId)));
    if (!appointment) {
        throw new errors_js_1.NotFoundError('Appointment not found');
    }
    const results = [];
    for (const usage of input.items) {
        // Get item
        const [item] = await index_js_2.db
            .select()
            .from(schema_js_1.inventoryItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, usage.itemId), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
        if (!item) {
            throw new errors_js_1.NotFoundError(`Item ${usage.itemId} not found`);
        }
        if (item.currentStock < usage.quantity) {
            throw new errors_js_1.BadRequestError(`Insufficient stock for ${item.name}. Available: ${item.currentStock}`);
        }
        // Create stock usage record
        const [usageRecord] = await index_js_2.db.insert(schema_js_1.appointmentStockUsage).values({
            clinicId: req.tenantContext.clinicId,
            appointmentId: appointmentId,
            itemId: usage.itemId,
            quantity: usage.quantity,
            unitCost: item.costPrice ?? null,
            notes: usage.notes ?? null,
            registeredById: req.user.userId,
        }).returning();
        // Decrement stock
        const newStock = item.currentStock - usage.quantity;
        await index_js_2.db
            .update(schema_js_1.inventoryItems)
            .set({ currentStock: newStock, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, usage.itemId));
        // Record stock movement
        await index_js_2.db.insert(schema_js_1.stockMovements).values({
            clinicId: req.tenantContext.clinicId,
            itemId: usage.itemId,
            type: 'OUT',
            quantity: usage.quantity,
            previousStock: item.currentStock,
            newStock,
            reason: `Used in appointment ${appointmentId}`,
            reference: appointmentId,
            performedById: req.user.userId,
        });
        results.push({
            ...usageRecord,
            item: { id: item.id, name: item.name },
        });
    }
    res.status(201).json((0, response_js_1.success)(results, `${results.length} items added to appointment`));
});
/**
 * POST /appointments/:appointmentId/stock/pack/:packId
 * Apply a stock pack to an appointment
 */
exports.applyPackToAppointment = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { appointmentId, packId } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // Check appointment exists
    const [appointment] = await index_js_2.db
        .select()
        .from(schema_js_1.appointments)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, appointmentId), (0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, req.tenantContext.clinicId)));
    if (!appointment) {
        throw new errors_js_1.NotFoundError('Appointment not found');
    }
    // Check pack exists and get items
    const [pack] = await index_js_2.db
        .select()
        .from(schema_js_1.stockPacks)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, packId), (0, drizzle_orm_1.eq)(schema_js_1.stockPacks.clinicId, req.tenantContext.clinicId), (0, drizzle_orm_1.eq)(schema_js_1.stockPacks.isActive, true)));
    if (!pack) {
        throw new errors_js_1.NotFoundError('Pack not found');
    }
    // Get pack items
    const packItems = await index_js_2.db
        .select({
        itemId: schema_js_1.stockPackItems.itemId,
        quantity: schema_js_1.stockPackItems.quantity,
    })
        .from(schema_js_1.stockPackItems)
        .where((0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.packId, packId));
    if (packItems.length === 0) {
        throw new errors_js_1.BadRequestError('Pack has no items');
    }
    const results = [];
    for (const packItem of packItems) {
        // Get inventory item
        const [item] = await index_js_2.db
            .select()
            .from(schema_js_1.inventoryItems)
            .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, packItem.itemId));
        if (!item || !item.isActive) {
            continue; // Skip inactive or missing items
        }
        if (item.currentStock < packItem.quantity) {
            throw new errors_js_1.BadRequestError(`Insufficient stock for ${item.name}. Available: ${item.currentStock}, Required: ${packItem.quantity}`);
        }
        // Create stock usage record
        const [usageRecord] = await index_js_2.db.insert(schema_js_1.appointmentStockUsage).values({
            clinicId: req.tenantContext.clinicId,
            appointmentId: appointmentId,
            itemId: packItem.itemId,
            quantity: packItem.quantity,
            unitCost: item.costPrice ?? null,
            notes: `Applied from pack: ${pack.name}`,
            registeredById: req.user.userId,
        }).returning();
        // Decrement stock
        const newStock = item.currentStock - packItem.quantity;
        await index_js_2.db
            .update(schema_js_1.inventoryItems)
            .set({ currentStock: newStock, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, packItem.itemId));
        // Record stock movement
        await index_js_2.db.insert(schema_js_1.stockMovements).values({
            clinicId: req.tenantContext.clinicId,
            itemId: packItem.itemId,
            type: 'OUT',
            quantity: packItem.quantity,
            previousStock: item.currentStock,
            newStock,
            reason: `Pack "${pack.name}" applied to appointment ${appointmentId}`,
            reference: appointmentId,
            performedById: req.user.userId,
        });
        results.push({
            ...usageRecord,
            item: { id: item.id, name: item.name },
        });
    }
    res.status(201).json((0, response_js_1.success)({
        packName: pack.name,
        items: results,
    }, `Pack "${pack.name}" applied successfully`));
});
/**
 * DELETE /appointments/:appointmentId/stock/:usageId
 * Remove stock usage from appointment (and restore stock)
 */
exports.removeStockUsage = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { appointmentId, usageId } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // Get the usage record
    const [usage] = await index_js_2.db
        .select()
        .from(schema_js_1.appointmentStockUsage)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.id, usageId), (0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.appointmentId, appointmentId), (0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.clinicId, req.tenantContext.clinicId)));
    if (!usage) {
        throw new errors_js_1.NotFoundError('Stock usage record not found');
    }
    // Get current item stock
    const [item] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, usage.itemId));
    if (item) {
        // Restore stock
        const newStock = item.currentStock + usage.quantity;
        await index_js_2.db
            .update(schema_js_1.inventoryItems)
            .set({ currentStock: newStock, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, usage.itemId));
        // Record stock movement (reversal)
        await index_js_2.db.insert(schema_js_1.stockMovements).values({
            clinicId: req.tenantContext.clinicId,
            itemId: usage.itemId,
            type: 'IN',
            quantity: usage.quantity,
            previousStock: item.currentStock,
            newStock,
            reason: `Reversed usage from appointment ${appointmentId}`,
            reference: appointmentId,
            performedById: req.user.userId,
        });
    }
    // Delete usage record
    await index_js_2.db
        .delete(schema_js_1.appointmentStockUsage)
        .where((0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.id, usageId));
    res.json((0, response_js_1.success)(null, 'Stock usage removed and inventory restored'));
});
//# sourceMappingURL=appointment-stock.controller.js.map