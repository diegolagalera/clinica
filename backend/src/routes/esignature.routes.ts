/**
 * E-Signature Routes
 * Mounts all e-signature related endpoints under /esignature
 */
import { Router } from 'express';
import multer from 'multer';
import * as esignatureController from '../controllers/esignature.controller.js';
import { authenticate, requireStaff, tenantContext } from '../middleware/index.js';

const router = Router();

// ─── Multer Config for PDF uploads ───────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB max (PDFs can be larger than images)
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF o Word'));
        }
    },
});

// ─── Public Routes (no auth required) ────────────────────────────────────────

// SignNow webhook callback (must be before auth middleware)
router.post('/webhook/signnow', esignatureController.handleWebhook);

// Editor callback redirect from SignNow (public — resolves tenant DB from query slug)
router.get('/templates/editor-callback', esignatureController.handleEditorCallback);

// ─── Protected Routes (require auth + staff + tenant) ────────────────────────
router.use(authenticate);
router.use(requireStaff);
router.use(tenantContext);

// Configuration status
router.get('/config/status', esignatureController.getConfigStatus);

// Template management
router.get('/templates', esignatureController.getTemplates);
router.post('/templates', upload.single('file'), esignatureController.createTemplate);
router.get('/templates/:id/preview', esignatureController.getTemplatePreview);
router.get('/templates/:id/editor', esignatureController.getTemplateEditor);
router.get('/templates/:id/fields', esignatureController.getTemplateFields);
router.put('/templates/:id/field-mappings', esignatureController.saveFieldMappings);
router.delete('/templates/:id', esignatureController.deleteTemplate);

// Patient data keys (for field mapping UI)
router.get('/patient-data-keys', esignatureController.getPatientDataKeys);

// Signing documents
router.get('/documents/patient/:patientId', esignatureController.getPatientDocuments);
router.post('/documents', esignatureController.createSigningDocument);
router.get('/documents/:id/signing-url', esignatureController.getSigningUrl);
router.get('/documents/:id/status', esignatureController.getDocumentStatus);
router.get('/documents/:id/download', esignatureController.downloadSignedPdf);
router.delete('/documents/:id', esignatureController.cancelSigningDocument);

export default router;
