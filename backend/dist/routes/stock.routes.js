"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const stockController = __importStar(require("../controllers/stock.controller.js"));
const stockPacksController = __importStar(require("../controllers/stock-packs.controller.js"));
const stockReportsController = __importStar(require("../controllers/stock-reports.controller.js"));
const index_js_1 = require("../middleware/index.js");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
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
router.use(index_js_1.authenticate);
router.use(index_js_1.requireStaff);
router.use(index_js_1.tenantContext);
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
router.post('/items', index_js_1.requireAdmin, stockController.createItem);
// Update item (admin only)
router.put('/items/:id', index_js_1.requireAdmin, stockController.updateItem);
// Delete item (admin only)
router.delete('/items/:id', index_js_1.requireAdmin, stockController.deleteItem);
// Adjust stock
router.post('/items/:id/adjust', stockController.adjustStock);
// Upload item image (admin only)
router.post('/items/:id/image', index_js_1.requireAdmin, upload.single('image'), stockController.uploadItemImage);
// Delete item image (admin only)
router.delete('/items/:id/image', index_js_1.requireAdmin, stockController.deleteItemImage);
// Generate AI image (preview only, returns URL)
router.post('/items/generate-image', index_js_1.requireAdmin, stockController.generateItemImage);
// Generate AI image for existing item and save it
router.post('/items/:id/generate-image', index_js_1.requireAdmin, stockController.generateAndSaveItemImage);
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
router.post('/packs', index_js_1.requireAdmin, stockPacksController.createPack);
// Update pack (admin only)
router.put('/packs/:id', index_js_1.requireAdmin, stockPacksController.updatePack);
// Delete pack (admin only)
router.delete('/packs/:id', index_js_1.requireAdmin, stockPacksController.deletePack);
// Add item to pack (admin only)
router.post('/packs/:id/items', index_js_1.requireAdmin, stockPacksController.addPackItem);
// Remove item from pack (admin only)
router.delete('/packs/:id/items/:itemId', index_js_1.requireAdmin, stockPacksController.removePackItem);
exports.default = router;
//# sourceMappingURL=stock.routes.js.map