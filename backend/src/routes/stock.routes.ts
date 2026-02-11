import { Router } from 'express';
import multer from 'multer';
import * as stockController from '../controllers/stock.controller.js';
import * as stockPacksController from '../controllers/stock-packs.controller.js';
import * as stockReportsController from '../controllers/stock-reports.controller.js';
import * as supplierController from '../controllers/supplier.controller.js';
import { authenticate, requireStaff, tenantContext, requireAdmin, requirePermission } from '../middleware/index.js';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
        }
    }
});

// Helper: stock permission guard for write/admin operations
const stockPerm = requirePermission('stock');

// =================================================================
// PUBLIC ROUTES (before auth middleware)
// =================================================================

// Get item image (public so it can be used in <img> tags)
router.get('/items/:id/image', stockController.getItemImage);

// All routes below require authentication + staff role + tenant context.
// READ endpoints use requireStaff so any worker can access stock data
// (needed by patient/appointment views for stock consumption).
// WRITE/ADMIN endpoints additionally require the 'stock' permission.
router.use(authenticate);
router.use(requireStaff);
router.use(tenantContext);

// ============================================================================
// STOCK REPORTS  (require 'stock' permission)
// ============================================================================

// Stock summary
router.get('/reports/summary', stockPerm, stockReportsController.getStockSummary);

// Low stock items
router.get('/reports/low-stock', stockPerm, stockReportsController.getLowStockItems);

// Consumption report
router.get('/reports/consumption', stockPerm, stockReportsController.getConsumptionReport);

// Consumption by patient
router.get('/reports/consumption/by-patient', stockPerm, stockReportsController.getConsumptionByPatient);

// Movement history
router.get('/reports/movements', stockPerm, stockReportsController.getMovementsReport);

// Expiring items
router.get('/reports/expiring', stockPerm, stockReportsController.getExpiringItems);

// ============================================================================
// SUPPLIERS  (require 'stock' permission for all operations)
// ============================================================================

// List suppliers (with search)
router.get('/suppliers', stockPerm, supplierController.listSuppliers);

// Get all suppliers (for dropdown, no pagination)
router.get('/suppliers/all', stockPerm, supplierController.getAllSuppliers);

// Get single supplier
router.get('/suppliers/:id', stockPerm, supplierController.getSupplier);

// Get items for a supplier
router.get('/suppliers/:id/items', stockPerm, supplierController.getSupplierItems);

// Create supplier
router.post('/suppliers', stockPerm, supplierController.createSupplier);

// Update supplier
router.put('/suppliers/:id', stockPerm, supplierController.updateSupplier);

// Delete supplier
router.delete('/suppliers/:id', stockPerm, supplierController.deleteSupplier);

// ============================================================================
// INVENTORY ITEMS — READ (any staff)
// ============================================================================

// List items (with filters) — needed by patient/appointment views
router.get('/items', stockController.listItems);

// Get categories
router.get('/items/categories', stockController.getCategories);

// Get single item
router.get('/items/:id', stockController.getItem);

// Get item movement history (stock perm — admin view)
router.get('/items/:id/movements', stockPerm, stockController.getItemMovements);

// ============================================================================
// INVENTORY ITEMS — WRITE (require 'stock' permission)
// ============================================================================

// Create item
router.post('/items', stockPerm, stockController.createItem);

// Update item
router.put('/items/:id', stockPerm, stockController.updateItem);

// Delete item
router.delete('/items/:id', stockPerm, stockController.deleteItem);

// Adjust stock
router.post('/items/:id/adjust', stockPerm, stockController.adjustStock);

// Upload item image
router.post('/items/:id/image', stockPerm, upload.single('image'), stockController.uploadItemImage);

// Delete item image
router.delete('/items/:id/image', stockPerm, stockController.deleteItemImage);

// Generate AI image (preview only, returns URL)
router.post('/items/generate-image', stockPerm, stockController.generateItemImage);

// Generate AI image for existing item and save it
router.post('/items/:id/generate-image', stockPerm, stockController.generateAndSaveItemImage);

// ============================================================================
// STOCK PACKS — READ (any staff)
// ============================================================================

// List packs — needed by patient/appointment views
router.get('/packs', stockPacksController.listPacks);

// Get pack categories
router.get('/packs/categories', stockPacksController.getPackCategories);

// Get single pack with items
router.get('/packs/:id', stockPacksController.getPack);

// ============================================================================
// STOCK PACKS — WRITE (require 'stock' permission)
// ============================================================================

// Create pack
router.post('/packs', stockPerm, stockPacksController.createPack);

// Update pack
router.put('/packs/:id', stockPerm, stockPacksController.updatePack);

// Delete pack
router.delete('/packs/:id', stockPerm, stockPacksController.deletePack);

// Add item to pack
router.post('/packs/:id/items', stockPerm, stockPacksController.addPackItem);

// Remove item from pack
router.delete('/packs/:id/items/:itemId', stockPerm, stockPacksController.removePackItem);

export default router;
