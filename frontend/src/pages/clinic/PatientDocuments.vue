<script setup lang="ts">
/**
 * PatientDocuments.vue
 * E-Signature module: manage document templates and signing workflows for a patient.
 * Fully isolated component - all logic is self-contained.
 */
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { api } from '@/services/api'
import { toast } from '@/composables/useToast'
import { onSocketEvent } from '@/services/websocket'
import {
  DocumentTextIcon,
  PlusIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  TrashIcon,
  EyeIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  LinkIcon,
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
  fieldMappings: FieldMapping[] | null
  createdAt: string
}

interface FieldMapping {
  signnowFieldName: string
  patientDataKey: string
  label: string
}

interface SignNowField {
  id: string
  name: string
  label: string
  type: string
  page_number: number
}

interface PatientDataKey {
  key: string
  label: string
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

// Template upload modal
const showTemplateModal = ref(false)
const templateName = ref('')
const templateDescription = ref('')
const templateCategory = ref('OTHER')
const templateFile = ref<File | null>(null)
const isUploading = ref(false)

// Embedded signing modal
const showSigningModal = ref(false)
const signingUrl = ref('')
const signingDocId = ref('')

// Field mapping modal
const showFieldMappingModal = ref(false)
const fieldMappingTemplateId = ref('')
const fieldMappingTemplateName = ref('')
const signnowFields = ref<SignNowField[]>([])
const patientDataKeys = ref<PatientDataKey[]>([])
const currentMappings = ref<FieldMapping[]>([])
const isLoadingFields = ref(false)
const isSavingMappings = ref(false)

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

// ─── Template Management ─────────────────────────────────────────────────────

const openTemplateModal = () => {
  templateName.value = ''
  templateDescription.value = ''
  templateCategory.value = 'OTHER'
  templateFile.value = null
  showTemplateModal.value = true
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    templateFile.value = target.files[0]
  }
}

const uploadTemplate = async () => {
  if (!templateName.value.trim() || !templateFile.value) {
    toast.error('Se requiere un nombre y un archivo PDF')
    return
  }

  isUploading.value = true
  try {
    await api.upload<ApiResponse<DocumentTemplate>>(
      '/esignature/templates',
      templateFile.value,
      'file',
      {
        name: templateName.value.trim(),
        description: templateDescription.value.trim(),
        category: templateCategory.value,
      }
    )
    toast.success('Plantilla creada correctamente')
    showTemplateModal.value = false
    await fetchTemplates()
  } catch (err) {
    toast.error('Error al crear la plantilla')
  } finally {
    isUploading.value = false
  }
}

const deleteTemplate = async (id: string) => {
  if (!confirm('¿Desactivar esta plantilla?')) return
  try {
    await api.delete<ApiResponse<{ deleted: boolean }>>(`/esignature/templates/${id}`)
    toast.success('Plantilla desactivada')
    await fetchTemplates()
  } catch {
    toast.error('Error al desactivar la plantilla')
  }
}

const previewTemplate = async (id: string) => {
  try {
    const response = await api.get<ArrayBuffer>(`/esignature/templates/${id}/preview`, {
      responseType: 'arraybuffer',
    })
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // Clean up the object URL after a delay to allow the tab to load
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  } catch {
    toast.error('Error al previsualizar la plantilla')
  }
}

// ─── Template Configuration (Editor + Field Mapping) ─────────────────────────

const configureTemplate = async (tmplId: string) => {
  try {
    const response = await api.get<ApiResponse<{ url: string; templateId: string }>>(`/esignature/templates/${tmplId}/editor`)
    if (response.success && response.data.url) {
      // Open SignNow embedded editor in new tab
      window.open(response.data.url, '_blank')
      toast.success('Editor abierto en nueva pestaña. Configura los campos y guarda.')
    }
  } catch {
    toast.error('Error al abrir el editor de campos')
  }
}

const openFieldMapping = async (tmplId: string, tmplName: string) => {
  fieldMappingTemplateId.value = tmplId
  fieldMappingTemplateName.value = tmplName
  isLoadingFields.value = true
  showFieldMappingModal.value = true

  try {
    const response = await api.get<ApiResponse<{
      signnowFields: SignNowField[]
      patientDataKeys: PatientDataKey[]
      currentMappings: FieldMapping[]
    }>>(`/esignature/templates/${tmplId}/fields`)

    if (response.success) {
      signnowFields.value = response.data.signnowFields.filter(f => f.type === 'text')
      patientDataKeys.value = response.data.patientDataKeys

      // Always build mappings from fresh signnowFields, preserving any saved patientDataKey
      // f.name = API name (used for prefill), f.label = display name (shown in UI)
      const saved = response.data.currentMappings || []
      currentMappings.value = signnowFields.value.map(f => {
        // Try to find an existing mapping for this field (by name or ID)
        const existing = saved.find(m => m.signnowFieldName === f.name || m.signnowFieldName === f.id)
        return {
          signnowFieldName: f.name,
          patientDataKey: existing?.patientDataKey || '',
          label: f.label || f.name,
        }
      })
    }
  } catch {
    toast.error('Error al cargar los campos de la plantilla')
    showFieldMappingModal.value = false
  } finally {
    isLoadingFields.value = false
  }
}

