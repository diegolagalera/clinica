<script setup lang="ts">
/**
 * PatientDocuments.vue
 * E-Signature module: send documents for signing and track status.
 * Template management has been moved to ESignatureSettings.vue (Settings → Firma Electrónica).
 */
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { api } from '@/services/api'
import { toast } from '@/composables/useToast'
import { onSocketEvent } from '@/services/websocket'
import {
  DocumentTextIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  TrashIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  EnvelopeIcon,
} from '@heroicons/vue/24/outline'

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface DocumentTemplate {
  id: string
  name: string
  description: string | null
  category: string
  isActive: boolean
  isConfigured: boolean
  fieldMappings: { signnowFieldName: string; patientDataKey: string; label: string }[] | null
  createdAt: string
}

interface SigningDocument {
  id: string
  name: string
  status: 'DRAFT' | 'PENDING' | 'SIGNED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED'
  signingMethod: 'EMBEDDED' | 'EMAIL'
  signedAt: string | null
  emailSentTo: string | null
  createdAt: string
  templateName: string | null
  templateCategory: string | null
  sentByFirstName: string | null
  sentByLastName: string | null
}

const props = defineProps<{
  patientId: string
  patient: {
    firstName: string
    lastName: string
    email?: string | null
  } | null
}>()

// ─── State ───────────────────────────────────────────────────────────────────

const documents = ref<SigningDocument[]>([])
const templates = ref<DocumentTemplate[]>([])
const isLoading = ref(false)
const isConfigured = ref(false)

// New document modal
const showNewDocModal = ref(false)
const selectedTemplateId = ref('')
const signingMethod = ref<'EMBEDDED' | 'EMAIL'>('EMBEDDED')
const emailSubject = ref('')
const emailMessage = ref('')
const isCreating = ref(false)

// Embedded signing modal
const showSigningModal = ref(false)
const signingUrl = ref('')
const signingDocId = ref('')

// Cancel confirmation modal
const showCancelModal = ref(false)
const cancelDocId = ref('')
const cancelDocName = ref('')
const isCancelling = ref(false)

// Email signed documents modal
const showEmailModal = ref(false)
const selectedDocIds = ref<string[]>([])
const isSendingEmail = ref(false)

const signedDocuments = computed(() => documents.value.filter(d => d.status === 'SIGNED'))
const allDocsSelected = computed(() =>
  signedDocuments.value.length > 0 && selectedDocIds.value.length === signedDocuments.value.length
)

// One-time status check — calls SignNow API directly for real-time status
const refreshDocumentStatus = async (docId: string) => {
  try {
    const response = await api.get<ApiResponse<{ status: string; signed: boolean }>>(
      `/esignature/documents/${docId}/status`
    )
    if (response.success && response.data.signed) {
      toast.success('¡Documento firmado correctamente!')
    }
  } catch {
    // Silent fail
  }
  await fetchDocuments()
}

// ─── Category Labels ─────────────────────────────────────────────────────────

const categoryLabels: Record<string, string> = {
  CONSENT: 'Consentimiento',
  DATA_PROTECTION: 'Protección de datos',
  SURGERY_AUTH: 'Autorización cirugía',
  TREATMENT_PLAN: 'Plan de tratamiento',
  ORTHODONTICS: 'Ortodoncia',
  EXTRACTION: 'Extracción',
  WHITENING: 'Blanqueamiento',
  MINOR_AUTH: 'Autorización menores',
  RADIOGRAPH_CONSENT: 'Consentimiento radiografía',
  OTHER: 'Otro',
}

// ─── Cancel Document (with modal) ────────────────────────────────────────────

const openCancelModal = (docId: string, docName: string) => {
  cancelDocId.value = docId
  cancelDocName.value = docName
  showCancelModal.value = true
}

const confirmCancelDocument = async () => {
  isCancelling.value = true
  try {
    await api.delete(`/esignature/documents/${cancelDocId.value}`)
    toast.success('Documento cancelado correctamente')
    showCancelModal.value = false
    await fetchDocuments()
  } catch {
    toast.error('Error al cancelar el documento')
  } finally {
    isCancelling.value = false
  }
}

