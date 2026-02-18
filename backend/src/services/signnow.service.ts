/**
 * SignNow API Service
 * Low-level wrapper for SignNow REST API using API Key authentication.
 * All SignNow API interactions go through this service.
 */
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignNowDocument {
    id: string;
    document_name: string;
    page_count: number;
    created: string;
    updated: string;
    roles?: SignNowRole[];
}

interface SignNowRole {
    unique_id: string;
    name: string;
    signing_order: number;
}

interface EmbeddedInviteResponse {
    data: {
        id: string;
        link: string;
    };
}

interface SignNowField {
    x: number;
    y: number;
    width: number;
    height: number;
    page_number: number;
    role: string;
    required: boolean;
    type: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const getApiUrl = (): string => config.signnow.apiUrl;

const isConfigured = (): boolean => !!config.signnow.apiKey;

/**
 * Check if SignNow is properly configured
 */
export const checkConfiguration = (): boolean => isConfigured();

// ─── API Key Authentication ──────────────────────────────────────────────────

/**
 * Get the API Key to use as Bearer token.
 * SignNow API Keys work directly as Bearer tokens — no OAuth2 exchange needed.
 */
export const getAccessToken = async (): Promise<string> => {
    if (!isConfigured()) {
        throw new AppError('SignNow no está configurado. Configura SIGNNOW_API_KEY en el entorno.', 503, 'SIGNNOW_NOT_CONFIGURED');
    }

    return config.signnow.apiKey!;
};

// ─── Document Details ────────────────────────────────────────────────────────

/**
 * Get document details including roles from SignNow
 */
export const getDocumentRoles = async (
    documentId: string
): Promise<SignNowRole[]> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/document/${documentId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Get document roles error:', errorText);
        return [];
    }

    const data = (await response.json()) as { roles?: SignNowRole[] };
    return data.roles || [];
};

/**
 * Get all fields from a document (signature, text, etc.)
 * Used for field mapping — admin sees which fields exist and maps them to patient data.
 */
export const getDocumentFields = async (
    documentId: string
): Promise<Array<{ id: string; name: string; type: string; role_id: string; page_number: number }>> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/document/${documentId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Get document fields error:', errorText);
        return [];
    }

    const data = (await response.json()) as Record<string, unknown>;
    const fields: Array<{ id: string; name: string; type: string; role_id: string; page_number: number }> = [];

    // Debug: log all top-level keys and array lengths to understand the response structure
    console.log('[SignNow] Document response keys:', Object.keys(data));
    for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
            console.log(`[SignNow]   ${key}: array with ${(data[key] as unknown[]).length} items`);
            if ((data[key] as unknown[]).length > 0) {
                console.log(`[SignNow]   ${key}[0] keys:`, Object.keys((data[key] as unknown[])[0] as Record<string, unknown>));
            }
        }
    }

    // Extract text fields (may be under 'texts' or 'fields')
    const texts = (data.texts || []) as Array<Record<string, unknown>>;
    for (const t of texts) {
        fields.push({
            id: String(t.id || ''),
            name: String(t.label || t.name || `text_${t.id}`),
            type: 'text',
            role_id: String(t.role_id || ''),
            page_number: parseInt(String(t.page_number || '0'), 10),
        });
    }

    // Extract from 'fields' array — SignNow nests properties inside json_attributes
    const genericFields = (data.fields || []) as Array<Record<string, unknown>>;
    if (genericFields.length > 0) {
        console.log('[SignNow] fields[0] type of json_attributes:', typeof genericFields[0]?.json_attributes);
        console.log('[SignNow] fields[0] FULL object:', JSON.stringify(genericFields[0], null, 2));
    }
    for (const f of genericFields) {
        // json_attributes may be an object or a JSON string
        let attrs: Record<string, unknown> = {};
        if (typeof f.json_attributes === 'string') {
            try { attrs = JSON.parse(f.json_attributes); } catch { attrs = {}; }
        } else if (f.json_attributes && typeof f.json_attributes === 'object') {
            attrs = f.json_attributes as Record<string, unknown>;
        }
        const fieldName = String(attrs.label || attrs.name || f.label || f.name || `field_${f.id}`);
        console.log(`[SignNow] Field extracted: id=${f.id}, name="${fieldName}", attrs.label="${attrs.label}", attrs.name="${attrs.name}"`);
        fields.push({
            id: String(f.id || ''),
            name: fieldName,
            type: String(f.type || attrs.type || 'text'),
            role_id: String(f.role_id || ''),
            page_number: parseInt(String(attrs.page_number ?? f.page_number ?? '0'), 10),
        });
    }

    // Extract signature fields
    const signatures = (data.signatures || []) as Array<Record<string, unknown>>;
    for (const s of signatures) {
        fields.push({
            id: String(s.id || ''),
            name: String(s.name || s.label || `signature_${s.id}`),
            type: 'signature',
            role_id: String(s.role_id || ''),
            page_number: parseInt(String(s.page_number || '0'), 10),
        });
    }

    // Extract checkbox fields
    const checks = (data.checks || []) as Array<Record<string, unknown>>;
    for (const c of checks) {
        fields.push({
            id: String(c.id || ''),
            name: String(c.label || c.name || `check_${c.id}`),
            type: 'checkbox',
            role_id: String(c.role_id || ''),
            page_number: parseInt(String(c.page_number || '0'), 10),
        });
    }

    console.log(`[SignNow] Found ${fields.length} fields in document ${documentId}`);
    return fields;
};

