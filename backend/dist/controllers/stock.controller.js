"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAndSaveItemImage = exports.generateItemImage = exports.getItemImage = exports.deleteItemImage = exports.uploadItemImage = exports.getItemMovements = exports.adjustStock = exports.deleteItem = exports.updateItem = exports.createItem = exports.getItem = exports.getCategories = exports.listItems = exports.adjustStockSchema = exports.updateItemSchema = exports.createItemSchema = void 0;
const zod_1 = require("zod");
const index_js_1 = require("../middleware/index.js");
const errors_js_1 = require("../utils/errors.js");
const response_js_1 = require("../utils/response.js");
const index_js_2 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
// Upload directory for stock item images
const UPLOAD_DIR = path_1.default.join(process.cwd(), 'uploads', 'stock');
// Validation schemas
exports.createItemSchema = zod_1.z.object({
    sku: zod_1.z.string().max(100).optional(),
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().max(100).optional(),
    unit: zod_1.z.string().max(50).default('unidades'),
    currentStock: zod_1.z.number().int().min(0).default(0),
    minStock: zod_1.z.number().int().min(0).default(0),
    maxStock: zod_1.z.number().int().min(0).optional(),
    costPrice: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform(v => v?.toString()).optional(),
    sellPrice: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform(v => v?.toString()).optional(),
    supplier: zod_1.z.string().max(255).optional(),
    supplierCode: zod_1.z.string().max(100).optional(),
    expirationDate: zod_1.z.string().transform(s => new Date(s)).optional(),
    location: zod_1.z.string().max(100).optional(),
});
exports.updateItemSchema = exports.createItemSchema.partial().extend({
    isActive: zod_1.z.boolean().optional(),
});
exports.adjustStockSchema = zod_1.z.object({
    type: zod_1.z.enum(['IN', 'OUT', 'ADJUSTMENT', 'EXPIRED']),
    quantity: zod_1.z.number().int().min(1),
    reason: zod_1.z.string().optional(),
    reference: zod_1.z.string().max(255).optional(),
});
/**
 * GET /stock/items
 * List inventory items with filtering
 */
exports.listItems = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const search = req.query['search'];
    const category = req.query['category'];
    const lowStock = req.query['lowStock'] === 'true';
    const isActive = req.query['isActive'] !== 'false'; // Default to active items
    // Build conditions
    const conditions = [(0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)];
    if (isActive !== undefined) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.isActive, isActive));
    }
    if (category) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.category, category));
    }
    if (lowStock) {
        conditions.push((0, drizzle_orm_1.lte)(schema_js_1.inventoryItems.currentStock, schema_js_1.inventoryItems.minStock));
    }
    // Search by name, sku, or supplier
    let whereClause = (0, drizzle_orm_1.and)(...conditions);
    if (search) {
        const searchConditions = (0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_js_1.inventoryItems.name, `%${search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.inventoryItems.sku, `%${search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.inventoryItems.supplier, `%${search}%`));
        whereClause = (0, drizzle_orm_1.and)(whereClause, searchConditions);
    }
    // Get total count
    const [countResult] = await index_js_2.db
        .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
        .from(schema_js_1.inventoryItems)
        .where(whereClause);
    const total = Number(countResult?.count ?? 0);
    // Get items with pagination
    const items = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where(whereClause)
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.inventoryItems.name))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit);
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(items, total, params)));
});
/**
 * GET /stock/items/categories
 * Get list of unique categories
 */
exports.getCategories = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const categories = await index_js_2.db
        .selectDistinct({ category: schema_js_1.inventoryItems.category })
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId), (0, drizzle_orm_1.sql) `${schema_js_1.inventoryItems.category} IS NOT NULL`))
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.inventoryItems.category));
    res.json((0, response_js_1.success)(categories.map(c => c.category).filter(Boolean)));
});
/**
 * GET /stock/items/:id
 * Get single item by ID
 */
exports.getItem = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const [item] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
    if (!item) {
        throw new errors_js_1.NotFoundError('Item not found');
    }
    res.json((0, response_js_1.success)(item));
});
/**
 * POST /stock/items
 * Create new inventory item
 */
exports.createItem = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = exports.createItemSchema.parse(req.body);
    const [item] = await index_js_2.db
        .insert(schema_js_1.inventoryItems)
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
    res.status(201).json((0, response_js_1.success)(item, 'Item created successfully'));
});
/**
 * PUT /stock/items/:id
 * Update inventory item
 */