const updateMapping = (index: number, patientDataKey: string) => {
  if (currentMappings.value[index]) {
    currentMappings.value[index].patientDataKey = patientDataKey
    // Update label from patient data keys
    const keyInfo = patientDataKeys.value.find(k => k.key === patientDataKey)
    if (keyInfo) {
      currentMappings.value[index].label = keyInfo.label
    }
  }
}

const saveFieldMappings = async () => {
  const validMappings = currentMappings.value.filter(m => m.patientDataKey)
  isSavingMappings.value = true
  try {
    await api.put<ApiResponse<{ saved: boolean }>>(
      `/esignature/templates/${fieldMappingTemplateId.value}/field-mappings`,
      { mappings: validMappings }
    )
    toast.success(`${validMappings.length} campos mapeados correctamente`)
    showFieldMappingModal.value = false
    await fetchTemplates()
  } catch {
    toast.error('Error al guardar los mapeos')
  } finally {
    isSavingMappings.value = false
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
    toast.error('La plantilla no está configurada. Configura los campos primero.')
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

// ─── Real-time signing detection: WebSocket only (no polling) ────────────────
// WebSocket: instant push when SignNow webhook fires → backend → WebSocket → frontend.
// On close: one-time immediate check against SignNow API (guarantees status update).
// Manual button: "Comprobar estado" calls SignNow API directly (one-time).
// ZERO repeated API calls — no polling, no rate limit risk.

let unsubscribeSignedEvent: (() => void) | null = null

const openSigning = async (docId: string) => {
  try {
    const response = await api.get<ApiResponse<{ url: string }>>(`/esignature/documents/${docId}/signing-url`)
    if (response.success && response.data.url) {
      signingUrl.value = response.data.url
      signingDocId.value = docId
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
          Gestiona consentimientos y documentos con firma electrónica
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          @click="openTemplateModal"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-surface-700 bg-white border border-surface-300 rounded-xl hover:bg-surface-50 transition-colors"
        >
          <PlusIcon class="w-4 h-4" />
          Nueva Plantilla
        </button>
        <button
          @click="openNewDocModal"
          :disabled="templates.length === 0"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PaperAirplaneIcon class="w-4 h-4" />
          Enviar Documento
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
            Las credenciales de SignNow no están configuradas. Puedes crear plantillas y documentos, pero la firma electrónica no estará disponible hasta configurar las variables de entorno SIGNNOW_*.
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
        {{ templates.length === 0 ? 'Crea una plantilla primero.' : 'Envía un documento para comenzar.' }}
      </p>
      <button
        v-if="templates.length === 0"
        @click="openTemplateModal"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
      >
        <PlusIcon class="w-4 h-4" />
        Crear primera plantilla
      </button>
      <button
        v-else
        @click="openNewDocModal"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
      >
        <PaperAirplaneIcon class="w-4 h-4" />
        Enviar primer documento
      </button>
    </div>

    <!-- Documents list -->
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
                'bg-surface-100'
              ]"
            >
              <CheckCircleIcon v-if="doc.status === 'SIGNED'" class="w-5 h-5 text-emerald-600" />
              <ClockIcon v-else-if="doc.status === 'PENDING'" class="w-5 h-5 text-amber-600" />
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

    <!-- Templates section -->
    <div v-if="templates.length > 0" class="mt-8">
      <h3 class="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3">Plantillas disponibles</h3>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="tmpl in templates"
          :key="tmpl.id"
          class="card p-4 group hover:shadow-md transition-shadow"
        >
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="font-medium text-surface-900 truncate">{{ tmpl.name }}</p>
                <!-- Configuration badge -->
                <span
                  v-if="tmpl.isConfigured"
                  class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"
                >
                  <CheckCircleIcon class="w-3 h-3" />
                  Configurada
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
                >
                  <ExclamationCircleIcon class="w-3 h-3" />
                  Sin configurar
                </span>
              </div>
              <p class="text-sm text-surface-500 mt-1">{{ categoryLabels[tmpl.category] || tmpl.category }}</p>
              <p v-if="tmpl.description" class="text-xs text-surface-400 mt-1 line-clamp-2">{{ tmpl.description }}</p>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
              <button
                @click="configureTemplate(tmpl.id)"
                class="p-1.5 text-surface-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Configurar campos en editor"
              >
                <Cog6ToothIcon class="w-4 h-4" />
              </button>
              <button
                @click="openFieldMapping(tmpl.id, tmpl.name)"
                class="p-1.5 text-surface-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                title="Mapear campos a datos del paciente"
              >
                <LinkIcon class="w-4 h-4" />
              </button>
              <button
                @click="previewTemplate(tmpl.id)"
                class="p-1.5 text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="Ver plantilla"
              >
                <EyeIcon class="w-4 h-4" />
              </button>
              <button
                @click="deleteTemplate(tmpl.id)"
                class="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Desactivar"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
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

    <!-- Template Upload Modal -->
    <Teleport to="body">
      <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showTemplateModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">Nueva Plantilla</h2>
            <button @click="showTemplateModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Nombre *</label>
              <input
                v-model="templateName"
                type="text"
                class="input w-full"
                placeholder="Ej: Consentimiento informado general"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Descripción</label>
              <textarea
                v-model="templateDescription"
                class="input w-full"
                rows="2"
                placeholder="Descripción opcional..."
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Categoría</label>
              <select v-model="templateCategory" class="input w-full">
                <option v-for="(label, key) in categoryLabels" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Archivo PDF *</label>
              <div
                class="border-2 border-dashed border-surface-200 rounded-xl p-6 text-center hover:border-primary-300 transition-colors cursor-pointer"
                @click="($refs.fileInput as HTMLInputElement)?.click()"
              >
                <input
                  ref="fileInput"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  class="hidden"
                  @change="handleFileSelect"
                />
                <DocumentTextIcon class="w-10 h-10 text-surface-300 mx-auto mb-2" />
                <p v-if="templateFile" class="text-sm font-medium text-primary-600">
                  {{ templateFile.name }}
                </p>
                <p v-else class="text-sm text-surface-500">
                  Haz clic para seleccionar un archivo PDF
                </p>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 bg-surface-50 border-t border-surface-100 rounded-b-2xl flex justify-end gap-3">
            <button
              @click="showTemplateModal = false"
              class="px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="uploadTemplate"
              :disabled="!templateName.trim() || !templateFile || isUploading"
              class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {{ isUploading ? 'Subiendo...' : 'Crear Plantilla' }}
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
        ></iframe>
      </div>
    </Teleport>

    <!-- Field Mapping Modal -->
    <Teleport to="body">
      <div v-if="showFieldMappingModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showFieldMappingModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg animate-scale-in max-h-[85vh] flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <div>
              <h2 class="text-lg font-semibold text-surface-900">Mapear Campos</h2>
              <p class="text-sm text-surface-500 mt-0.5">{{ fieldMappingTemplateName }}</p>
            </div>
            <button @click="showFieldMappingModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="p-6 overflow-y-auto flex-1">
            <div v-if="isLoadingFields" class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
            </div>

            <div v-else-if="signnowFields.length === 0" class="text-center py-8">
              <ExclamationCircleIcon class="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <p class="font-medium text-surface-700">No se encontraron campos de texto</p>
              <p class="text-sm text-surface-500 mt-1">
                Primero usa el editor para colocar campos de texto en la plantilla.
              </p>
              <button
                @click="showFieldMappingModal = false; configureTemplate(fieldMappingTemplateId)"
                class="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
              >
                <Cog6ToothIcon class="w-4 h-4" />
                Abrir editor
              </button>
            </div>

            <div v-else class="space-y-4">
              <div class="p-3 rounded-xl bg-surface-50 text-sm text-surface-600">
                <p>Conecta cada campo del documento con los datos del paciente que se autocompletarán al crear un documento para firma.</p>
              </div>

              <div
                v-for="(mapping, idx) in currentMappings"
                :key="idx"
                class="p-4 border border-surface-200 rounded-xl space-y-2"
              >
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium text-surface-900">{{ mapping.label || mapping.signnowFieldName }}</p>
                  <span class="text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-500">Campo de texto</span>
                </div>
                <select
                  :value="mapping.patientDataKey"
                  @change="updateMapping(idx, ($event.target as HTMLSelectElement).value)"
                  class="input w-full text-sm"
                >
                  <option value="">— No mapear —</option>
                  <option v-for="pk in patientDataKeys" :key="pk.key" :value="pk.key">
                    {{ pk.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div v-if="signnowFields.length > 0" class="px-6 py-4 bg-surface-50 border-t border-surface-100 rounded-b-2xl flex justify-end gap-3">
            <button
              @click="showFieldMappingModal = false"
              class="px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="saveFieldMappings"
              :disabled="isSavingMappings"
              class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {{ isSavingMappings ? 'Guardando...' : 'Guardar Mapeos' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
