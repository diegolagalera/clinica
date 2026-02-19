/**
 * E-Signature Service
 * Business logic layer for managing document templates and signing workflows.
 * Orchestrates between our DB, SignNow API, and S3 storage.
 */
import { eq, desc, and, ne, inArray } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import type { TenantContext } from '../types/index.js';
import {
    documentTemplates,
    signingDocuments,
    patients,
    users,
    clinics,
} from '../db/schema.js';
import * as signnowService from './signnow.service.js';
import * as storage from './storage.service.js';
import { sendEmail } from './email.service.js';
import { logger } from '../utils/logger.js';
import { BadRequestError, NotFoundError, AppError } from '../utils/errors.js';

/**
 * Helper: Download signed PDF from SignNow and upload to MinIO with retry.
 * Retries up to 3 times with exponential backoff (2s, 4s, 8s).
 * Returns the storage key on success, or null if all retries fail.
 */
const downloadAndStoreSignedPdf = async (
    signnowDocumentId: string,
    docId: string,
    clinicId: string,
    tenantSlug?: string
): Promise<string | null> => {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const pdfBuffer = await signnowService.downloadSignedDocument(signnowDocumentId);
            const key = storage.buildKey(
                '',
                clinicId,
                'esignature',
                'signed',
                `${docId}_signed.pdf`
            );
            await storage.uploadFile(key, pdfBuffer, 'application/pdf', tenantSlug);
            return key;
        } catch (err: any) {
            const isLastAttempt = attempt === MAX_RETRIES;
            if (isLastAttempt) {
                console.error(
                    `[ESignature] Failed to download/store signed PDF after ${MAX_RETRIES} attempts:`,
                    err.message
                );
                return null;
            }
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(
                `[ESignature] PDF upload attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delay}ms...`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
};

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
                eq(signingDocuments.clinicId, clinicId),
                ne(signingDocuments.status, 'CANCELLED')
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
        // Download signed PDF with retry (3 attempts, exponential backoff)
        const signedPdfStorageKey = await downloadAndStoreSignedPdf(
            doc.signnowDocumentId,
            doc.id,
            clinicId,
            tenantSlug
        );

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

        // Send signed PDF to patient via email (fire-and-forget)
        // Only for EMBEDDED signing — EMAIL signing is handled by SignNow
        if (signedPdfStorageKey && doc.signingMethod === 'EMBEDDED') {
            sendSignedDocumentToPatient(db, doc, signedPdfStorageKey, clinicId, tenantSlug)
                .catch(err => logger.error('[E-Signature] Failed to email signed document to patient', { error: err.message, docId: doc.id }));
        }

        return { status: 'SIGNED', signed: true };
    }

    return { status: doc.status, signed: false };
};

/**
 * Send the signed PDF to the patient via email (clinic SMTP).
 * Called automatically after in-clinic (embedded) signing is detected.
 * Non-blocking and non-throwing — logs errors gracefully.
 */