exports.updateItem = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = exports.updateItemSchema.parse(req.body);
    // Check item exists and belongs to clinic
    const [existing] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
    if (!existing) {
        throw new errors_js_1.NotFoundError('Item not found');
    }
    // Build update object without undefined values
    const updateData = { updatedAt: new Date() };
    if (input.name !== undefined)
        updateData.name = input.name;
    if (input.sku !== undefined)
        updateData.sku = input.sku ?? null;
    if (input.description !== undefined)
        updateData.description = input.description ?? null;
    if (input.category !== undefined)
        updateData.category = input.category ?? null;
    if (input.unit !== undefined)
        updateData.unit = input.unit;
    if (input.currentStock !== undefined)
        updateData.currentStock = input.currentStock;
    if (input.minStock !== undefined)
        updateData.minStock = input.minStock;
    if (input.maxStock !== undefined)
        updateData.maxStock = input.maxStock ?? null;
    if (input.costPrice !== undefined)
        updateData.costPrice = input.costPrice ?? null;
    if (input.sellPrice !== undefined)
        updateData.sellPrice = input.sellPrice ?? null;
    if (input.supplier !== undefined)
        updateData.supplier = input.supplier ?? null;
    if (input.supplierCode !== undefined)
        updateData.supplierCode = input.supplierCode ?? null;
    if (input.expirationDate !== undefined)
        updateData.expirationDate = input.expirationDate ?? null;
    if (input.location !== undefined)
        updateData.location = input.location ?? null;
    if (input.isActive !== undefined)
        updateData.isActive = input.isActive;
    const [updated] = await index_js_2.db
        .update(schema_js_1.inventoryItems)
        .set(updateData)
        .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id))
        .returning();
    res.json((0, response_js_1.success)(updated, 'Item updated successfully'));
});
/**
 * DELETE /stock/items/:id
 * Soft delete inventory item
 */
exports.deleteItem = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // Check item exists
    const [existing] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
    if (!existing) {
        throw new errors_js_1.NotFoundError('Item not found');
    }
    // Soft delete
    await index_js_2.db
        .update(schema_js_1.inventoryItems)
        .set({ isActive: false, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id));
    res.json((0, response_js_1.success)(null, 'Item deleted successfully'));
});
/**
 * POST /stock/items/:id/adjust
 * Adjust stock level (in, out, adjustment, expired)
 */
exports.adjustStock = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = exports.adjustStockSchema.parse(req.body);
    // Get current item
    const [item] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
    if (!item) {
        throw new errors_js_1.NotFoundError('Item not found');
    }
    // Calculate new stock
    let newStock = item.currentStock;
    if (input.type === 'IN') {
        newStock += input.quantity;
    }
    else if (input.type === 'OUT' || input.type === 'EXPIRED') {
        newStock -= input.quantity;
        if (newStock < 0) {
            throw new errors_js_1.BadRequestError('Insufficient stock');
        }
    }
    else if (input.type === 'ADJUSTMENT') {
        // Adjustment can be positive or negative - quantity is absolute target
        newStock = input.quantity;
    }
    // Create movement record
    await index_js_2.db.insert(schema_js_1.stockMovements).values({
        clinicId: req.tenantContext.clinicId,
        itemId: id,
        type: input.type,
        quantity: input.quantity,
        previousStock: item.currentStock,
        newStock,
        reason: input.reason ?? null,
        reference: input.reference ?? null,
        performedById: req.user.userId,
    });
    // Update item stock
    const [updated] = await index_js_2.db
        .update(schema_js_1.inventoryItems)
        .set({ currentStock: newStock, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id))
        .returning();
    res.json((0, response_js_1.success)(updated, 'Stock adjusted successfully'));
});
/**
 * GET /stock/items/:id/movements
 * Get stock movement history for an item
 */
exports.getItemMovements = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    // Count total
    const [countResult] = await index_js_2.db
        .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
        .from(schema_js_1.stockMovements)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockMovements.itemId, id), (0, drizzle_orm_1.eq)(schema_js_1.stockMovements.clinicId, req.tenantContext.clinicId)));
    const total = Number(countResult?.count ?? 0);
    // Get movements
    const movements = await index_js_2.db
        .select()
        .from(schema_js_1.stockMovements)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.stockMovements.itemId, id), (0, drizzle_orm_1.eq)(schema_js_1.stockMovements.clinicId, req.tenantContext.clinicId)))
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.stockMovements.createdAt))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit);
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(movements, total, params)));
});
/**
 * POST /stock/items/:id/image
 * Upload image for a stock item
 */
