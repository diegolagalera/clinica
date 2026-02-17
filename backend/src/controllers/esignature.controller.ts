/**
 * E-Signature Controller
 * REST endpoints for managing document templates and signing workflows.
 */
import { Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as esignatureService from '../services/esignature.service.js';
import * as signnowService from '../services/signnow.service.js';
import { success } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';
import type { Request } from 'express';

// ─── Template Endpoints ──────────────────────────────────────────────────────

/**
 * GET /esignature/templates
 * List all document templates for the clinic
 */
export const getTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templates = await esignatureService.getTemplates(req.db!, req.tenantContext);
    res.json(success(templates));
});

/**
 * POST /esignature/templates
 * Upload a new document template (PDF file required)
 */
export const createTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const file = req.file;
    if (!file) {
        throw new BadRequestError('Se requiere un archivo PDF');
    }

    const { name, description, category } = req.body;
    if (!name) {
        throw new BadRequestError('Se requiere un nombre para la plantilla');
    }

    const clinicId = req.tenantContext.clinicId;
    if (!clinicId) {
        throw new BadRequestError('Se requiere contexto de clínica');
    }

    const template = await esignatureService.createTemplate(
        req.db!,
        {
            clinicId,
            name,
            description,
            category: category || 'OTHER',
            createdById: req.user!.userId,
            file: {
                buffer: file.buffer,
                originalname: file.originalname,
                mimetype: file.mimetype,
            },
        },
        req.tenantContext,
        req.user?.tenantSlug
    );

    res.status(201).json(success(template));
});

/**
 * GET /esignature/templates/:id/preview
 * Download template PDF from SignNow for preview
 */
export const getTemplatePreview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const { buffer, filename } = await esignatureService.getTemplatePreviewPdf(
        req.db!,
        id!,
        req.tenantContext
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
});

/**
 * GET /esignature/templates/:id/editor
 * Generate embedded editor URL for configuring template fields
 */
export const getTemplateEditor = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Derive the origin from the request so the editor redirects back to the correct tenant subdomain
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const requestOrigin = `${protocol}://${host}`;

    const result = await esignatureService.getTemplateEditorUrl(
        req.db!,
        id!,
        req.tenantContext,
        requestOrigin
    );

    res.json(success(result));
});

/**
 * GET /esignature/templates/editor-callback
 * Handle redirect from SignNow embedded editor (marks template as configured)
 */
export const handleEditorCallback = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { templateId } = req.query;

    if (!templateId || typeof templateId !== 'string') {
        // Redirect to frontend with error
        res.redirect('/clinic/patients?editor=error');
        return;
    }

    await esignatureService.handleEditorCallback(req.db!, templateId);

    // Redirect to frontend with success indicator
    res.redirect(`/clinic/patients?editor=success&templateId=${templateId}`);
});

/**
 * GET /esignature/templates/:id/fields
 * Get fields from the SignNow template for mapping
 */
export const getTemplateFields = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const result = await esignatureService.getTemplateFields(
        req.db!,
        id!,
        req.tenantContext
    );

    res.json(success(result));
});

/**
 * PUT /esignature/templates/:id/field-mappings
 * Save field-to-patient-data mappings for a template
 */
export const saveFieldMappings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { mappings } = req.body;

    if (!Array.isArray(mappings)) {
        throw new BadRequestError('Se requiere un array de mappings');
    }

    await esignatureService.saveFieldMappings(
        req.db!,
        id!,
        mappings,
        req.tenantContext
    );

    res.json(success({ saved: true }));
});

/**
 * DELETE /esignature/templates/:id
 * Deactivate a template (soft delete)
 */
export const deleteTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await esignatureService.deactivateTemplate(req.db!, id!, req.tenantContext);
    res.json(success({ deleted: true }));
});

// ─── Signing Document Endpoints ──────────────────────────────────────────────

/**
 * GET /esignature/documents/patient/:patientId
 * List all signing documents for a patient
 */
export const getPatientDocuments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const documents = await esignatureService.getPatientDocuments(req.db!, patientId!, req.tenantContext);
    res.json(success(documents));
});

/**
 * POST /esignature/documents
 * Create a new signing document from a template
 */
export const createSigningDocument = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, templateId, signingMethod, emailSubject, emailMessage } = req.body;

    if (!patientId || !templateId) {
        throw new BadRequestError('Se requiere patientId y templateId');
    }

    const clinicId = req.tenantContext.clinicId;
    if (!clinicId) {
        throw new BadRequestError('Se requiere contexto de clínica');
    }

    // Derive the origin from the request for webhook URL (e.g. https://api.cuspia.com)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const requestOrigin = `${protocol}://${host}`;

    const document = await esignatureService.createSigningDocument(
        req.db!,
        {
            clinicId,
            patientId,
            templateId,
            signingMethod: signingMethod || 'EMBEDDED',
            sentById: req.user!.userId,
            emailSubject,
            emailMessage,
        },
        req.tenantContext,
        requestOrigin
    );

    res.status(201).json(success(document));
});

/**
 * GET /esignature/documents/:id/signing-url
 * Get embedded signing URL for in-clinic tablet signing
 */
export const getSigningUrl = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const result = await esignatureService.getEmbeddedSigningUrl(req.db!, id!, req.tenantContext);
    res.json(success(result));
});

/**
 * GET /esignature/documents/:id/status
 * Check signing status (polls SignNow if needed)
 */
export const getDocumentStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const result = await esignatureService.checkAndUpdateStatus(
        req.db!,
        id!,
        req.tenantContext,
        req.user?.tenantSlug
    );
    res.json(success(result));
});

/**
 * GET /esignature/documents/:id/download
 * Download the signed PDF
 */
export const downloadSignedPdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { stream, contentType, filename } = await esignatureService.downloadSignedPdf(
        req.db!,
        id!,
        req.tenantContext,
        req.user?.tenantSlug
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
});

/**
 * GET /esignature/config/status
 * Check if SignNow is properly configured
 */
export const getConfigStatus = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json(success({
        configured: signnowService.checkConfiguration(),
    }));
});

/**
 * GET /esignature/patient-data-keys
 * Get available patient data keys for the field mapping UI
 */
export const getPatientDataKeys = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const keys = esignatureService.getPatientDataKeys();
    res.json(success(keys));
});

/**
 * POST /esignature/webhook/signnow
 * SignNow webhook callback (public endpoint, no auth required)
 * Receives document completion events from SignNow.
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;

    // Extract document_id from the webhook payload
    // SignNow sends: { meta: { event, ... }, content: { document_id, ... } }
    const documentId = payload?.content?.document_id || payload?.document_id;
    const event = payload?.meta?.event || payload?.event;

    console.log(`[ESignature Webhook] Received event: ${event} for document: ${documentId}`);

    if (documentId) {
        // Use a minimal db connection for webhook processing
        // The webhook handler in the service will find the right tenant
        await esignatureService.handleWebhook(
            (req as AuthenticatedRequest).db!,
            { document_id: documentId, event },
            undefined
        );
    }

    res.status(200).json({ status: 'ok' });
});