const sendSignedDocumentToPatient = async (
    db: Database,
    doc: { id: string; patientId: string; name: string },
    signedPdfStorageKey: string,
    clinicId: string,
    tenantSlug?: string
): Promise<void> => {
    try {
        // 1. Get patient info
        const [patient] = await db
            .select({ email: patients.email, firstName: patients.firstName, lastName: patients.lastName })
            .from(patients)
            .where(eq(patients.id, doc.patientId))
            .limit(1);

        if (!patient?.email) {
            logger.info(`[E-Signature] Patient has no email, skipping signed document delivery`, { docId: doc.id });
            return;
        }

        // 2. Get clinic name for branding
        const [clinic] = await db
            .select({ name: clinics.name })
            .from(clinics)
            .where(eq(clinics.id, clinicId))
            .limit(1);

        const clinicName = clinic?.name || 'La Clínica';
        const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Paciente';
        const documentName = doc.name || 'Documento';

        // 3. Download signed PDF from MinIO
        const pdfBuffer = await storage.getFileBuffer(signedPdfStorageKey, tenantSlug);

        // 4. Build professional email
        const signedDate = new Date().toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

        const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px 16px 0 0; padding: 32px 40px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">
                ✅ Documento Firmado
            </h1>
            <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">
                ${clinicName}
            </p>
        </div>

        <!-- Body -->
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Estimado/a <strong>${patientName}</strong>,
            </p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Le informamos que su documento ha sido firmado correctamente el <strong>${signedDate}</strong>. 
                Adjunto encontrará una copia del documento firmado para su archivo personal.
            </p>

            <!-- Document info card -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <div style="display: flex; align-items: center;">
                    <div style="background: #dc2626; border-radius: 8px; width: 40px; height: 40px; text-align: center; line-height: 40px; margin-right: 16px; flex-shrink: 0;">
                        <span style="color: white; font-size: 16px; font-weight: bold;">PDF</span>
                    </div>
                    <div>
                        <p style="color: #0f172a; font-size: 14px; font-weight: 600; margin: 0;">
                            ${documentName}
                        </p>
                        <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">
                            Firmado el ${signedDate}
                        </p>
                    </div>
                </div>
            </div>

            <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
                Este documento tiene plena validez legal. Conserve esta copia para sus registros.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                Este correo ha sido enviado automáticamente por <strong>${clinicName}</strong>.
                <br>Si tiene alguna duda, contacte directamente con la clínica.
            </p>
        </div>

        <!-- Footer -->
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 16px 0 0;">
            © ${new Date().getFullYear()} ${clinicName}. Todos los derechos reservados.
        </p>
    </div>
</body>
</html>`;

        // 5. Send email with attachment
        const result = await sendEmail(db, clinicId, {
            to: patient.email,
            subject: `📄 Documento firmado: ${documentName} — ${clinicName}`,
            html: htmlContent,
            attachments: [
                {
                    filename: `${documentName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, '')}_firmado.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf',
                },
            ],
        });

        if (result.success) {
            logger.info(`[E-Signature] Signed document emailed to patient`, {
                docId: doc.id,
                patientEmail: patient.email,
                messageId: result.messageId,
            });
        } else {
            logger.warn(`[E-Signature] Could not email signed document to patient`, {
                docId: doc.id,
                patientEmail: patient.email,
                error: result.error,
            });
        }
    } catch (error: any) {
        logger.error(`[E-Signature] Error sending signed document email`, {
            docId: doc.id,
            error: error.message,
        });
    }
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
 * Cancel a signing document.
 * - DRAFT/PENDING: cancels invites in SignNow, deletes the SignNow document, marks as CANCELLED.
 * - SIGNED: cannot cancel — throws error.
 * - Already CANCELLED/DECLINED/EXPIRED: no-op.
 */
