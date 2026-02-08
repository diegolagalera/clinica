"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removePackItem = exports.addPackItem = exports.deletePack = exports.updatePack = exports.createPack = exports.getPack = exports.getPackCategories = exports.listPacks = exports.updatePackSchema = exports.createPackSchema = void 0;
const zod_1 = require("zod");
const index_js_1 = require("../middleware/index.js");
const errors_js_1 = require("../utils/errors.js");
const response_js_1 = require("../utils/response.js");
const index_js_2 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const drizzle_orm_1 = require("drizzle-orm");
// Validation schemas
exports.createPackSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().max(100).optional(),
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().min(1).default(1),
    })).optional(),
});
exports.updatePackSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().max(100).optional(),
    isActive: zod_1.z.boolean().optional(),
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().min(1).default(1),
    })).optional(),
});
/**
 * GET /stock/packs
 * List stock packs with optional filtering
 */
exports.listPacks = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const search = req.query['search'];
    const category = req.query['category'];
    const isActive = req.query['isActive'] !== 'false';
    // Build conditions
    const conditions = [(0, drizzle_orm_1.eq)(schema_js_1.stockPacks.clinicId, req.tenantContext.clinicId)];
    if (isActive !== undefined) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.isActive, isActive));
    }
    if (category) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.category, category));
    }
    let whereClause = (0, drizzle_orm_1.and)(...conditions);
    if (search) {
        whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.ilike)(schema_js_1.stockPacks.name, `%${search}%`));
    }
    // Count total
    const [countResult] = await index_js_2.db
        .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
        .from(schema_js_1.stockPacks)
        .where(whereClause);
    const total = Number(countResult?.count ?? 0);
    // Get packs with item count using LEFT JOIN
    const packsWithCounts = await index_js_2.db
        .select({
        id: schema_js_1.stockPacks.id,
        clinicId: schema_js_1.stockPacks.clinicId,
        name: schema_js_1.stockPacks.name,
        description: schema_js_1.stockPacks.description,
        category: schema_js_1.stockPacks.category,
        isActive: schema_js_1.stockPacks.isActive,
        createdById: schema_js_1.stockPacks.createdById,
        createdAt: schema_js_1.stockPacks.createdAt,
        updatedAt: schema_js_1.stockPacks.updatedAt,
    })
        .from(schema_js_1.stockPacks)
        .where(whereClause)
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.stockPacks.name))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit);
    // Get item counts for each pack
    const packIds = packsWithCounts.map(p => p.id);
    const itemCounts = packIds.length > 0
        ? await index_js_2.db
            .select({
            packId: schema_js_1.stockPackItems.packId,
            count: (0, drizzle_orm_1.sql) `count(*)`.as('count'),
        })
            .from(schema_js_1.stockPackItems)
            .where((0, drizzle_orm_1.sql) `${schema_js_1.stockPackItems.packId} IN (${drizzle_orm_1.sql.join(packIds.map(id => (0, drizzle_orm_1.sql) `${id}`), (0, drizzle_orm_1.sql) `, `)})`)
            .groupBy(schema_js_1.stockPackItems.packId)
        : [];
    // Merge counts into packs
    const countMap = new Map(itemCounts.map(c => [c.packId, Number(c.count)]));
    const packs = packsWithCounts.map(p => ({
        ...p,
        itemCount: countMap.get(p.id) || 0,
    }));
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(packs, total, params)));
});
/**
 * GET /stock/packs/categories
 * Get list of unique pack categories
 */
exports.getPackCategories = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const categories = await index_js_2.db
        .selectDistinct({ category: schema_js_1.stockPacks.category })
        .from(schema_js_1.stockPacks)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.clinicId, req.tenantContext.clinicId), (0, drizzle_orm_1.sql) `${schema_js_1.stockPacks.category} IS NOT NULL`))
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.stockPacks.category));
    res.json((0, response_js_1.success)(categories.map(c => c.category).filter(Boolean)));
});
/**
 * GET /stock/packs/:id
 * Get pack with items
 */