// ─── Document Operations ─────────────────────────────────────────────────────

/**
 * Upload a document to SignNow from a buffer
 */
export const uploadDocument = async (
    fileBuffer: Buffer,
    filename: string
): Promise<SignNowDocument> => {
    const token = await getAccessToken();

    // SignNow expects multipart/form-data with the file
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, filename);

    const response = await fetch(`${getApiUrl()}/document`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Upload document error:', errorText);
        throw new AppError(`Error al subir documento a SignNow: ${response.status}`, 502, 'SIGNNOW_UPLOAD_ERROR');
    }

    return (await response.json()) as SignNowDocument;
};

/**
 * Create a template from an uploaded document
 */
export const createTemplate = async (documentId: string): Promise<{ id: string }> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/template`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            document_id: documentId,
            document_name: `template_${documentId}`,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Create template error:', errorText);
        throw new AppError(`Error al crear plantilla en SignNow: ${response.status}`, 502, 'SIGNNOW_TEMPLATE_ERROR');
    }

    return (await response.json()) as { id: string };
};

/**
 * Create a new document from a template (clone for signing)
 */
export const createDocumentFromTemplate = async (
    templateId: string,
    documentName: string
): Promise<SignNowDocument> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/template/${templateId}/copy`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            document_name: documentName,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Clone template error:', errorText);
        throw new AppError(`Error al clonar plantilla en SignNow: ${response.status}`, 502, 'SIGNNOW_CLONE_ERROR');
    }

    return (await response.json()) as SignNowDocument;
};

/**
 * Add text fields to a document (for prefilling patient data)
 */
export const addTextFields = async (
    documentId: string,
    fields: Array<{
        label: string;
        prefilled_text: string;
        x: number;
        y: number;
        width: number;
        height: number;
        page_number: number;
    }>
): Promise<void> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/v2/documents/${documentId}/prefill-texts`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Add text fields error:', errorText);
        // Non-critical, log but don't throw
    }
};

/**
 * Add signature/initials fields to a document
 */
export const addSignatureFields = async (
    documentId: string,
    fields: SignNowField[]
): Promise<void> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/document/${documentId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Add signature fields error:', errorText);
        throw new AppError(`Error al añadir campos de firma: ${response.status}`, 502, 'SIGNNOW_FIELDS_ERROR');
    }
};

/**
 * Prefill text fields on a document with patient data.
 * Uses the SignNow prefill endpoint to inject data into named fields.
 * Field names must match those placed in the template via the embedded editor.
 */
export const prefillDocumentFields = async (
    documentId: string,
    fields: Array<{ field_name: string; prefilled_text: string }>
): Promise<void> => {
    if (fields.length === 0) return;

    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/v2/documents/${documentId}/prefill-text`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fields: fields.map(f => ({
                field_name: f.field_name,
                prefilled_text: f.prefilled_text,
            })),
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Prefill error:', errorText);
        // Prefill is best-effort — log but don't throw
        console.warn(`[SignNow] Prefill failed for document ${documentId}, continuing...`);
    } else {
        console.log(`[SignNow] Prefilled ${fields.length} fields on document ${documentId}`);
    }
};

// ─── Signing Invites ─────────────────────────────────────────────────────────

/**
 * Create an embedded signing invite (for in-clinic tablet signing)
 * Returns a URL to load in an iframe.
 * 
 * Flow:
 * 1. Check if the document has roles (from signature fields configured via editor)
 * 2. If no roles found, fail gracefully — template must be configured first
 * 3. Create an embedded invite with the correct role_id
 * 4. Generate a signing link from the invite
 */
