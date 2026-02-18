/**
 * E-Signature Service
 * Business logic layer for managing document templates and signing workflows.
 * Orchestrates between our DB, SignNow API, and S3 storage.
 */
import { eq, desc, and } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import type { TenantContext } from '../types/index.js';
import {
    documentTemplates,
    signingDocuments,
    patients,
    users,
} from '../db/schema.js';
import * as signnowService from './signnow.service.js';
import * as storage from './storage.service.js';
import { BadRequestError, NotFoundError, AppError } from '../utils/errors.js';


// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldMapping {
    signnowFieldName: string;  // Field name in SignNow template
    patientDataKey: string;    // Key from patient record (e.g. 'firstName', 'idNumber')
    label: string;             // Human-readable label
}

// Map of patient data keys to their accessor functions
const PATIENT_DATA_KEYS: Record<string, { label: string; getValue: (patient: Record<string, unknown>) => string }> = {
    fullName: {
        label: 'Nombre completo',
        getValue: (p) => `${p.firstName || ''} ${p.lastName || ''}`.trim(),
    },
    firstName: {
        label: 'Nombre',
        getValue: (p) => String(p.firstName || ''),
    },
    lastName: {
        label: 'Apellidos',
        getValue: (p) => String(p.lastName || ''),
    },
    idNumber: {
        label: 'DNI/NIE',
        getValue: (p) => String(p.idNumber || ''),
    },
    email: {
        label: 'Email',
        getValue: (p) => String(p.email || ''),
    },
    phone: {
        label: 'Teléfono',
        getValue: (p) => String(p.phone || ''),
    },
    dateOfBirth: {
        label: 'Fecha de nacimiento',
        getValue: (p) => p.dateOfBirth ? new Date(String(p.dateOfBirth)).toLocaleDateString('es-ES') : '',
    },
    currentDate: {
        label: 'Fecha actual',
        getValue: () => new Date().toLocaleDateString('es-ES'),
    },
    address: {
        label: 'Dirección',
        getValue: (p) => String(p.address || ''),
    },
};

// ─── Template Management ─────────────────────────────────────────────────────

/**
 * Get all document templates for a clinic
 */
export const getTemplates = async (
    db: Database,
    tenantContext: TenantContext
): Promise<typeof documentTemplates.$inferSelect[]> => {
    const clinicId = tenantContext.clinicId;
    if (!clinicId) throw new BadRequestError('Se requiere contexto de clínica');

    const results = await db
        .select()
        .from(documentTemplates)
        .where(
            and(
                eq(documentTemplates.clinicId, clinicId),
                eq(documentTemplates.isActive, true)
            )
        )
        .orderBy(desc(documentTemplates.createdAt));

    return results;
};

/**
 * Get a single template by ID
 */
export const getTemplateById = async (
    db: Database,
    templateId: string,
    tenantContext: TenantContext
): Promise<typeof documentTemplates.$inferSelect | undefined> => {
    const clinicId = tenantContext.clinicId;
    if (!clinicId) throw new BadRequestError('Se requiere contexto de clínica');

    const [template] = await db
        .select()
        .from(documentTemplates)
        .where(
            and(
                eq(documentTemplates.id, templateId),
                eq(documentTemplates.clinicId, clinicId)
            )
        )
        .limit(1);

    return template;
};

/**
 * Create a new document template
 * 1. Upload PDF to SignNow
 * 2. Create a template from it in SignNow
 * 3. Save backup to S3
 * 4. Save metadata to DB
 */