const statusConfig: Record<string, { label: string; class: string; icon: string }> = {
  DRAFT: { label: 'Borrador', class: 'bg-surface-100 text-surface-600', icon: 'draft' },
  PENDING: { label: 'Pendiente', class: 'bg-amber-100 text-amber-700', icon: 'pending' },
  SIGNED: { label: 'Firmado', class: 'bg-emerald-100 text-emerald-700', icon: 'signed' },
  DECLINED: { label: 'Rechazado', class: 'bg-red-100 text-red-700', icon: 'declined' },
  EXPIRED: { label: 'Expirado', class: 'bg-surface-100 text-surface-500', icon: 'expired' },
  CANCELLED: { label: 'Cancelado', class: 'bg-surface-100 text-surface-500', icon: 'cancelled' },
}

// ─── Computed ────────────────────────────────────────────────────────────────

const pendingCount = computed(() => documents.value.filter(d => d.status === 'PENDING').length)
const signedCount = computed(() => documents.value.filter(d => d.status === 'SIGNED').length)

// ─── Data Fetching ───────────────────────────────────────────────────────────

const fetchDocuments = async () => {
  try {
    const response = await api.get<ApiResponse<SigningDocument[]>>(`/esignature/documents/patient/${props.patientId}`)
    if (response.success) {
      documents.value = response.data
    }
  } catch (err) {
    console.error('[PatientDocuments] Error fetching documents:', err)
  }
}

const fetchTemplates = async () => {
  try {
    const response = await api.get<ApiResponse<DocumentTemplate[]>>('/esignature/templates')
    if (response.success) {
      templates.value = response.data
    }
  } catch (err) {
    console.error('[PatientDocuments] Error fetching templates:', err)
  }
}

const checkConfig = async () => {
  try {
    const response = await api.get<ApiResponse<{ configured: boolean }>>('/esignature/config/status')
    if (response.success) {
      isConfigured.value = response.data.configured
    }
  } catch {
    isConfigured.value = false
  }
}

// ─── Signing Document Management ─────────────────────────────────────────────

const openNewDocModal = () => {
  selectedTemplateId.value = ''
  signingMethod.value = 'EMBEDDED'
  emailSubject.value = ''
  emailMessage.value = ''
  showNewDocModal.value = true
}

const createDocument = async () => {
  if (!selectedTemplateId.value) {
    toast.error('Selecciona una plantilla')
    return
  }

  if (signingMethod.value === 'EMAIL' && !props.patient?.email) {
    toast.error('El paciente no tiene email registrado')
    return
  }

  // Check if template is configured
  const selectedTemplate = templates.value.find(t => t.id === selectedTemplateId.value)
  if (selectedTemplate && !selectedTemplate.isConfigured) {
    toast.error('La plantilla no está configurada. Configura los campos primero desde Ajustes → Firma Electrónica.')
    return
  }

  isCreating.value = true
  try {
    const response = await api.post<ApiResponse<SigningDocument>>('/esignature/documents', {
      patientId: props.patientId,
      templateId: selectedTemplateId.value,
      signingMethod: signingMethod.value,
      emailSubject: emailSubject.value || undefined,
      emailMessage: emailMessage.value || undefined,
    })

    if (response.success) {
      toast.success(
        signingMethod.value === 'EMAIL'
          ? 'Documento enviado por email'
          : 'Documento creado. Listo para firmar.'
      )
      showNewDocModal.value = false
      await fetchDocuments()

      // If embedded, automatically open signing
      if (signingMethod.value === 'EMBEDDED' && response.data?.id) {
        await openSigning(response.data.id)
      }
    }
  } catch {
    toast.error('Error al crear el documento')
  } finally {
    isCreating.value = false
  }
}

// ─── Real-time signing detection: WebSocket + iframe navigation ──────────────
// WebSocket: instant push when SignNow webhook fires → backend → WebSocket → frontend.
// Iframe load detection: when SignNow redirects after signing → auto-close immediately.
// On close: one-time immediate check against SignNow API (guarantees status update).
// ZERO repeated API calls — no polling, no rate limit risk.

let unsubscribeSignedEvent: (() => void) | null = null
const iframeLoadCount = ref(0)
let isClosingSigning = false // Guard against double-close from iframe + WebSocket race

const openSigning = async (docId: string) => {
  try {
    const response = await api.get<ApiResponse<{ url: string }>>(`/esignature/documents/${docId}/signing-url`)
    if (response.success && response.data.url) {
      signingUrl.value = response.data.url
      signingDocId.value = docId
      iframeLoadCount.value = 0 // Reset load counter for new signing session
      showSigningModal.value = true
      startWebSocketListener(docId)
    }
  } catch {
    toast.error('Error al generar el enlace de firma')
  }
}

/**
 * Close the signing modal.
 * Does ONE immediate check against SignNow API to update status,
 * since the user likely just finished signing.
 */