exports.getPack = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // Get pack
    const [pack] = await index_js_2.db
        .select()
        .from(schema_js_1.stockPacks)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, id), (0, drizzle_orm_1.eq)(schema_js_1.stockPacks.clinicId, req.tenantContext.clinicId)));
    if (!pack) {
        throw new errors_js_1.NotFoundError('Pack not found');
    }
    // Get pack items with inventory details
    const items = await index_js_2.db
        .select({
        id: schema_js_1.stockPackItems.id,
        itemId: schema_js_1.stockPackItems.itemId,
        quantity: schema_js_1.stockPackItems.quantity,
        item: {
            id: schema_js_1.inventoryItems.id,
            name: schema_js_1.inventoryItems.name,
            sku: schema_js_1.inventoryItems.sku,
            category: schema_js_1.inventoryItems.category,
            unit: schema_js_1.inventoryItems.unit,
            currentStock: schema_js_1.inventoryItems.currentStock,
            imageUrl: schema_js_1.inventoryItems.imageUrl,
        },
    })
        .from(schema_js_1.stockPackItems)
        .innerJoin(schema_js_1.inventoryItems, (0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.itemId, schema_js_1.inventoryItems.id))
        .where((0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.packId, id));
    res.json((0, response_js_1.success)({
        ...pack,
        items,
    }));
});
/**
 * POST /stock/packs
 * Create new stock pack
 */
exports.createPack = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = exports.createPackSchema.parse(req.body);
    // Create pack
    const [pack] = await index_js_2.db
        .insert(schema_js_1.stockPacks)
        .values({
        clinicId: req.tenantContext.clinicId,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        createdById: req.user.userId,
    })
        .returning();
    // Add items if provided
    if (input.items && input.items.length > 0) {
        await index_js_2.db.insert(schema_js_1.stockPackItems).values(input.items.map(item => ({
            packId: pack.id,
            itemId: item.itemId,
            quantity: item.quantity,
        })));
    }
    // Return pack with items
    const items = input.items && input.items.length > 0
        ? await index_js_2.db
            .select({
            id: schema_js_1.stockPackItems.id,
            itemId: schema_js_1.stockPackItems.itemId,
            quantity: schema_js_1.stockPackItems.quantity,
            item: {
                id: schema_js_1.inventoryItems.id,
                name: schema_js_1.inventoryItems.name,
                sku: schema_js_1.inventoryItems.sku,
            },
        })
            .from(schema_js_1.stockPackItems)
            .innerJoin(schema_js_1.inventoryItems, (0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.itemId, schema_js_1.inventoryItems.id))
            .where((0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.packId, pack.id))
        : [];
    res.status(201).json((0, response_js_1.success)({ ...pack, items }, 'Pack created successfully'));
});
/**
 * PUT /stock/packs/:id
 * Update stock pack
 */
exports.updatePack = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = exports.updatePackSchema.parse(req.body);
    // Check pack exists
    const [existing] = await index_js_2.db
        .select()
        .from(schema_js_1.stockPacks)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, id), (0, drizzle_orm_1.eq)(schema_js_1.stockPacks.clinicId, req.tenantContext.clinicId)));
    if (!existing) {
        throw new errors_js_1.NotFoundError('Pack not found');
    }
    // Update pack details
    const updateData = { updatedAt: new Date() };
    if (input.name !== undefined)
        updateData.name = input.name;
    if (input.description !== undefined)
        updateData.description = input.description ?? null;
    if (input.category !== undefined)
        updateData.category = input.category ?? null;
    if (input.isActive !== undefined)
        updateData.isActive = input.isActive;
    const [pack] = await index_js_2.db
        .update(schema_js_1.stockPacks)
        .set(updateData)
        .where((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, id))
        .returning();
    // Update items if provided (replace all)
    if (input.items !== undefined) {
        // Delete existing items
        await index_js_2.db.delete(schema_js_1.stockPackItems).where((0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.packId, id));
        // Insert new items
        if (input.items.length > 0) {
            await index_js_2.db.insert(schema_js_1.stockPackItems).values(input.items.map(item => ({
                packId: id,
                itemId: item.itemId,
                quantity: item.quantity,
            })));
        }
    }
    // Get updated items
    const items = await index_js_2.db
        .select({
        id: schema_js_1.stockPackItems.id,
        itemId: schema_js_1.stockPackItems.itemId,
        quantity: schema_js_1.stockPackItems.quantity,
        item: {
            id: schema_js_1.inventoryItems.id,
            name: schema_js_1.inventoryItems.name,
            sku: schema_js_1.inventoryItems.sku,
        },
    })
        .from(schema_js_1.stockPackItems)
        .innerJoin(schema_js_1.inventoryItems, (0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.itemId, schema_js_1.inventoryItems.id))
        .where((0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.packId, id));
    res.json((0, response_js_1.success)({ ...pack, items }, 'Pack updated successfully'));
});
/**
 * DELETE /stock/packs/:id
 * Soft delete stock pack
 */
