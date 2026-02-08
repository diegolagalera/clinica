import type { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { suppliers, inventoryItems } from '../db/schema.js';
import { eq, and, ilike, sql, asc, desc } from 'drizzle-orm';
import { success, paginated, parsePaginationParams } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Validation schemas
export const createSupplierSchema = z.object({
    name: z.string().min(1).max(255),
    contactPerson: z.string().max(255).optional(),
    email: z.string().email().max(255).optional().or(z.literal('')),
    phone: z.string().max(50).optional(),
    phone2: z.string().max(50).optional(),
    website: z.string().max(500).optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

/**
 * GET /stock/suppliers
 * List all suppliers with optional search
 */
export const listSuppliers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const params = parsePaginationParams(req.query);
    const search = req.query['search'] as string | undefined;

    // Build where conditions
    const conditions = [
        eq(suppliers.clinicId, req.tenantContext.clinicId),
        eq(suppliers.isActive, true),
    ];

    if (search) {
        conditions.push(
            sql`(${ilike(suppliers.name, `%${search}%`)} OR ${ilike(suppliers.contactPerson, `%${search}%`)} OR ${ilike(suppliers.email, `%${search}%`)})`
        );
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(suppliers)
        .where(whereClause);

    const total = Number(countResult?.count ?? 0);

    // Get suppliers with pagination
    const supplierList = await db
        .select()
        .from(suppliers)
        .where(whereClause)
        .orderBy(asc(suppliers.name))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit);

    res.json(success(paginated(supplierList, total, params)));
});

/**
 * GET /stock/suppliers/all
 * Get all suppliers (for dropdown, no pagination)
 */
export const getAllSuppliers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const supplierList = await db
        .select({
            id: suppliers.id,
            name: suppliers.name,
            contactPerson: suppliers.contactPerson,
            phone: suppliers.phone,
        })
        .from(suppliers)
        .where(and(
            eq(suppliers.clinicId, req.tenantContext.clinicId),
            eq(suppliers.isActive, true)
        ))
        .orderBy(asc(suppliers.name));

    res.json(success(supplierList));
});

/**
 * GET /stock/suppliers/:id
 * Get single supplier
 */
export const getSupplier = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const [supplier] = await db
        .select()
        .from(suppliers)
        .where(and(
            eq(suppliers.id, id!),
            eq(suppliers.clinicId, req.tenantContext.clinicId)
        ));

    if (!supplier) {
        throw new NotFoundError('Supplier not found');
    }

    res.json(success(supplier));
});

/**
 * GET /stock/suppliers/:id/items
 * Get items associated with a supplier
 */
export const getSupplierItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Verify supplier exists
    const [supplier] = await db
        .select()
        .from(suppliers)
        .where(and(
            eq(suppliers.id, id!),
            eq(suppliers.clinicId, req.tenantContext.clinicId)
        ));

    if (!supplier) {
        throw new NotFoundError('Supplier not found');
    }

    // Get items for this supplier
    const items = await db
        .select({
            id: inventoryItems.id,
            name: inventoryItems.name,
            sku: inventoryItems.sku,
            category: inventoryItems.category,
            currentStock: inventoryItems.currentStock,
            minStock: inventoryItems.minStock,
        })
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.supplierId, id!),
            eq(inventoryItems.clinicId, req.tenantContext.clinicId),
            eq(inventoryItems.isActive, true)
        ))
        .orderBy(asc(inventoryItems.name));

    res.json(success(items));
});

/**
 * POST /stock/suppliers
 * Create new supplier
 */
export const createSupplier = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = createSupplierSchema.parse(req.body);

    const [supplier] = await db
        .insert(suppliers)
        .values({
            clinicId: req.tenantContext.clinicId,
            name: input.name,
            contactPerson: input.contactPerson ?? null,
            email: input.email || null,
            phone: input.phone ?? null,
            phone2: input.phone2 ?? null,
            website: input.website ?? null,
            address: input.address ?? null,
            notes: input.notes ?? null,
        })
        .returning();

    res.status(201).json(success(supplier, 'Supplier created successfully'));
});

/**
 * PUT /stock/suppliers/:id
 * Update supplier
 */
export const updateSupplier = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = updateSupplierSchema.parse(req.body);

    // Check supplier exists
    const [existing] = await db
        .select()
        .from(suppliers)
        .where(and(
            eq(suppliers.id, id!),
            eq(suppliers.clinicId, req.tenantContext.clinicId)
        ));

    if (!existing) {
        throw new NotFoundError('Supplier not found');
    }

    // Build update data
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.contactPerson !== undefined) updateData.contactPerson = input.contactPerson ?? null;
    if (input.email !== undefined) updateData.email = input.email || null;
    if (input.phone !== undefined) updateData.phone = input.phone ?? null;
    if (input.phone2 !== undefined) updateData.phone2 = input.phone2 ?? null;
    if (input.website !== undefined) updateData.website = input.website ?? null;
    if (input.address !== undefined) updateData.address = input.address ?? null;
    if (input.notes !== undefined) updateData.notes = input.notes ?? null;

    const [updated] = await db
        .update(suppliers)
        .set(updateData)
        .where(eq(suppliers.id, id!))
        .returning();

    res.json(success(updated, 'Supplier updated successfully'));
});

/**
 * DELETE /stock/suppliers/:id
 * Soft delete supplier
 */
export const deleteSupplier = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // Check supplier exists
    const [existing] = await db
        .select()
        .from(suppliers)
        .where(and(
            eq(suppliers.id, id!),
            eq(suppliers.clinicId, req.tenantContext.clinicId)
        ));

    if (!existing) {
        throw new NotFoundError('Supplier not found');
    }

    // Check if supplier has items
    const [itemCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(inventoryItems)
        .where(and(
            eq(inventoryItems.supplierId, id!),
            eq(inventoryItems.isActive, true)
        ));

    if (Number(itemCount?.count ?? 0) > 0) {
        // Soft delete - keep for reference
        await db
            .update(suppliers)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(suppliers.id, id!));
    } else {
        // Hard delete if no items
        await db
            .delete(suppliers)
            .where(eq(suppliers.id, id!));
    }

    res.json(success(null, 'Supplier deleted successfully'));
});