const closeSigning = async () => {
  // Guard against re-entrance (iframe load + WebSocket can fire simultaneously)
  if (isClosingSigning) return
  isClosingSigning = true

  const docId = signingDocId.value
  showSigningModal.value = false
  signingUrl.value = ''
  stopWebSocketListener()

  // One-time immediate check — user likely just finished signing
  if (docId) {
    try {
      const response = await api.get<ApiResponse<{ status: string; signed: boolean }>>(
        `/esignature/documents/${docId}/status`
      )
      if (response.success && response.data.signed) {
        toast.success('¡Documento firmado correctamente!')
      }
    } catch {
      // Silent fail — will show current status from DB
    }
  }
  await fetchDocuments()
  isClosingSigning = false
}

/**
 * Listen for the 'esignature:document-signed' WebSocket event.
 * This fires instantly when SignNow's webhook reaches our backend.
 */
const startWebSocketListener = (docId: string) => {
  stopWebSocketListener()
  unsubscribeSignedEvent = onSocketEvent('esignature:document-signed', (data: unknown) => {
    const event = data as { documentId?: string; patientId?: string; status?: string }
    if (event.documentId === docId || event.patientId === props.patientId) {
      // Prevent double-toast if iframe detection already triggered closeSigning
      if (isClosingSigning) return
      toast.success('¡Documento firmado correctamente!')
      stopWebSocketListener()
      showSigningModal.value = false
      signingUrl.value = ''
      fetchDocuments()
    }
  })
}

const stopWebSocketListener = () => {
  if (unsubscribeSignedEvent) {
    unsubscribeSignedEvent()
    unsubscribeSignedEvent = null
  }
}

/**
 * Detect iframe navigation: after the initial load (signing page),
 * any subsequent load (e.g. SignNow redirects to login) means signing is done.
 */
const onSigningIframeLoad = () => {
  iframeLoadCount.value++
  // First load = signing page loaded. Second load = signing complete, redirected.
  if (iframeLoadCount.value > 1) {
    console.log('[ESignature] Iframe navigated after signing — auto-closing modal')
    closeSigning()
  }
}