exports.deletePack = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // Check pack exists
    const [existing] = await index_js_2.db
        .select()
        .from(schema_js_1.stockPacks)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, id), (0, drizzle_orm_1.eq)(schema_js_1.stockPacks.clinicId, req.tenantContext.clinicId)));
    if (!existing) {
        throw new errors_js_1.NotFoundError('Pack not found');
    }
    // Soft delete
    await index_js_2.db
        .update(schema_js_1.stockPacks)
        .set({ isActive: false, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, id));
    res.json((0, response_js_1.success)(null, 'Pack deleted successfully'));
});
/**
 * POST /stock/packs/:id/items
 * Add item to pack
 */
exports.addPackItem = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { itemId, quantity = 1 } = req.body;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    if (!itemId) {
        throw new errors_js_1.BadRequestError('Item ID is required');
    }
    // Check pack exists
    const [pack] = await index_js_2.db
        .select()
        .from(schema_js_1.stockPacks)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, id), (0, drizzle_orm_1.eq)(schema_js_1.stockPacks.clinicId, req.tenantContext.clinicId)));
    if (!pack) {
        throw new errors_js_1.NotFoundError('Pack not found');
    }
    // Check item exists and belongs to clinic
    const [item] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, itemId), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
    if (!item) {
        throw new errors_js_1.NotFoundError('Item not found');
    }
    // Check if item already in pack
    const [existingItem] = await index_js_2.db
        .select()
        .from(schema_js_1.stockPackItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.packId, id), (0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.itemId, itemId)));
    if (existingItem) {
        // Update quantity
        await index_js_2.db
            .update(schema_js_1.stockPackItems)
            .set({ quantity: existingItem.quantity + quantity })
            .where((0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.id, existingItem.id));
    }
    else {
        // Add new item
        await index_js_2.db.insert(schema_js_1.stockPackItems).values({
            packId: id,
            itemId,
            quantity,
        });
    }
    // Update pack timestamp
    await index_js_2.db
        .update(schema_js_1.stockPacks)
        .set({ updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, id));
    res.json((0, response_js_1.success)(null, 'Item added to pack'));
});
/**
 * DELETE /stock/packs/:id/items/:itemId
 * Remove item from pack
 */
exports.removePackItem = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id, itemId } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // Check pack exists
    const [pack] = await index_js_2.db
        .select()
        .from(schema_js_1.stockPacks)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, id), (0, drizzle_orm_1.eq)(schema_js_1.stockPacks.clinicId, req.tenantContext.clinicId)));
    if (!pack) {
        throw new errors_js_1.NotFoundError('Pack not found');
    }
    // Delete item from pack
    await index_js_2.db
        .delete(schema_js_1.stockPackItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.packId, id), (0, drizzle_orm_1.eq)(schema_js_1.stockPackItems.itemId, itemId)));
    // Update pack timestamp
    await index_js_2.db
        .update(schema_js_1.stockPacks)
        .set({ updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.stockPacks.id, id));
    res.json((0, response_js_1.success)(null, 'Item removed from pack'));
});
//# sourceMappingURL=stock-packs.controller.js.map