export const createTemplate = async (
    db: Database,
    data: {
        clinicId: string;
        name: string;
        description?: string;
        category: string;
        createdById: string;
        file: {
            buffer: Buffer;
            originalname: string;
            mimetype: string;
        };
    },
    tenantContext: TenantContext,
    tenantSlug?: string
): Promise<typeof documentTemplates.$inferSelect> => {
    const { clinicId, name, description, category, createdById, file } = data;

    let signnowTemplateId: string | null = null;
    let fileStorageKey: string | null = null;

    // Step 1: Upload to SignNow (if configured)
    if (signnowService.checkConfiguration()) {
        try {
            const doc = await signnowService.uploadDocument(file.buffer, file.originalname);
            console.log('[ESignature] Document uploaded to SignNow:', doc.id);
            const template = await signnowService.createTemplate(doc.id);
            signnowTemplateId = template.id;
            console.log('[ESignature] Template created in SignNow:', template.id);
        } catch (err) {
            console.error('[ESignature] SignNow upload failed:', err);
            throw new BadRequestError(
                `Error al subir a SignNow: ${err instanceof Error ? err.message : 'Error desconocido'}. Verifica las credenciales SIGNNOW_* en el entorno.`
            );
        }
    } else {
        console.warn('[ESignature] SignNow not configured, template will be created without SignNow ID');
    }

    // Step 2: Backup to S3
    try {
        const key = storage.buildKey(
            '', // orgId not used in key
            clinicId,
            'esignature',
            'templates',
            `${Date.now()}_${file.originalname}`
        );
        await storage.uploadFile(key, file.buffer, file.mimetype, tenantSlug);
        fileStorageKey = key;
    } catch (err) {
        console.error('[ESignature] S3 backup failed:', err);
    }

    // Step 3: Save to DB
    const [result] = await db
        .insert(documentTemplates)
        .values({
            clinicId,
            name,
            description: description || null,
            category: category as any,
            signnowTemplateId,
            fileStorageKey,
            createdById,
        })
        .returning();

    return result!;
};

/**
 * Download template PDF from SignNow for preview
 */
export const getTemplatePreviewPdf = async (
    db: Database,
    templateId: string,
    tenantContext: TenantContext
): Promise<{ buffer: Buffer; filename: string }> => {
    const template = await getTemplateById(db, templateId, tenantContext);
    if (!template) throw new NotFoundError('Plantilla no encontrada');
    if (!template.signnowTemplateId) {
        throw new BadRequestError('La plantilla no tiene un documento asociado en SignNow');
    }

    const buffer = await signnowService.downloadSignedDocument(template.signnowTemplateId);
    return {
        buffer,
        filename: `${template.name || 'plantilla'}.pdf`,
    };
};

/**
 * Deactivate a template (soft delete)
 */
export const deactivateTemplate = async (
    db: Database,
    templateId: string,
    tenantContext: TenantContext
): Promise<void> => {
    const template = await getTemplateById(db, templateId, tenantContext);
    if (!template) throw new NotFoundError('Plantilla no encontrada');

    await db
        .update(documentTemplates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(documentTemplates.id, templateId));
};

/**
 * Get embedded editor URL for configuring template fields.
 * The admin opens this URL to visually place signature/text fields on the PDF.
 * Uses the requestOrigin (e.g. https://api.cuspia.com) for the redirect.
 */