export const cancelSigningDocument = async (
    db: Database,
    signingDocumentId: string,
    tenantContext: TenantContext
): Promise<void> => {
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

    // Already in a terminal state — no-op
    if (['CANCELLED', 'DECLINED', 'EXPIRED'].includes(doc.status)) {
        return;
    }

    // Cannot cancel a signed document
    if (doc.status === 'SIGNED') {
        throw new BadRequestError('No se puede cancelar un documento ya firmado');
    }

    // Clean up in SignNow
    if (doc.signnowDocumentId) {
        try {
            // Cancel active invites first (so the signing link stops working)
            if (doc.status === 'PENDING') {
                await signnowService.cancelInvites(doc.signnowDocumentId);
            }
            // Delete the document from SignNow
            await signnowService.deleteDocument(doc.signnowDocumentId);
        } catch (err: any) {
            // Non-critical: document might already be deleted in SignNow
            console.warn(`[ESignature] SignNow cleanup warning for doc ${doc.id}:`, err.message);
        }
    }

    // Update status in DB
    await db
        .update(signingDocuments)
        .set({
            status: 'CANCELLED',
            updatedAt: new Date(),
        })
        .where(eq(signingDocuments.id, doc.id));

    console.log(`[ESignature] Document ${doc.id} cancelled (was ${doc.status})`);
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

    // Download signed PDF with retry (3 attempts, exponential backoff)
    const signedPdfStorageKey = await downloadAndStoreSignedPdf(
        payload.document_id,
        doc.id,
        doc.clinicId,
        tenantSlug
    );

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

/**
 * Email multiple signed documents to a patient in ONE email.
 * Downloads all PDFs from MinIO and attaches them.
 */
export const emailSignedDocumentsToPatient = async (
    db: Database,
    documentIds: string[],
    patientId: string,
    tenantContext: TenantContext,
    tenantSlug?: string
): Promise<{ success: boolean; sentCount: number; error?: string }> => {
    const clinicId = tenantContext.clinicId;
    if (!clinicId) throw new BadRequestError('Se requiere contexto de clínica');

    if (!documentIds.length) {
        throw new BadRequestError('Selecciona al menos un documento');
    }

    // 1. Fetch all requested documents
    const docs = await db
        .select()
        .from(signingDocuments)
        .where(
            and(
                inArray(signingDocuments.id, documentIds),
                eq(signingDocuments.clinicId, clinicId),
                eq(signingDocuments.patientId, patientId),
                eq(signingDocuments.status, 'SIGNED')
            )
        );

    if (docs.length === 0) {
        throw new BadRequestError('No se encontraron documentos firmados válidos');
    }

    // 2. Get patient info
    const [patient] = await db
        .select({ email: patients.email, firstName: patients.firstName, lastName: patients.lastName })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

    if (!patient?.email) {
        throw new BadRequestError('El paciente no tiene dirección de correo electrónico');
    }

    // 3. Get clinic name
    const [clinic] = await db
        .select({ name: clinics.name })
        .from(clinics)
        .where(eq(clinics.id, clinicId))
        .limit(1);

    const clinicName = clinic?.name || 'La Clínica';
    const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Paciente';

    // 4. Download all PDFs from MinIO
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    for (const doc of docs) {
        if (!doc.signedPdfStorageKey) continue;
        try {
            const buffer = await storage.getFileBuffer(doc.signedPdfStorageKey, tenantSlug);
            const safeName = (doc.name || 'Documento').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, '');
            attachments.push({
                filename: `${safeName}_firmado.pdf`,
                content: buffer,
                contentType: 'application/pdf',
            });
        } catch (err: any) {
            logger.warn(`[E-Signature] Could not download PDF for doc ${doc.id}`, { error: err.message });
        }
    }

    if (attachments.length === 0) {
        throw new BadRequestError('No se pudieron descargar los documentos firmados');
    }

    // 5. Build email
    const signedDate = new Date().toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const docListHtml = attachments.map(a => `
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center;">
                    <div style="background: #dc2626; border-radius: 6px; width: 32px; height: 32px; text-align: center; line-height: 32px; margin-right: 12px; flex-shrink: 0;">
                        <span style="color: white; font-size: 11px; font-weight: bold;">PDF</span>
                    </div>
                    <span style="color: #0f172a; font-size: 14px; font-weight: 500;">${a.filename}</span>
                </div>
            </td>
        </tr>`).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px 16px 0 0; padding: 32px 40px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">
                📄 Documentos Firmados
            </h1>
            <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">
                ${clinicName}
            </p>
        </div>

        <!-- Body -->
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Estimado/a <strong>${patientName}</strong>,
            </p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Le enviamos una copia de ${attachments.length === 1 ? 'su documento firmado' : `sus ${attachments.length} documentos firmados`} para su archivo personal.
            </p>

            <!-- Document list -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 0 24px;">
                <div style="padding: 12px 16px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #475569; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${attachments.length} documento${attachments.length > 1 ? 's' : ''} adjunto${attachments.length > 1 ? 's' : ''}
                    </span>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    ${docListHtml}
                </table>
            </div>

            <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
                Estos documentos tienen plena validez legal. Conserve esta copia para sus registros.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                Este correo ha sido enviado automáticamente por <strong>${clinicName}</strong>.
                <br>Si tiene alguna duda, contacte directamente con la clínica.
            </p>
        </div>

        <!-- Footer -->
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 16px 0 0;">
            © ${new Date().getFullYear()} ${clinicName}. Todos los derechos reservados.
        </p>
    </div>
</body>
</html>`;

    // 6. Send
    const docNames = docs.map(d => d.name || 'Documento').join(', ');
    const subject = attachments.length === 1
        ? `📄 Documento firmado: ${docs[0]!.name || 'Documento'} — ${clinicName}`
        : `📄 ${attachments.length} documentos firmados — ${clinicName}`;

    const result = await sendEmail(db, clinicId, {
        to: patient.email,
        subject,
        html: htmlContent,
        attachments,
    });

    if (result.success) {
        logger.info(`[E-Signature] Bulk email sent: ${attachments.length} docs to ${patient.email}`, {
            documentIds: docs.map(d => d.id),
            messageId: result.messageId,
        });
        return { success: true, sentCount: attachments.length };
    } else {
        logger.error(`[E-Signature] Bulk email failed`, { error: result.error });
        return { success: false, sentCount: 0, error: result.error || 'Error desconocido al enviar email' };
    }
};
