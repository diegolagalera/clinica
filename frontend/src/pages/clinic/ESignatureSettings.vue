<script setup lang="ts">
/**
 * ESignatureSettings.vue
 * Template management page for e-signature module.
 * Accessible from Settings → Firma Electrónica.
 * Admin configures templates here; signing happens in PatientDocuments.vue.
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import { toast } from '@/composables/useToast'
import {
  DocumentTextIcon,
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TrashIcon,
  EyeIcon,
  Cog6ToothIcon,
  LinkIcon,
  ArrowLeftIcon,
  PencilSquareIcon,
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

const router = useRouter()

// ─── State ───────────────────────────────────────────────────────────────────

const templates = ref<DocumentTemplate[]>([])
const isLoading = ref(false)
const isConfigured = ref(false)

// Template upload modal
const showTemplateModal = ref(false)
const templateName = ref('')
const templateDescription = ref('')
const templateCategory = ref('OTHER')
const templateFile = ref<File | null>(null)
const isUploading = ref(false)

// Field mapping modal
const showFieldMappingModal = ref(false)
const fieldMappingTemplateId = ref('')
const fieldMappingTemplateName = ref('')
const signnowFields = ref<SignNowField[]>([])
const patientDataKeys = ref<PatientDataKey[]>([])
const currentMappings = ref<FieldMapping[]>([])
const isLoadingFields = ref(false)
const isSavingMappings = ref(false)

// Confirmation modal
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmAction = ref<(() => Promise<void>) | null>(null)
const isConfirming = ref(false)

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

// ─── Data Fetching ───────────────────────────────────────────────────────────

const fetchTemplates = async () => {
  try {
    const response = await api.get<ApiResponse<DocumentTemplate[]>>('/esignature/templates')
    if (response.success) {
      templates.value = response.data
    }
  } catch (err) {
    console.error('[ESignatureSettings] Error fetching templates:', err)
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
  } catch {
    toast.error('Error al crear la plantilla')
  } finally {
    isUploading.value = false
  }
}

const requestDeleteTemplate = (id: string, name: string) => {
  confirmTitle.value = 'Desactivar plantilla'
  confirmMessage.value = `¿Estás seguro de que deseas desactivar la plantilla "${name}"? Los documentos ya enviados no se verán afectados.`
  confirmAction.value = async () => {
    try {
      await api.delete<ApiResponse<{ deleted: boolean }>>(`/esignature/templates/${id}`)
      toast.success('Plantilla desactivada')
      await fetchTemplates()
    } catch {
      toast.error('Error al desactivar la plantilla')
    }
  }
  showConfirmModal.value = true
}

const executeConfirm = async () => {
  if (!confirmAction.value) return
  isConfirming.value = true
  try {
    await confirmAction.value()
  } finally {
    isConfirming.value = false
    showConfirmModal.value = false
    confirmAction.value = null
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

      const saved = response.data.currentMappings || []
      currentMappings.value = signnowFields.value.map(f => {
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

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([fetchTemplates(), checkConfig()])
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="max-w-5xl mx-auto py-6 px-4">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-8">
      <button
        @click="router.push('/clinic/settings')"
        class="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
      >
        <ArrowLeftIcon class="w-5 h-5" />
      </button>
      <div class="p-3 bg-indigo-100 rounded-xl">
        <PencilSquareIcon class="w-8 h-8 text-indigo-600" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Firma Electrónica</h1>
        <p class="text-surface-500">Gestiona las plantillas de documentos para firma electrónica</p>
      </div>
    </div>

    <!-- Config warning -->
    <div v-if="!isConfigured && !isLoading" class="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
      <div class="flex items-start gap-3">
        <ExclamationCircleIcon class="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p class="text-sm font-medium text-amber-800">SignNow no configurado</p>
          <p class="text-sm text-amber-600 mt-1">
            Las credenciales de SignNow no están configuradas. Puedes crear plantillas, pero la firma electrónica no estará disponible hasta configurar las variables de entorno SIGNNOW_*.
          </p>
        </div>
      </div>
    </div>

    <!-- Action bar -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-sm text-surface-500">
          {{ templates.length }} plantilla{{ templates.length !== 1 ? 's' : '' }} disponible{{ templates.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <button
        @click="openTemplateModal"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
      >
        <PlusIcon class="w-4 h-4" />
        Nueva Plantilla
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="templates.length === 0" class="card p-12 text-center">
      <DocumentTextIcon class="w-16 h-16 text-surface-300 mx-auto mb-4" />
      <h3 class="text-lg font-semibold text-surface-700 mb-2">Sin plantillas</h3>
      <p class="text-surface-500 mb-6">
        Crea tu primera plantilla para empezar a gestionar documentos con firma electrónica.
      </p>
      <button
        @click="openTemplateModal"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
      >
        <PlusIcon class="w-4 h-4" />
        Crear Plantilla
      </button>
    </div>

    <!-- Templates grid -->
    <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="tmpl in templates"
        :key="tmpl.id"
        class="card p-5 group hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-surface-900 truncate">{{ tmpl.name }}</p>
            <p class="text-sm text-surface-500 mt-0.5">{{ categoryLabels[tmpl.category] || tmpl.category }}</p>
          </div>
          <!-- Configuration badge -->
          <span
            v-if="tmpl.isConfigured"
            class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0 ml-2"
          >
            <CheckCircleIcon class="w-3 h-3" />
            Configurada
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0 ml-2"
          >
            <ExclamationCircleIcon class="w-3 h-3" />
            Sin configurar
          </span>
        </div>

        <p v-if="tmpl.description" class="text-xs text-surface-400 mb-3 line-clamp-2">{{ tmpl.description }}</p>

        <div class="text-xs text-surface-400 mb-3">
          Creada: {{ formatDate(tmpl.createdAt) }}
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 pt-3 border-t border-surface-100">
          <button
            @click="configureTemplate(tmpl.id)"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Configurar campos en editor"
          >
            <Cog6ToothIcon class="w-3.5 h-3.5" />
            Editor
          </button>
          <button
            @click="openFieldMapping(tmpl.id, tmpl.name)"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
            title="Mapear campos a datos del paciente"
          >
            <LinkIcon class="w-3.5 h-3.5" />
            Mapear
          </button>
          <button
            @click="previewTemplate(tmpl.id)"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
            title="Ver plantilla"
          >
            <EyeIcon class="w-3.5 h-3.5" />
            Ver
          </button>
          <div class="flex-1"></div>
          <button
            @click="requestDeleteTemplate(tmpl.id, tmpl.name)"
            class="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Desactivar plantilla"
          >
            <TrashIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODALS                                                                -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->

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
                class="border-2 border-dashed border-surface-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors cursor-pointer"
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
                <p v-if="templateFile" class="text-sm font-medium text-indigo-600">
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
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {{ isUploading ? 'Subiendo...' : 'Crear Plantilla' }}
            </button>
          </div>
        </div>
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
              <div class="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
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
                  <div>
                    <p class="text-sm font-medium text-surface-900">{{ mapping.signnowFieldName }}</p>
                    <p v-if="mapping.patientDataKey" class="text-xs text-primary-600 mt-0.5">
                      → {{ patientDataKeys.find(k => k.key === mapping.patientDataKey)?.label || mapping.patientDataKey }}
                    </p>
                  </div>
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
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {{ isSavingMappings ? 'Guardando...' : 'Guardar Mapeos' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showConfirmModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showConfirmModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
          <div class="p-6 text-center">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <ExclamationCircleIcon class="w-6 h-6 text-red-600" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">{{ confirmTitle }}</h3>
            <p class="text-sm text-surface-500">{{ confirmMessage }}</p>
          </div>
          <div class="px-6 py-4 bg-surface-50 border-t border-surface-100 rounded-b-2xl flex justify-end gap-3">
            <button
              @click="showConfirmModal = false"
              class="px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 rounded-xl transition-colors"
            >
              No, mantener
            </button>
            <button
              @click="executeConfirm"
              :disabled="isConfirming"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {{ isConfirming ? 'Procesando...' : 'Sí, confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
