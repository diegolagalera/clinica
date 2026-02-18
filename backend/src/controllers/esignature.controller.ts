/**
 * E-Signature Controller
 * REST endpoints for managing document templates and signing workflows.
 */
import { Response, Request } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as esignatureService from '../services/esignature.service.js';
import * as signnowService from '../services/signnow.service.js';
import { success } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';
import { tenantManager } from '../db/tenant-manager.js';
import { config } from '../config/env.js';

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

    // Derive the origin from the request so the editor redirects back to the correct API host
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const requestOrigin = `${protocol}://${host}`;

    const result = await esignatureService.getTemplateEditorUrl(
        req.db!,
        id!,
        req.tenantContext,
        requestOrigin,
        req.user?.tenantSlug
    );

    res.json(success(result));
});

/**
 * GET /esignature/templates/editor-callback
 * Handle redirect from SignNow embedded editor.
 * This is a PUBLIC endpoint (no auth) — resolves tenant DB from query slug.
 * Marks the template as configured and redirects user to the frontend.
 */
export const handleEditorCallback = asyncHandler(async (req: Request, res: Response) => {
    const { templateId, slug } = req.query;

    if (!templateId || typeof templateId !== 'string') {
        res.status(400).send('Missing templateId parameter');
        return;
    }

    if (!slug || typeof slug !== 'string') {
        res.status(400).send('Missing tenant slug parameter');
        return;
    }

    try {
        // Resolve tenant DB directly (no auth middleware needed)
        const db = await tenantManager.getConnection(slug);

        await esignatureService.handleEditorCallback(db, templateId);

        // Redirect to the tenant's frontend
        const frontendBaseUrl = config.frontend.url || 'http://localhost:5173';
        // Replace the domain with the tenant's subdomain
        // e.g. https://app.cuspia.com → https://mi-clinica.cuspia.com
        let redirectUrl: string;
        try {
            const url = new URL(frontendBaseUrl);
            const hostParts = url.hostname.split('.');
            if (hostParts.length >= 2) {
                // Replace the first subdomain (e.g. 'app') with the tenant slug
                hostParts[0] = slug;
                url.hostname = hostParts.join('.');
            }
            url.pathname = '/';
            url.searchParams.set('editor', 'success');
            redirectUrl = url.toString();
        } catch {
            redirectUrl = `${frontendBaseUrl}/?editor=success`;
        }

        res.redirect(redirectUrl);
    } catch (err) {
        console.error('[ESignature] Editor callback error:', err);
        res.status(500).send('Error processing editor callback. Please close this tab and try again.');
    }
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
        requestOrigin,
        req.user?.tenantSlug
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

    // ── Comprehensive logging for webhook diagnosis ──
    console.log('[ESignature Webhook] ═══ INCOMING WEBHOOK ═══');
    console.log('[ESignature Webhook] Headers:', JSON.stringify({
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'x-signnow-signature': req.headers['x-signnow-signature'] || 'none',
    }));
    console.log('[ESignature Webhook] Query params:', JSON.stringify(req.query));
    console.log('[ESignature Webhook] Full payload:', JSON.stringify(payload, null, 2));

    // Extract document_id from the webhook payload
    // SignNow sends: { meta: { event, ... }, content: { document_id, ... } }
    const documentId = payload?.content?.document_id || payload?.document_id;
    const event = payload?.meta?.event || payload?.event;

    console.log(`[ESignature Webhook] Received event: ${event} for document: ${documentId}`);

    if (documentId) {
        // Extract tenant slug from the query param (embedded during subscription)
        const tenantSlug = req.query.tenant as string | undefined;

        if (tenantSlug) {
            // Direct DB resolution — the clean multi-tenant path
            try {
                const db = await tenantManager.getConnection(tenantSlug);
                await esignatureService.handleWebhook(db, { document_id: documentId, event }, tenantSlug);
                console.log(`[ESignature Webhook] Processed in tenant: ${tenantSlug}`);
            } catch (err) {
                console.error(`[ESignature Webhook] Error processing in tenant ${tenantSlug}:`, err);
            }
        } else {
            // Fallback: iterate active tenant connections (for old subscriptions without slug)
            const stats = tenantManager.getConnectionStats();
            for (const { slug } of stats) {
                try {
                    const db = await tenantManager.getConnection(slug);
                    const handled = await esignatureService.handleWebhook(
                        db,
                        { document_id: documentId, event },
                        slug
                    );
                    if (handled) break;
                } catch (err) {
                    console.error(`[ESignature Webhook] Error processing in tenant ${slug}:`, err);
                }
            }
        }
    }

    res.status(200).json({ status: 'ok' });
});