export const getTemplateEditorUrl = async (
    db: Database,
    templateId: string,
    tenantContext: TenantContext,
    requestOrigin?: string,
    tenantSlug?: string
): Promise<{ url: string; templateId: string }> => {
    const template = await getTemplateById(db, templateId, tenantContext);
    if (!template) throw new NotFoundError('Plantilla no encontrada');
    if (!template.signnowTemplateId) {
        throw new BadRequestError('La plantilla no tiene un documento asociado en SignNow');
    }

    // Use the request origin for redirect (e.g. https://api.cuspia.com)
    const baseUrl = requestOrigin || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/v1/esignature/templates/editor-callback?templateId=${templateId}&slug=${tenantSlug || ''}`;

    const editorUrl = await signnowService.getEditorLink(template.signnowTemplateId, redirectUri);

    return { url: editorUrl, templateId };
};

/**
 * Handle editor callback — mark template as configured after admin saves fields.
 */
export const handleEditorCallback = async (
    db: Database,
    templateId: string
): Promise<void> => {
    await db
        .update(documentTemplates)
        .set({
            isConfigured: true,
            updatedAt: new Date(),
        })
        .where(eq(documentTemplates.id, templateId));

    console.log(`[ESignature] Template ${templateId} marked as configured after editor callback`);
};

/**
 * Get fields from the SignNow template for manual mapping.
 * Returns the fields placed in the editor + available patient data keys.
 */
export const getTemplateFields = async (
    db: Database,
    templateId: string,
    tenantContext: TenantContext
): Promise<{
    signnowFields: Array<{ id: string; name: string; label: string; type: string; page_number: number }>;
    patientDataKeys: Array<{ key: string; label: string }>;
    currentMappings: FieldMapping[];
}> => {
    const template = await getTemplateById(db, templateId, tenantContext);
    if (!template) throw new NotFoundError('Plantilla no encontrada');
    if (!template.signnowTemplateId) {
        throw new BadRequestError('La plantilla no tiene un documento asociado en SignNow');
    }

    // Fetch fields from SignNow
    const signnowFields = await signnowService.getDocumentFields(template.signnowTemplateId);

    // Available patient data keys
    const patientDataKeys = Object.entries(PATIENT_DATA_KEYS).map(([key, { label }]) => ({
        key,
        label,
    }));

    // Current mappings from DB
    const currentMappings = (template.fieldMappings || []) as FieldMapping[];

    return { signnowFields, patientDataKeys, currentMappings };
};

/**
 * Save field mappings for a template.
 * The admin manually maps SignNow text fields to patient data keys.
 */
export const saveFieldMappings = async (
    db: Database,
    templateId: string,
    mappings: FieldMapping[],
    tenantContext: TenantContext
): Promise<void> => {
    const template = await getTemplateById(db, templateId, tenantContext);
    if (!template) throw new NotFoundError('Plantilla no encontrada');

    await db
        .update(documentTemplates)
        .set({
            fieldMappings: mappings,
            isConfigured: true,
            updatedAt: new Date(),
        })
        .where(eq(documentTemplates.id, templateId));

    console.log(`[ESignature] Saved ${mappings.length} field mappings for template ${templateId}`);
};

/**
 * Get available patient data keys for the field mapping UI.
 */
export const getPatientDataKeys = (): Array<{ key: string; label: string }> => {
    return Object.entries(PATIENT_DATA_KEYS).map(([key, { label }]) => ({
        key,
        label,
    }));
};

// ─── Signing Documents ───────────────────────────────────────────────────────

/**
 * Get all signing documents for a patient
 */
export const getPatientDocuments = async (
    db: Database,
    patientId: string,
    tenantContext: TenantContext
): Promise<Array<Record<string, unknown>>> => {
    const clinicId = tenantContext.clinicId;
    if (!clinicId) throw new BadRequestError('Se requiere contexto de clínica');

    const results = await db
        .select({
            id: signingDocuments.id,
            name: signingDocuments.name,
            status: signingDocuments.status,
            signingMethod: signingDocuments.signingMethod,
            signedAt: signingDocuments.signedAt,
            emailSentTo: signingDocuments.emailSentTo,
            createdAt: signingDocuments.createdAt,
            templateName: documentTemplates.name,
            templateCategory: documentTemplates.category,
            sentByFirstName: users.firstName,
            sentByLastName: users.lastName,
        })
        .from(signingDocuments)
        .leftJoin(documentTemplates, eq(signingDocuments.templateId, documentTemplates.id))
        .leftJoin(users, eq(signingDocuments.sentById, users.id))
        .where(
            and(
                eq(signingDocuments.patientId, patientId),
                eq(signingDocuments.clinicId, clinicId)
            )
        )
        .orderBy(desc(signingDocuments.createdAt));

    return results;
};

/**
 * Create a signing document and initiate signing flow.
 * 1. Clone template in SignNow
 * 2. Pre-fill patient data using field mappings
 * 3. Create invite (embedded or email)
 * 4. Subscribe to webhook for status updates
 * 5. Save to DB
 */
export const createSigningDocument = async (
    db: Database,
    data: {
        clinicId: string;
        patientId: string;
        templateId: string;
        signingMethod: 'EMBEDDED' | 'EMAIL';
        sentById: string;
        emailSubject?: string;
        emailMessage?: string;
    },
    tenantContext: TenantContext,
    requestOrigin?: string,
    tenantSlug?: string
): Promise<typeof signingDocuments.$inferSelect> => {
    const { clinicId, patientId, templateId, signingMethod, sentById } = data;

    // Get template
    const template = await getTemplateById(db, templateId, tenantContext);
    if (!template) throw new NotFoundError('Plantilla no encontrada');

    // Get patient data for prefilling
    const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

    if (!patient) throw new NotFoundError('Paciente no encontrado');

    let signnowDocumentId: string | null = null;
    let emailSentTo: string | null = null;

    // Clone template in SignNow and set up signing
    if (signnowService.checkConfiguration() && template.signnowTemplateId) {
        try {
            const docName = `${template.name} - ${patient.firstName} ${patient.lastName} - ${new Date().toLocaleDateString('es-ES')}`;
            const doc = await signnowService.createDocumentFromTemplate(
                template.signnowTemplateId,
                docName
            );
            signnowDocumentId = doc.id;

            // Pre-fill patient data using field mappings from the template
            const fieldMappings = (template.fieldMappings || []) as FieldMapping[];
            console.log(`[ESignature] Field mappings from DB (${fieldMappings.length}):`, JSON.stringify(fieldMappings));
            if (fieldMappings.length > 0) {
                const prefillFields: Array<{ field_name: string; prefilled_text: string }> = [];

                for (const mapping of fieldMappings) {
                    if (!mapping.patientDataKey) continue; // skip unmapped fields
                    const dataKeyConfig = PATIENT_DATA_KEYS[mapping.patientDataKey];
                    if (dataKeyConfig) {
                        const value = dataKeyConfig.getValue(patient as unknown as Record<string, unknown>);
                        if (value) {
                            prefillFields.push({
                                field_name: mapping.signnowFieldName,
                                prefilled_text: value,
                            });
                        }
                    }
                }

                console.log(`[ESignature] Prefill fields to send (${prefillFields.length}):`, JSON.stringify(prefillFields));
                if (prefillFields.length > 0) {
                    await signnowService.prefillDocumentFields(doc.id, prefillFields);
                }
            }

            // Send email invite if method is EMAIL
            if (signingMethod === 'EMAIL') {
                if (!patient.email) {
                    throw new BadRequestError('El paciente no tiene email registrado');
                }
                emailSentTo = patient.email;
                await signnowService.sendEmailInvite(
                    doc.id,
                    patient.email,
                    data.emailSubject || `Documento para firmar: ${template.name}`,
                    data.emailMessage || `Estimado/a ${patient.firstName}, le enviamos el documento "${template.name}" para su firma electrónica.`
                );
            }

            // Subscribe to webhook for document completion (best-effort)
            // Include tenantSlug in URL for direct DB resolution in multi-tenant setup
            if (requestOrigin) {
                try {
                    const slugParam = tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : '';
                    const webhookUrl = `${requestOrigin}/api/v1/esignature/webhook/signnow${slugParam}`;
                    await signnowService.subscribeToWebhook(
                        signnowDocumentId,
                        webhookUrl,
                        'document.complete'
                    );
                } catch (webhookErr) {
                    console.warn('[ESignature] Webhook subscription failed (non-critical):', webhookErr);
                }
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            console.error('[ESignature] SignNow document creation failed:', err);
            throw new BadRequestError('Error al preparar el documento para firma');
        }
    }

    // Save to DB
    const [result] = await db
        .insert(signingDocuments)
        .values({
            clinicId,
            patientId,
            templateId,
            name: template.name,
            signnowDocumentId,
            status: signingMethod === 'EMAIL' ? 'PENDING' : 'DRAFT',
            signingMethod: signingMethod as any,
            sentById,
            emailSentTo,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        })
        .returning();

    return result!;
};

/**
 * Get embedded signing URL for in-clinic tablet signing
 */
export const getEmbeddedSigningUrl = async (
    db: Database,
    signingDocumentId: string,
    tenantContext: TenantContext
): Promise<{ url: string }> => {
    const clinicId = tenantContext.clinicId;
    if (!clinicId) throw new BadRequestError('Se requiere contexto de clínica');

    const [doc] = await db
        .select()
        .from(signingDocuments)
        .where(
            and(
                eq(signingDocuments.id, signingDocumentId),
                eq(signingDocuments.clinicId, clinicId)
            )
        )
        .limit(1);

    if (!doc) throw new NotFoundError('Documento no encontrado');
    if (!doc.signnowDocumentId) {
        throw new BadRequestError('El documento no tiene un ID de SignNow asociado');
    }
    if (doc.status === 'SIGNED') {
        throw new BadRequestError('El documento ya ha sido firmado');
    }

    // Get patient email for the invite
    const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, doc.patientId))
        .limit(1);

    const signerEmail = patient?.email || 'signer@clinic.local';

    const url = await signnowService.createEmbeddedInvite(doc.signnowDocumentId, signerEmail);

    // Update status
    await db
        .update(signingDocuments)
        .set({ status: 'PENDING', updatedAt: new Date() })
        .where(eq(signingDocuments.id, signingDocumentId));

    return { url };
};

/**
 * Check signing status and update if signed
 */
export const checkAndUpdateStatus = async (
    db: Database,
    signingDocumentId: string,
    tenantContext: TenantContext,
    tenantSlug?: string
): Promise<{ status: string; signed: boolean }> => {
    const clinicId = tenantContext.clinicId;
    if (!clinicId) throw new BadRequestError('Se requiere contexto de clínica');

    const [doc] = await db
        .select()
        .from(signingDocuments)
        .where(
            and(
                eq(signingDocuments.id, signingDocumentId),
                eq(signingDocuments.clinicId, clinicId)
            )
        )
        .limit(1);

    if (!doc) throw new NotFoundError('Documento no encontrado');
    if (!doc.signnowDocumentId) {
        return { status: doc.status, signed: doc.status === 'SIGNED' };
    }

    // Already signed? No need to check again
    if (doc.status === 'SIGNED') {
        return { status: 'SIGNED', signed: true };
    }

    // Check with SignNow
    const snStatus = await signnowService.getDocumentStatus(doc.signnowDocumentId);

    if (snStatus.signed) {
        // Download signed PDF and store in S3
        let signedPdfStorageKey: string | null = null;
        try {
            const pdfBuffer = await signnowService.downloadSignedDocument(doc.signnowDocumentId);
            const key = storage.buildKey(
                '',
                clinicId,
                'esignature',
                'signed',
                `${doc.id}_signed.pdf`
            );
            await storage.uploadFile(key, pdfBuffer, 'application/pdf', tenantSlug);
            signedPdfStorageKey = key;
        } catch (err) {
            console.error('[ESignature] Failed to download/store signed PDF:', err);
        }

        // Update DB
        await db
            .update(signingDocuments)
            .set({
                status: 'SIGNED',
                signedAt: new Date(),
                signedPdfStorageKey,
                updatedAt: new Date(),
            })
            .where(eq(signingDocuments.id, signingDocumentId));

        return { status: 'SIGNED', signed: true };
    }

    return { status: doc.status, signed: false };
};

/**
 * Download signed PDF from S3
 */
export const downloadSignedPdf = async (
    db: Database,
    signingDocumentId: string,
    tenantContext: TenantContext,
    tenantSlug?: string
): Promise<{ stream: import('stream').Readable; contentType: string; filename: string }> => {
    const clinicId = tenantContext.clinicId;
    if (!clinicId) throw new BadRequestError('Se requiere contexto de clínica');

    const [doc] = await db
        .select()
        .from(signingDocuments)
        .where(
            and(
                eq(signingDocuments.id, signingDocumentId),
                eq(signingDocuments.clinicId, clinicId)
            )
        )
        .limit(1);

    if (!doc) throw new NotFoundError('Documento no encontrado');
    if (!doc.signedPdfStorageKey) {
        throw new BadRequestError('El documento firmado no está disponible para descarga');
    }

    const { stream, contentType } = await storage.getFileStream(doc.signedPdfStorageKey, tenantSlug);

    return {
        stream,
        contentType: contentType || 'application/pdf',
        filename: `${doc.name}_firmado.pdf`,
    };
};

/**
 * Handle SignNow webhook callback (document signed)
 * Returns true if the document was found and processed in this tenant DB.
 */
export const handleWebhook = async (
    db: Database,
    payload: { document_id?: string; event?: string },
    tenantSlug?: string
): Promise<boolean> => {
    if (!payload.document_id) return false;

    // Find the signing document by SignNow document ID
    const [doc] = await db
        .select()
        .from(signingDocuments)
        .where(eq(signingDocuments.signnowDocumentId, payload.document_id))
        .limit(1);

    if (!doc) return false; // Not in this tenant

    if (doc.status === 'SIGNED') return true; // Already processed

    // Download signed PDF
    let signedPdfStorageKey: string | null = null;
    try {
        const pdfBuffer = await signnowService.downloadSignedDocument(payload.document_id);
        const key = storage.buildKey(
            '',
            doc.clinicId,
            'esignature',
            'signed',
            `${doc.id}_signed.pdf`
        );
        await storage.uploadFile(key, pdfBuffer, 'application/pdf', tenantSlug);
        signedPdfStorageKey = key;
    } catch (err) {
        console.error('[ESignature] Webhook: failed to download signed PDF:', err);
    }

    // Update status
    await db
        .update(signingDocuments)
        .set({
            status: 'SIGNED',
            signedAt: new Date(),
            signedPdfStorageKey,
            updatedAt: new Date(),
        })
        .where(eq(signingDocuments.id, doc.id));

    console.log(`[ESignature] Document ${doc.id} marked as SIGNED via webhook`);

    // Push real-time update to frontend via WebSocket
    try {
        const { emitToClinic } = await import('../websocket.js');
        emitToClinic(doc.clinicId, 'esignature:document-signed', {
            documentId: doc.id,
            patientId: doc.patientId,
            status: 'SIGNED',
        });
        console.log(`[ESignature] WebSocket notification sent to clinic ${doc.clinicId}`);
    } catch (wsErr) {
        console.warn('[ESignature] WebSocket emit failed (non-critical):', wsErr);
    }

    return true;
};
