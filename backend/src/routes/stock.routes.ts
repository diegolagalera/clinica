import { Router } from 'express';
import multer from 'multer';
import * as stockController from '../controllers/stock.controller.js';
import * as stockPacksController from '../controllers/stock-packs.controller.js';
import * as stockReportsController from '../controllers/stock-reports.controller.js';
import * as supplierController from '../controllers/supplier.controller.js';
import { authenticate, requireStaff, tenantContext, requireAdmin } from '../middleware/index.js';

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

// =================================================================
// PUBLIC ROUTES (before auth middleware)
// =================================================================

// Get item image (public so it can be used in <img> tags)
router.get('/items/:id/image', stockController.getItemImage);

// All routes below require authentication, staff role, and tenant context
router.use(authenticate);
router.use(requireStaff);
router.use(tenantContext);

// ============================================================================
// STOCK REPORTS
// ============================================================================

// Stock summary
router.get('/reports/summary', stockReportsController.getStockSummary);

// Low stock items
router.get('/reports/low-stock', stockReportsController.getLowStockItems);

// Consumption report
router.get('/reports/consumption', stockReportsController.getConsumptionReport);

// Consumption by patient
router.get('/reports/consumption/by-patient', stockReportsController.getConsumptionByPatient);

// Movement history
router.get('/reports/movements', stockReportsController.getMovementsReport);

// Expiring items
router.get('/reports/expiring', stockReportsController.getExpiringItems);

// ============================================================================
// SUPPLIERS
// ============================================================================

// List suppliers (with search)
router.get('/suppliers', supplierController.listSuppliers);

// Get all suppliers (for dropdown, no pagination)
router.get('/suppliers/all', supplierController.getAllSuppliers);

// Get single supplier
router.get('/suppliers/:id', supplierController.getSupplier);

// Get items for a supplier
router.get('/suppliers/:id/items', supplierController.getSupplierItems);

// Create supplier (admin only)
router.post('/suppliers', requireAdmin, supplierController.createSupplier);

// Update supplier (admin only)
router.put('/suppliers/:id', requireAdmin, supplierController.updateSupplier);

// Delete supplier (admin only)
router.delete('/suppliers/:id', requireAdmin, supplierController.deleteSupplier);

// ============================================================================
// INVENTORY ITEMS
// ============================================================================

// List items (with filters)
router.get('/items', stockController.listItems);

// Get categories
router.get('/items/categories', stockController.getCategories);

// Get single item
router.get('/items/:id', stockController.getItem);

// Get item movement history
router.get('/items/:id/movements', stockController.getItemMovements);

// Create item (admin only)
router.post('/items', requireAdmin, stockController.createItem);

// Update item (admin only)
router.put('/items/:id', requireAdmin, stockController.updateItem);

// Delete item (admin only)
router.delete('/items/:id', requireAdmin, stockController.deleteItem);

// Adjust stock
router.post('/items/:id/adjust', stockController.adjustStock);

// Upload item image (admin only)
router.post('/items/:id/image', requireAdmin, upload.single('image'), stockController.uploadItemImage);

// Delete item image (admin only)
router.delete('/items/:id/image', requireAdmin, stockController.deleteItemImage);

// Generate AI image (preview only, returns URL)
router.post('/items/generate-image', requireAdmin, stockController.generateItemImage);

// Generate AI image for existing item and save it
router.post('/items/:id/generate-image', requireAdmin, stockController.generateAndSaveItemImage);

// ============================================================================
// STOCK PACKS
// ============================================================================

// List packs
router.get('/packs', stockPacksController.listPacks);

// Get pack categories
router.get('/packs/categories', stockPacksController.getPackCategories);

// Get single pack with items
router.get('/packs/:id', stockPacksController.getPack);

// Create pack (admin only)
router.post('/packs', requireAdmin, stockPacksController.createPack);

// Update pack (admin only)
router.put('/packs/:id', requireAdmin, stockPacksController.updatePack);

// Delete pack (admin only)
router.delete('/packs/:id', requireAdmin, stockPacksController.deletePack);

// Add item to pack (admin only)
router.post('/packs/:id/items', requireAdmin, stockPacksController.addPackItem);

// Remove item from pack (admin only)
router.delete('/packs/:id/items/:itemId', requireAdmin, stockPacksController.removePackItem);

export default router;