const downloadPdf = async (docId: string, docName: string) => {
  try {
    const response = await api.get<Blob>(`/esignature/documents/${docId}/download`, {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(response as unknown as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${docName}_firmado.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch {
    toast.error('Error al descargar el documento')
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Email Signed Documents ──────────────────────────────────────────────────

const openEmailModal = () => {
  selectedDocIds.value = signedDocuments.value.map(d => d.id)
  showEmailModal.value = true
}

const toggleDocSelection = (docId: string) => {
  const idx = selectedDocIds.value.indexOf(docId)
  if (idx >= 0) {
    selectedDocIds.value.splice(idx, 1)
  } else {
    selectedDocIds.value.push(docId)
  }
}

const toggleAllDocs = () => {
  if (allDocsSelected.value) {
    selectedDocIds.value = []
  } else {
    selectedDocIds.value = signedDocuments.value.map(d => d.id)
  }
}

const sendEmailDocuments = async () => {
  if (selectedDocIds.value.length === 0) return
  isSendingEmail.value = true
  try {
    const res = await api.post('/esignature/documents/email-signed', {
      documentIds: selectedDocIds.value,
      patientId: props.patientId,
    })
    const result = (res as any).data
    if (result?.success) {
      toast.success(`${result.sentCount} documento${result.sentCount > 1 ? 's' : ''} enviado${result.sentCount > 1 ? 's' : ''} por correo`)
      showEmailModal.value = false
    } else {
      toast.error(result?.error || 'Error al enviar documentos')
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.error?.message || 'Error al enviar documentos por correo')
  } finally {
    isSendingEmail.value = false
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([
      fetchDocuments(),
      fetchTemplates(),
      checkConfig(),
    ])
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  stopWebSocketListener()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header with actions -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-surface-900">Documentos y Firma Electrónica</h2>
        <p class="text-sm text-surface-500 mt-1">
          Envía documentos para firma y gestiona su estado
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-if="signedDocuments.length > 0"
          @click="openEmailModal"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
        >
          <EnvelopeIcon class="w-4 h-4" />
          Compartir firmados
        </button>
        <button
          @click="openNewDocModal"
          :disabled="templates.length === 0"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PaperAirplaneIcon class="w-4 h-4" />
          Firmar documento
        </button>
      </div>
    </div>

    <!-- Config warning -->
    <div v-if="!isConfigured && !isLoading" class="p-4 rounded-xl bg-amber-50 border border-amber-200">
      <div class="flex items-start gap-3">
        <ExclamationCircleIcon class="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p class="text-sm font-medium text-amber-800">SignNow no configurado</p>
          <p class="text-sm text-amber-600 mt-1">
            Las credenciales de SignNow no están configuradas. Configura las variables de entorno SIGNNOW_* para habilitar la firma electrónica.
          </p>
        </div>
      </div>
    </div>

    <!-- No templates hint -->
    <div v-if="templates.length === 0 && !isLoading" class="p-4 rounded-xl bg-surface-50 border border-surface-200">
      <div class="flex items-start gap-3">
        <DocumentTextIcon class="w-5 h-5 text-surface-400 mt-0.5 shrink-0" />
        <div>
          <p class="text-sm font-medium text-surface-700">No hay plantillas disponibles</p>
          <p class="text-sm text-surface-500 mt-1">
            Crea plantillas desde <strong>Configuración → Firma Electrónica</strong> para poder enviar documentos a firmar.
          </p>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-4" v-if="documents.length > 0">
      <div class="card p-4">
        <p class="text-sm text-surface-500">Total</p>
        <p class="text-2xl font-bold text-surface-900">{{ documents.length }}</p>
      </div>
      <div class="card p-4">
        <p class="text-sm text-surface-500">Pendientes</p>
        <p class="text-2xl font-bold text-amber-600">{{ pendingCount }}</p>
      </div>
      <div class="card p-4">
        <p class="text-sm text-surface-500">Firmados</p>
        <p class="text-2xl font-bold text-emerald-600">{{ signedCount }}</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="documents.length === 0" class="card p-12 text-center">
      <DocumentTextIcon class="w-16 h-16 text-surface-300 mx-auto mb-4" />
      <h3 class="text-lg font-semibold text-surface-700 mb-2">Sin documentos</h3>
      <p class="text-surface-500 mb-6">
        Este paciente aún no tiene documentos para firmar.
        {{ templates.length === 0 ? 'Crea plantillas desde Configuración → Firma Electrónica.' : 'Envía un documento para comenzar.' }}
      </p>
      <button
        v-if="templates.length > 0"
        @click="openNewDocModal"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
      >
        <PaperAirplaneIcon class="w-4 h-4" />
        Firmar documento
      </button>
    </div>

    <!-- Document list -->
    <div v-else class="space-y-3">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="card p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 min-w-0">
            <!-- Status icon -->
            <div
              :class="[
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                doc.status === 'SIGNED' ? 'bg-emerald-100' :
                doc.status === 'PENDING' ? 'bg-amber-100' :
                doc.status === 'CANCELLED' || doc.status === 'DECLINED' ? 'bg-red-50' :
                'bg-surface-100'
              ]"
            >
              <CheckCircleIcon v-if="doc.status === 'SIGNED'" class="w-5 h-5 text-emerald-600" />
              <ClockIcon v-else-if="doc.status === 'PENDING'" class="w-5 h-5 text-amber-600" />
              <XMarkIcon v-else-if="doc.status === 'CANCELLED' || doc.status === 'DECLINED'" class="w-5 h-5 text-red-500" />
              <DocumentTextIcon v-else class="w-5 h-5 text-surface-500" />
            </div>

            <!-- Document info -->
            <div class="min-w-0">
              <p class="font-medium text-surface-900 truncate">{{ doc.name }}</p>
              <div class="flex items-center gap-3 mt-1 text-sm text-surface-500">
                <span v-if="doc.templateCategory" class="inline-flex items-center">
                  {{ categoryLabels[doc.templateCategory] || doc.templateCategory }}
                </span>
                <span>•</span>
                <span>{{ formatDate(doc.createdAt) }}</span>
                <span v-if="doc.sentByFirstName">•</span>
                <span v-if="doc.sentByFirstName">{{ doc.sentByFirstName }} {{ doc.sentByLastName }}</span>
              </div>
            </div>
          </div>

          <!-- Status badge + actions -->
          <div class="flex items-center gap-3 shrink-0">
            <!-- Signing method badge -->
            <span class="text-xs px-2 py-1 rounded-lg bg-surface-100 text-surface-500">
              {{ doc.signingMethod === 'EMAIL' ? '📩 Email' : '📱 En consulta' }}
            </span>

            <!-- Status badge -->
            <span
              :class="['text-xs font-medium px-3 py-1.5 rounded-lg', statusConfig[doc.status]?.class || 'bg-surface-100 text-surface-600']"
            >
              {{ statusConfig[doc.status]?.label || doc.status }}
            </span>

            <!-- Actions -->
            <div class="flex items-center gap-1">
              <!-- Open for signing (DRAFT/PENDING embedded only) -->
              <button
                v-if="(doc.status === 'DRAFT' || doc.status === 'PENDING') && doc.signingMethod === 'EMBEDDED'"
                @click="openSigning(doc.id)"
                class="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="Abrir para firmar"
              >
                <PencilSquareIcon class="w-4 h-4" />
              </button>

              <!-- Refresh status (PENDING) -->
              <button
                v-if="doc.status === 'PENDING'"
                @click="refreshDocumentStatus(doc.id)"
                class="p-2 text-surface-500 hover:bg-surface-100 rounded-lg transition-colors"
                title="Comprobar estado"
              >
                <ArrowPathIcon class="w-4 h-4" />
              </button>

              <!-- Cancel (DRAFT/PENDING only) -->
              <button
                v-if="doc.status === 'DRAFT' || doc.status === 'PENDING'"
                @click="openCancelModal(doc.id, doc.name)"
                class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Cancelar documento"
              >
                <TrashIcon class="w-4 h-4" />
              </button>

              <!-- Download (SIGNED) -->
              <button
                v-if="doc.status === 'SIGNED'"
                @click="downloadPdf(doc.id, doc.name)"
                class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Descargar PDF firmado"
              >
                <ArrowDownTrayIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Signed info -->
        <div v-if="doc.status === 'SIGNED' && doc.signedAt" class="mt-3 pt-3 border-t border-surface-100">
          <p class="text-sm text-emerald-600">
            ✅ Firmado el {{ formatDate(doc.signedAt) }}
          </p>
        </div>

        <!-- Email sent info -->
        <div v-if="doc.emailSentTo && doc.status === 'PENDING'" class="mt-3 pt-3 border-t border-surface-100">
          <p class="text-sm text-surface-500">
            📩 Enviado a: {{ doc.emailSentTo }}
          </p>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODALS                                                                -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->

    <!-- New Document Modal -->
    <Teleport to="body">
      <div v-if="showNewDocModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showNewDocModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">Nuevo Documento para Firmar</h2>
            <button @click="showNewDocModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <!-- Template selection -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Plantilla</label>
              <select
                v-model="selectedTemplateId"
                class="input w-full"
              >
                <option value="">Selecciona una plantilla...</option>
                <option v-for="t in templates" :key="t.id" :value="t.id">
                  {{ t.name }} ({{ categoryLabels[t.category] || t.category }})
                </option>
              </select>
            </div>

            <!-- Signing method -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-2">Método de firma</label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  @click="signingMethod = 'EMBEDDED'"
                  :class="[
                    'p-3 rounded-xl border-2 text-left transition-all',
                    signingMethod === 'EMBEDDED'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-surface-200 hover:border-surface-300'
                  ]"
                >
                  <p class="font-medium text-sm">📱 En consulta</p>
                  <p class="text-xs text-surface-500 mt-1">El paciente firma en la tablet</p>
                </button>
                <button
                  @click="signingMethod = 'EMAIL'"
                  :class="[
                    'p-3 rounded-xl border-2 text-left transition-all',
                    signingMethod === 'EMAIL'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-surface-200 hover:border-surface-300'
                  ]"
                >
                  <p class="font-medium text-sm">📩 Por email</p>
                  <p class="text-xs text-surface-500 mt-1">Se envía al correo del paciente</p>
                </button>
              </div>
            </div>

            <!-- Email options (only for EMAIL method) -->
            <div v-if="signingMethod === 'EMAIL'" class="space-y-3">
              <div class="p-3 rounded-xl bg-surface-50 text-sm">
                <p class="text-surface-600">
                  Se enviará a: <strong>{{ patient?.email || 'Sin email' }}</strong>
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Asunto (opcional)</label>
                <input
                  v-model="emailSubject"
                  type="text"
                  class="input w-full"
                  placeholder="Documento para firmar"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Mensaje (opcional)</label>
                <textarea
                  v-model="emailMessage"
                  class="input w-full"
                  rows="3"
                  placeholder="Estimado/a paciente, adjuntamos el documento para su firma..."
                ></textarea>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 bg-surface-50 border-t border-surface-100 rounded-b-2xl flex justify-end gap-3">
            <button
              @click="showNewDocModal = false"
              class="px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="createDocument"
              :disabled="!selectedTemplateId || isCreating"
              class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {{ isCreating ? 'Enviando...' : (signingMethod === 'EMAIL' ? 'Enviar por email' : 'Preparar para firma') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Embedded Signing Modal (Full-screen iframe) -->
    <Teleport to="body">
      <div v-if="showSigningModal" class="fixed inset-0 z-[60] bg-white flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-3 bg-surface-900 text-white">
          <div class="flex items-center gap-3">
            <PencilSquareIcon class="w-5 h-5" />
            <span class="font-medium">Firma electrónica</span>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-sm text-surface-300">
              El paciente puede firmar directamente en la pantalla
            </span>
            <button
              @click="closeSigning"
              class="px-4 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
        <!-- iframe -->
        <iframe
          :src="signingUrl"
          class="flex-1 w-full border-0"
          allow="camera; microphone"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
          @load="onSigningIframeLoad"
        ></iframe>
      </div>
    </Teleport>

    <!-- Cancel Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showCancelModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showCancelModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
          <div class="p-6 text-center">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <ExclamationCircleIcon class="w-6 h-6 text-red-600" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">Cancelar documento</h3>
            <p class="text-sm text-surface-500">
              ¿Estás seguro de que deseas cancelar el documento <strong>"{{ cancelDocName }}"</strong>? Esta acción no se puede deshacer.
            </p>
          </div>
          <div class="px-6 py-4 bg-surface-50 border-t border-surface-100 rounded-b-2xl flex justify-end gap-3">
            <button
              @click="showCancelModal = false"
              class="px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 rounded-xl transition-colors"
            >
              No, mantener
            </button>
            <button
              @click="confirmCancelDocument"
              :disabled="isCancelling"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {{ isCancelling ? 'Cancelando...' : 'Sí, cancelar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Email Signed Documents Modal -->
    <Teleport to="body">
      <div v-if="showEmailModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showEmailModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">Enviar documentos por correo</h2>
            <button @click="showEmailModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <!-- Patient email -->
            <div class="p-3 rounded-xl bg-surface-50 flex items-center gap-3">
              <EnvelopeIcon class="w-5 h-5 text-surface-400 shrink-0" />
              <div>
                <p class="text-xs text-surface-500">Se enviará a</p>
                <p class="text-sm font-medium text-surface-900">{{ patient?.email || 'Sin email' }}</p>
              </div>
            </div>

            <!-- Select all toggle -->
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-surface-700">
                {{ selectedDocIds.length }} de {{ signedDocuments.length }} seleccionado{{ selectedDocIds.length !== 1 ? 's' : '' }}
              </span>
              <button
                @click="toggleAllDocs"
                class="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                {{ allDocsSelected ? 'Deseleccionar todos' : 'Seleccionar todos' }}
              </button>
            </div>

            <!-- Document list -->
            <div class="max-h-64 overflow-y-auto space-y-2 -mx-1 px-1">
              <label
                v-for="doc in signedDocuments"
                :key="doc.id"
                class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                :class="selectedDocIds.includes(doc.id) ? 'border-primary-300 bg-primary-50/50' : 'border-surface-200 hover:border-surface-300'"
              >
                <input
                  type="checkbox"
                  :checked="selectedDocIds.includes(doc.id)"
                  @change="toggleDocSelection(doc.id)"
                  class="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-surface-900 truncate">{{ doc.name }}</p>
                  <p class="text-xs text-surface-500" v-if="doc.signedAt">Firmado el {{ formatDate(doc.signedAt) }}</p>
                </div>
                <CheckCircleIcon class="w-4 h-4 text-emerald-500 shrink-0" />
              </label>
            </div>

            <!-- No email warning -->
            <div v-if="!patient?.email" class="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p class="text-sm text-amber-700">
                ⚠️ El paciente no tiene email. Añade un email antes de enviar documentos.
              </p>
            </div>
          </div>

          <div class="px-6 py-4 bg-surface-50 border-t border-surface-100 rounded-b-2xl flex justify-end gap-3">
            <button
              @click="showEmailModal = false"
              class="px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="sendEmailDocuments"
              :disabled="selectedDocIds.length === 0 || !patient?.email || isSendingEmail"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <EnvelopeIcon class="w-4 h-4" />
              {{ isSendingEmail ? 'Enviando...' : `Enviar ${selectedDocIds.length} documento${selectedDocIds.length !== 1 ? 's' : ''}` }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