exports.uploadItemImage = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    if (!req.file) {
        throw new errors_js_1.BadRequestError('No image file provided');
    }
    // Check item exists
    const [item] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
    if (!item) {
        throw new errors_js_1.NotFoundError('Item not found');
    }
    // Ensure upload directory exists
    await promises_1.default.mkdir(UPLOAD_DIR, { recursive: true });
    // Generate filename
    const ext = path_1.default.extname(req.file.originalname) || '.jpg';
    const filename = `${id}${ext}`;
    const filepath = path_1.default.join(UPLOAD_DIR, filename);
    // Delete old image if exists
    if (item.imageUrl) {
        try {
            await promises_1.default.unlink(item.imageUrl);
        }
        catch (err) {
            // Ignore if file doesn't exist
        }
    }
    // Save file
    await promises_1.default.writeFile(filepath, req.file.buffer);
    // Update item
    const [updated] = await index_js_2.db
        .update(schema_js_1.inventoryItems)
        .set({ imageUrl: filepath, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id))
        .returning();
    res.json((0, response_js_1.success)(updated, 'Image uploaded successfully'));
});
/**
 * DELETE /stock/items/:id/image
 * Delete image from a stock item
 */
exports.deleteItemImage = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // Check item exists and has image
    const [item] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
    if (!item) {
        throw new errors_js_1.NotFoundError('Item not found');
    }
    if (item.imageUrl) {
        try {
            await promises_1.default.unlink(item.imageUrl);
        }
        catch (err) {
            // Ignore if file doesn't exist
        }
        await index_js_2.db
            .update(schema_js_1.inventoryItems)
            .set({ imageUrl: null, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id));
    }
    res.json((0, response_js_1.success)(null, 'Image deleted successfully'));
});
/**
 * GET /stock/items/:id/image
 * Serve stock item image (public endpoint for img tags)
 */
exports.getItemImage = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw new errors_js_1.BadRequestError('Item ID required');
    }
    const [item] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id));
    if (!item || !item.imageUrl) {
        throw new errors_js_1.NotFoundError('Image not found');
    }
    // Check if file exists
    try {
        await promises_1.default.access(item.imageUrl);
    }
    catch {
        throw new errors_js_1.NotFoundError('Image file not found');
    }
    res.sendFile(item.imageUrl);
});
// Validation schema for image generation
const generateImageSchema = zod_1.z.object({
    itemName: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(500).optional(),
});
/**
 * POST /stock/items/generate-image
 * Generate an AI image for a stock item
 */
exports.generateItemImage = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = generateImageSchema.parse(req.body);
    // Import the service dynamically to avoid circular dependencies
    const { generateStockItemImage } = await import('../services/openai.service.js');
    const result = await generateStockItemImage(input.itemName, input.description);
    res.json((0, response_js_1.success)({
        imageUrl: result.imageUrl,
        revisedPrompt: result.revisedPrompt,
    }, 'Imagen generada correctamente'));
});
/**
 * POST /stock/items/:id/generate-image
 * Generate an AI image for an existing stock item and save it
 * OR save an already generated image URL if provided in the body
 */
exports.generateAndSaveItemImage = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { imageUrl: providedImageUrl } = req.body;
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // Check item exists
    const [item] = await index_js_2.db
        .select()
        .from(schema_js_1.inventoryItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id), (0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.clinicId, req.tenantContext.clinicId)));
    if (!item) {
        throw new errors_js_1.NotFoundError('Item not found');
    }
    let imageUrlToDownload;
    let revisedPrompt;
    // If an image URL was provided, use it directly (already generated)
    if (providedImageUrl) {
        imageUrlToDownload = providedImageUrl;
    }
    else {
        // Generate a new image
        const { generateStockItemImage } = await import('../services/openai.service.js');
        const result = await generateStockItemImage(item.name, item.description || undefined);
        imageUrlToDownload = result.imageUrl;
        revisedPrompt = result.revisedPrompt;
    }
    // Download and save the image
    const imageResponse = await fetch(imageUrlToDownload);
    if (!imageResponse.ok) {
        throw new errors_js_1.BadRequestError('No se pudo descargar la imagen');
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    // Ensure upload directory exists
    await promises_1.default.mkdir(UPLOAD_DIR, { recursive: true });
    // Generate filename
    const filename = `${id}.png`;
    const filepath = path_1.default.join(UPLOAD_DIR, filename);
    // Delete old image if exists
    if (item.imageUrl) {
        try {
            await promises_1.default.unlink(item.imageUrl);
        }
        catch {
            // Ignore if file doesn't exist
        }
    }
    // Save file
    await promises_1.default.writeFile(filepath, imageBuffer);
    // Update item
    const [updated] = await index_js_2.db
        .update(schema_js_1.inventoryItems)
        .set({ imageUrl: filepath, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.inventoryItems.id, id))
        .returning();
    res.json((0, response_js_1.success)({
        item: updated,
        revisedPrompt,
    }, 'Imagen guardada correctamente'));
});
//# sourceMappingURL=stock.controller.js.map