export const createEmbeddedInvite = async (
    documentId: string,
    signerEmail: string
): Promise<string> => {
    const token = await getAccessToken();

    // Step 1: Get roles from the document (should exist from template configuration)
    const roles = await getDocumentRoles(documentId);

    if (roles.length === 0) {
        throw new AppError(
            'La plantilla no tiene campos de firma configurados. Use el editor para configurar los campos primero.',
            400,
            'SIGNNOW_TEMPLATE_NOT_CONFIGURED'
        );
    }

    const roleId = roles[0]!.unique_id;
    console.log(`[SignNow] Using role_id: ${roleId} for signer: ${signerEmail}`);

    // Step 2: Create an invite for the document with the correct role_id
    const inviteResponse = await fetch(`${getApiUrl()}/v2/documents/${documentId}/embedded-invites`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            invites: [
                {
                    email: signerEmail,
                    role_id: roleId,
                    order: 1,
                    auth_method: 'none',
                },
            ],
        }),
    });

    if (!inviteResponse.ok) {
        const errorText = await inviteResponse.text();
        console.error('[SignNow] Embedded invite error:', errorText);
        throw new AppError(`Error al crear invitación embebida: ${inviteResponse.status}`, 502, 'SIGNNOW_EMBED_INVITE_ERROR');
    }

    const inviteData = (await inviteResponse.json()) as EmbeddedInviteResponse;

    // Step 3: Generate the signing link
    const linkResponse = await fetch(
        `${getApiUrl()}/v2/documents/${documentId}/embedded-invites/${inviteData.data.id}/link`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                link_expiration: 45, // 45 minutes
                auth_method: 'none',
            }),
        }
    );

    if (!linkResponse.ok) {
        const errorText = await linkResponse.text();
        console.error('[SignNow] Signing link error:', errorText);
        throw new AppError(`Error al generar enlace de firma: ${linkResponse.status}`, 502, 'SIGNNOW_LINK_ERROR');
    }

    const linkData = (await linkResponse.json()) as { data: { link: string } };
    return linkData.data.link;
};

/**
 * Send a signing invite via email
 */
export const sendEmailInvite = async (
    documentId: string,
    signerEmail: string,
    subject: string,
    message: string,
    fromEmail?: string
): Promise<void> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/document/${documentId}/invite`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            to: [
                {
                    email: signerEmail,
                    role: 'Signer 1',
                    role_id: '',
                    order: 1,
                },
            ],
            ...(fromEmail ? { from: fromEmail } : {}),
            subject,
            message,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Email invite error:', errorText);
        throw new AppError(`Error al enviar invitación por email: ${response.status}`, 502, 'SIGNNOW_EMAIL_INVITE_ERROR');
    }
};

/**
 * Subscribe to a SignNow webhook event for a document.
 * Registers a callback URL to receive notifications when the document is completed.
 */
export const subscribeToWebhook = async (
    documentId: string,
    callbackUrl: string,
    event: string = 'document.complete',
    secretKey?: string
): Promise<string | null> => {
    const token = await getAccessToken();

    const attributes: Record<string, unknown> = {
        callback: callbackUrl,
        use_tls_12: true,
    };
    if (secretKey) {
        attributes.secret_key = secretKey;
    }

    const response = await fetch(`${getApiUrl()}/v2/event-subscriptions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            event,
            entity_id: documentId,
            action: 'callback',
            attributes,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Webhook subscription error:', errorText);
        // Don't throw — webhook subscription is best-effort
        console.warn(`[SignNow] Failed to subscribe webhook for document ${documentId}`);
        return null;
    }

    const data = (await response.json()) as { id?: string };
    console.log(`[SignNow] Webhook subscribed for ${event} on document ${documentId}`);
    return data.id || null;
};

// ─── Document Status & Download ──────────────────────────────────────────────

/**
 * Get document details and signing status
 */
export const getDocumentStatus = async (
    documentId: string
): Promise<{ status: string; signed: boolean; data: Record<string, unknown> }> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/document/${documentId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Document status error:', errorText);
        throw new AppError(`Error al obtener estado del documento: ${response.status}`, 502, 'SIGNNOW_STATUS_ERROR');
    }

    const data = (await response.json()) as Record<string, unknown>;
    const fieldInvites = data.field_invites as Array<{ status: string }> | undefined;
    const isSigned = fieldInvites?.some(invite => invite.status === 'fulfilled') || false;

    return {
        status: isSigned ? 'signed' : 'pending',
        signed: isSigned,
        data,
    };
};

/**
 * Download the signed document as a PDF buffer
 */
export const downloadSignedDocument = async (documentId: string): Promise<Buffer> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/document/${documentId}/download?type=collapsed`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Download error:', errorText);
        throw new AppError(`Error al descargar documento firmado: ${response.status}`, 502, 'SIGNNOW_DOWNLOAD_ERROR');
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
};

/**
 * Get the embedded editor link for setting up template fields
 */
export const getEditorLink = async (
    documentId: string,
    redirectUri: string
): Promise<string> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/v2/documents/${documentId}/embedded-editor`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            redirect_uri: redirectUri,
            redirect_target: 'self',
            link_expiration: 45,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignNow] Editor link error:', errorText);
        throw new AppError(`Error al generar enlace del editor: ${response.status}`, 502, 'SIGNNOW_EDITOR_ERROR');
    }

    const data = (await response.json()) as { data: { url: string } };
    return data.data.url;
};

/**
 * Delete a document from SignNow
 */
export const deleteDocument = async (documentId: string): Promise<void> => {
    const token = await getAccessToken();

    const response = await fetch(`${getApiUrl()}/document/${documentId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        // Log but don't throw - the document might already be deleted
        console.warn('[SignNow] Delete document warning:', response.status);
    }
};
