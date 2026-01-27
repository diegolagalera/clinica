<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/services/api'
import {
  EnvelopeIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline'

interface EmailSettings {
  id?: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  fromName: string
  fromEmail: string
  isEnabled: boolean
  isConfigured: boolean
  // Notification toggles
  sendOnCreate?: boolean
  sendOnCancel?: boolean
  reminder24hEnabled?: boolean
  reminder1hEnabled?: boolean
}

interface EmailTemplate {
  id: string
  type: string
  name: string
  subject: string
  isActive: boolean
  isDefault: boolean
}

interface NotificationLog {
  id: string
  templateType: string
  recipient: string
  subject: string
  status: string
  sentAt: string
  createdAt: string
  patient?: {
    firstName: string
    lastName: string
  }
}

interface TemplateType {
  value: string
  label: string
}

// Tabs
const activeTab = ref<'config' | 'templates' | 'logs'>('config')

// Settings state
const settings = ref<EmailSettings>({
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  fromName: '',
  fromEmail: '',
  isEnabled: false,
  isConfigured: false,
  sendOnCreate: true,
  sendOnCancel: true,
  reminder24hEnabled: true,
  reminder1hEnabled: true,
})
const isSavingSettings = ref(false)
const isTestingConnection = ref(false)
const testEmail = ref('')
const isSendingTest = ref(false)
const settingsMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Templates state
const templates = ref<EmailTemplate[]>([])
const templateTypes = ref<TemplateType[]>([])
const isLoadingTemplates = ref(false)
const showTemplateModal = ref(false)
const showPreviewModal = ref(false)
const previewHtml = ref('')
const previewSubject = ref('')

// Delete confirmation modal
const showDeleteModal = ref(false)
const templateToDelete = ref<EmailTemplate | null>(null)
const isDeletingTemplate = ref(false)
const editingTemplate = ref<EmailTemplate | null>(null)
const templateForm = ref<{
  type: string
  name: string
  subject: string
  blocks: any[]
}>({
  type: 'APPOINTMENT_CREATED',
  name: '',
  subject: '',
  blocks: [],
})
const testEmailForTemplate = ref('')
const isSendingTemplateTest = ref(false)
const isSavingTemplate = ref(false)

// Reset template form
const resetTemplateForm = () => {
  editingTemplate.value = null
  templateForm.value = {
    type: 'APPOINTMENT_CREATED',
    name: '',
    subject: '',
    blocks: [],
  }
}

// Open template modal for create/edit
const openTemplateModal = async (template?: EmailTemplate) => {
  if (template) {
    editingTemplate.value = template
    templateForm.value = {
      type: template.type,
      name: template.name,
      subject: template.subject,
      blocks: [],
    }
  } else {
    resetTemplateForm()
    // Load default template blocks for selected type
    const defaultTemplate = await api.get<any>(`/notifications/templates/default/${templateForm.value.type}`)
    if (defaultTemplate.success && defaultTemplate.data) {
      templateForm.value.subject = defaultTemplate.data.subject
      templateForm.value.blocks = defaultTemplate.data.blocks || []
    }
  }
  showTemplateModal.value = true
}

// Load default template when type changes
const onTemplateTypeChange = async () => {
  if (!editingTemplate.value) {
    try {
      const defaultTemplate = await api.get<any>(`/notifications/templates/default/${templateForm.value.type}`)
      if (defaultTemplate.success && defaultTemplate.data) {
        templateForm.value.subject = defaultTemplate.data.subject
        templateForm.value.blocks = defaultTemplate.data.blocks || []
      }
    } catch {
      // ignore
    }
  }
}

// Save template
const saveTemplate = async () => {
  if (!templateForm.value.name || !templateForm.value.subject) {
    return
  }

  isSavingTemplate.value = true
  try {
    if (editingTemplate.value) {
      await api.put(`/notifications/templates/${editingTemplate.value.id}`, templateForm.value)
    } else {
      await api.post('/notifications/templates', templateForm.value)
    }
    showTemplateModal.value = false
    resetTemplateForm()
    await loadTemplates()
  } catch (err) {
    console.error('Error saving template', err)
  } finally {
    isSavingTemplate.value = false
  }
}

// Logs state
const logs = ref<NotificationLog[]>([])
const isLoadingLogs = ref(false)
const stats = ref({ total: 0, sent: 0, failed: 0, pending: 0 })

// Load settings
const loadSettings = async () => {
  try {
    const response = await api.get<any>('/notifications/settings')
    if (response.success && response.data) {
      settings.value = { ...settings.value, ...response.data }
    }
  } catch {
    console.log('No settings found')
  }
}

// Save settings
const saveSettings = async () => {
  isSavingSettings.value = true
  settingsMessage.value = null
  try {
    const response = await api.put<any>('/notifications/settings', settings.value)
    if (response.success) {
      settingsMessage.value = { type: 'success', text: 'Configuración guardada' }
      await loadSettings()
    }
  } catch (err: any) {
    settingsMessage.value = { type: 'error', text: err.response?.data?.message || 'Error al guardar' }
  } finally {
    isSavingSettings.value = false
  }
}

// Test connection
const testConnection = async () => {
  isTestingConnection.value = true
  settingsMessage.value = null
  try {
    const response = await api.post<any>('/notifications/settings/test')
    settingsMessage.value = { type: 'success', text: response.message || 'Conexión exitosa' }
  } catch (err: any) {
    settingsMessage.value = { type: 'error', text: err.response?.data?.message || 'Error de conexión' }
  } finally {
    isTestingConnection.value = false
  }
}

// Send test email
const sendTestEmailAction = async () => {
  if (!testEmail.value) return
  isSendingTest.value = true
  settingsMessage.value = null
  try {
    const response = await api.post<any>('/notifications/settings/test-email', { email: testEmail.value })
    settingsMessage.value = { type: 'success', text: response.message || 'Email enviado' }
    testEmail.value = ''
  } catch (err: any) {
    settingsMessage.value = { type: 'error', text: err.response?.data?.message || 'Error al enviar' }
  } finally {
    isSendingTest.value = false
  }
}

// Load templates
const loadTemplates = async () => {
    isLoadingTemplates.value = true
  try {
    const [templatesRes, typesRes] = await Promise.all([
      api.get<any>('/notifications/templates'),
      api.get<any>('/notifications/templates/types'),
    ])
    templates.value = templatesRes.data || []
    templateTypes.value = typesRes.data || []
  } catch {
    console.log('Error loading templates')
  } finally {
    isLoadingTemplates.value = false
  }
}

// Toggle active template
const togglingTemplateId = ref<string | null>(null)

const setActiveTemplate = async (template: EmailTemplate) => {
  togglingTemplateId.value = template.id
  try {
    await api.put(`/notifications/templates/${template.id}`, {
      isActive: !template.isActive
    })
    // Reload to get updated active states
    await loadTemplates()
  } catch (err) {
    console.error('Error updating template', err)
  } finally {
    togglingTemplateId.value = null
  }
}

// Preview template
const previewTemplate = async (template: EmailTemplate) => {
  try {
    const response = await api.post<any>(`/notifications/templates/${template.id}/preview`, {
      type: template.type,
    })
    if (response.success) {
      previewHtml.value = response.data.html
      previewSubject.value = response.data.subject
      showPreviewModal.value = true
    }
  } catch (err) {
    console.error('Error previewing template', err)
  }
}

// Preview default template
const previewDefaultTemplate = async (type: string) => {
  try {
    const response = await api.post<any>('/notifications/templates/default/preview', { type })
    if (response.success) {
      previewHtml.value = response.data.html
      previewSubject.value = response.data.subject
      showPreviewModal.value = true
    }
  } catch (err) {
    console.error('Error previewing default template', err)
  }
}

// Delete template - open confirmation modal
const openDeleteModal = (template: EmailTemplate) => {
  templateToDelete.value = template
  showDeleteModal.value = true
}

// Confirm delete template
const confirmDeleteTemplate = async () => {
  if (!templateToDelete.value) return
  isDeletingTemplate.value = true
  try {
    await api.delete(`/notifications/templates/${templateToDelete.value.id}`)
    await loadTemplates()
    showDeleteModal.value = false
    templateToDelete.value = null
  } catch (err) {
    console.error('Error deleting template', err)
  } finally {
    isDeletingTemplate.value = false
  }
}

// Send test with template
const sendTemplateTest = async (templateId: string) => {
  if (!testEmailForTemplate.value) return
  isSendingTemplateTest.value = true
  try {
    await api.post<any>(`/notifications/templates/${templateId}/test`, {
      email: testEmailForTemplate.value,
    })
    testEmailForTemplate.value = ''
  } catch (err) {
    console.error('Error sending test', err)
  } finally {
    isSendingTemplateTest.value = false
  }
}

// Load logs
const loadLogs = async () => {
  isLoadingLogs.value = true
  try {
    const [logsRes, statsRes] = await Promise.all([
      api.get<any>('/notifications/logs'),
      api.get<any>('/notifications/stats'),
    ])
    logs.value = logsRes.data || []
    stats.value = statsRes.data || { total: 0, sent: 0, failed: 0, pending: 0 }
  } catch {
    console.log('Error loading logs')
  } finally {
    isLoadingLogs.value = false
  }
}

// Format date
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Status badge
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'SENT':
      return 'bg-green-100 text-green-700'
    case 'FAILED':
      return 'bg-red-100 text-red-700'
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

// Template type labels
const templateTypeLabels: Record<string, string> = {
  APPOINTMENT_CREATED: 'Cita Confirmada',
  APPOINTMENT_REMINDER_24H: 'Recordatorio 24h',
  APPOINTMENT_REMINDER_1H: 'Recordatorio 1h',
  APPOINTMENT_CANCELLED: 'Cita Cancelada',
  DOCUMENT_SIGNED: 'Documento Firmado',
  CUSTOM: 'Personalizada',
}

// Status labels
const statusLabels: Record<string, string> = {
  SENT: 'Enviado',
  FAILED: 'Fallido',
  PENDING: 'Pendiente',
  BOUNCED: 'Rebotado',
}

onMounted(() => {
  loadSettings()
  loadTemplates()
  loadLogs()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Notificaciones</h1>
        <p class="text-surface-500 mt-1">Configura el envío de correos y plantillas</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-xl border border-surface-200 mb-6">
      <nav class="flex gap-2 p-2">
        <button
          @click="activeTab = 'config'"
          :class="[
            'flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-all',
            activeTab === 'config'
              ? 'bg-primary-50 text-primary-700 shadow-sm'
              : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50',
          ]"
        >
          <Cog6ToothIcon class="w-5 h-5" />
          Configuración
        </button>
        <button
          @click="activeTab = 'templates'"
          :class="[
            'flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-all',
            activeTab === 'templates'
              ? 'bg-primary-50 text-primary-700 shadow-sm'
              : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50',
          ]"
        >
          <DocumentTextIcon class="w-5 h-5" />
          Plantillas
        </button>
        <button
          @click="activeTab = 'logs'"
          :class="[
            'flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-all',
            activeTab === 'logs'
              ? 'bg-primary-50 text-primary-700 shadow-sm'
              : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50',
          ]"
        >
          <ClockIcon class="w-5 h-5" />
          Historial
        </button>
      </nav>
    </div>

    <!-- Config Tab -->
    <div v-if="activeTab === 'config'" class="space-y-6">
      <!-- Status Card -->
      <div class="card p-6">
        <div class="flex items-center gap-4">
          <div
            :class="[
              'w-14 h-14 rounded-xl flex items-center justify-center',
              settings.isConfigured ? 'bg-green-100' : 'bg-amber-100',
            ]"
          >
            <CheckCircleIcon v-if="settings.isConfigured" class="w-7 h-7 text-green-600" />
            <ExclamationCircleIcon v-else class="w-7 h-7 text-amber-600" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-surface-900 text-lg">
              {{ settings.isConfigured ? 'Configurado' : 'Sin configurar' }}
            </h3>
            <p class="text-sm text-surface-500 mt-1">
              {{
                settings.isConfigured
                  ? settings.isEnabled
                    ? 'Las notificaciones están activas'
                    : 'Configurado pero desactivado'
                  : 'Completa la configuración SMTP'
              }}
            </p>
          </div>
          <div>
            <label class="flex items-center gap-3 cursor-pointer bg-surface-50 px-4 py-3 rounded-xl">
              <span class="text-sm font-medium text-surface-600">Activar envío</span>
              <input
                type="checkbox"
                v-model="settings.isEnabled"
                :disabled="!settings.isConfigured"
                class="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
          </div>
        </div>
      </div>

      <!-- SMTP Config Form -->
      <div class="card p-6">
        <h3 class="font-semibold text-surface-900 text-lg mb-5">Configuración SMTP (Gmail)</h3>

        <!-- Help Box -->
        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
          <h4 class="font-medium text-blue-800 mb-2">📧 Cómo obtener la contraseña de aplicación de Gmail</h4>
          <ol class="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Ve a <a href="https://myaccount.google.com" target="_blank" class="underline">myaccount.google.com</a></li>
            <li>Seguridad → Verificación en 2 pasos (actívala si no está)</li>
            <li>Seguridad → Contraseñas de aplicaciones</li>
            <li>Crea una contraseña para "Otro: Clínica Dental"</li>
            <li>Copia los 16 caracteres y pégalos abajo</li>
          </ol>
        </div>

        <form @submit.prevent="saveSettings" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Servidor SMTP</label>
              <input v-model="settings.smtpHost" type="text" class="input" placeholder="smtp.gmail.com" />
              <p class="text-xs text-surface-400 mt-1">Normalmente smtp.gmail.com</p>
            </div>
            <div>
              <label class="label">Puerto</label>
              <input v-model.number="settings.smtpPort" type="number" class="input" placeholder="587" />
              <p class="text-xs text-surface-400 mt-1">587 para TLS, 465 para SSL</p>
            </div>
          </div>

          <div>
            <label class="label">Tu cuenta de Gmail *</label>
            <input v-model="settings.smtpUser" type="email" class="input" placeholder="tuclinica@gmail.com" />
            <p class="text-xs text-surface-400 mt-1">Este email aparecerá como remitente</p>
          </div>

          <div>
            <label class="label">Contraseña de aplicación *</label>
            <input
              v-model="settings.smtpPass"
              type="password"
              class="input"
              placeholder="xxxx xxxx xxxx xxxx"
            />
            <p class="text-xs text-surface-400 mt-1">Los 16 caracteres de la contraseña de aplicación (ver guía arriba)</p>
          </div>

          <div>
            <label class="label">Nombre que aparece al recibir el correo</label>
            <input v-model="settings.fromName" type="text" class="input" placeholder="Clínica Dental Centro" />
            <p class="text-xs text-surface-400 mt-1">Ej: "Clínica Dental Centro" &lt;tuclinica@gmail.com&gt;</p>
          </div>

          <!-- Message -->
          <div
            v-if="settingsMessage"
            :class="[
              'p-3 rounded-lg text-sm',
              settingsMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
            ]"
          >
            {{ settingsMessage.text }}
          </div>

          <!-- Notification Toggles -->
          <div class="border-t border-surface-100 pt-6 mt-6">
            <h3 class="text-lg font-semibold text-surface-900 mb-4">📧 Notificaciones automáticas</h3>
            <p class="text-sm text-surface-500 mb-4">Configura qué notificaciones se envían automáticamente a los pacientes.</p>
            
            <div class="space-y-4">
              <!-- Send on create -->
              <label class="flex items-center gap-3 p-3 bg-surface-50 rounded-xl cursor-pointer hover:bg-surface-100">
                <input 
                  type="checkbox" 
                  v-model="settings.sendOnCreate" 
                  class="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span class="font-medium text-surface-900">Email de confirmación al crear cita</span>
                  <p class="text-xs text-surface-500">Se envía automáticamente cuando se crea o modifica una cita</p>
                </div>
              </label>

              <!-- Send on cancel -->
              <label class="flex items-center gap-3 p-3 bg-surface-50 rounded-xl cursor-pointer hover:bg-surface-100">
                <input 
                  type="checkbox" 
                  v-model="settings.sendOnCancel" 
                  class="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span class="font-medium text-surface-900">Email de cancelación</span>
                  <p class="text-xs text-surface-500">Se envía cuando una cita es cancelada o el paciente no se presenta</p>
                </div>
              </label>

              <!-- Reminder 24h -->
              <label class="flex items-center gap-3 p-3 bg-surface-50 rounded-xl cursor-pointer hover:bg-surface-100">
                <input 
                  type="checkbox" 
                  v-model="settings.reminder24hEnabled" 
                  class="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span class="font-medium text-surface-900">Recordatorio 24 horas antes</span>
                  <p class="text-xs text-surface-500">Se envía un día antes de la cita</p>
                </div>
              </label>

              <!-- Reminder 1h -->
              <label class="flex items-center gap-3 p-3 bg-surface-50 rounded-xl cursor-pointer hover:bg-surface-100">
                <input 
                  type="checkbox" 
                  v-model="settings.reminder1hEnabled" 
                  class="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span class="font-medium text-surface-900">Recordatorio 1 hora antes</span>
                  <p class="text-xs text-surface-500">Se envía una hora antes de la cita</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-4">
            <button type="submit" class="btn-primary" :disabled="isSavingSettings">
              {{ isSavingSettings ? 'Guardando...' : 'Guardar configuración' }}
            </button>
            <button
              type="button"
              @click="testConnection"
              class="btn-secondary"
              :disabled="isTestingConnection || !settings.isConfigured"
            >
              <ArrowPathIcon v-if="isTestingConnection" class="w-4 h-4 animate-spin" />
              {{ isTestingConnection ? 'Probando...' : 'Probar conexión' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Test Email -->
      <div class="card p-6" v-if="settings.isConfigured">
        <h3 class="font-semibold text-surface-900 text-lg mb-4">Enviar email de prueba</h3>
        <div class="flex gap-3">
          <input
            v-model="testEmail"
            type="email"
            class="input flex-1"
            placeholder="email@prueba.com"
          />
          <button
            @click="sendTestEmailAction"
            class="btn-primary"
            :disabled="isSendingTest || !testEmail"
          >
            <PaperAirplaneIcon class="w-4 h-4" />
            {{ isSendingTest ? 'Enviando...' : 'Enviar prueba' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Templates Tab -->
    <div v-if="activeTab === 'templates'" class="space-y-6">
      <!-- Available Template Types -->
      <div class="card p-6">
        <h3 class="font-semibold text-surface-900 text-lg mb-5">Tipos de plantilla disponibles</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div
            v-for="type in templateTypes"
            :key="type.value"
            class="flex items-center justify-between p-3 bg-surface-50 rounded-xl"
          >
            <span class="text-sm font-medium text-surface-700">{{ type.label }}</span>
            <button
              @click="previewDefaultTemplate(type.value)"
              class="text-primary-600 hover:text-primary-700"
              title="Ver plantilla por defecto"
            >
              <EyeIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
        <p class="text-xs text-surface-500 mt-3">
          Si no creas una plantilla personalizada, se usará la plantilla por defecto del sistema.
        </p>
      </div>

      <!-- Custom Templates -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-semibold text-surface-900 text-lg">Plantillas personalizadas</h3>
          <router-link to="/clinic/notifications/editor" class="btn-primary btn-sm">
            <PlusIcon class="w-4 h-4" />
            Nueva plantilla
          </router-link>
        </div>

        <div v-if="isLoadingTemplates" class="flex justify-center py-8">
          <ArrowPathIcon class="w-6 h-6 animate-spin text-primary-600" />
        </div>

        <div v-else-if="templates.length === 0" class="text-center py-8 text-surface-500">
          No hay plantillas personalizadas. Se usarán las plantillas por defecto.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="template in templates"
            :key="template.id"
            :class="[
              'flex items-center justify-between p-4 rounded-xl transition-all',
              template.isActive ? 'bg-primary-50 border-2 border-primary-200' : 'bg-surface-50 border-2 border-transparent'
            ]"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-surface-900">{{ template.name }}</h4>
                <span 
                  v-if="template.isActive" 
                  class="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full"
                >
                  ✓ Activa
                </span>
              </div>
              <p class="text-sm text-surface-500">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-200 text-surface-700 mr-2">
                  {{ templateTypeLabels[template.type] || template.type }}
                </span>
                {{ template.subject }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <!-- Active toggle -->
              <button
                @click="setActiveTemplate(template)"
                :disabled="togglingTemplateId === template.id"
                :class="[
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                  template.isActive 
                    ? 'bg-primary-600 text-white hover:bg-primary-700' 
                    : 'bg-surface-200 text-surface-600 hover:bg-surface-300'
                ]"
                :title="template.isActive ? 'Desactivar plantilla' : 'Usar esta plantilla'"
              >
                {{ togglingTemplateId === template.id ? '...' : (template.isActive ? 'Activa' : 'Activar') }}
              </button>
              <router-link
                :to="`/clinic/notifications/editor/${template.id}`"
                class="p-2 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-primary-50"
                title="Editar"
              >
                <PencilSquareIcon class="w-4 h-4" />
              </router-link>
              <button
                @click="previewTemplate(template)"
                class="p-2 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-primary-50"
                title="Vista previa"
              >
                <EyeIcon class="w-4 h-4" />
              </button>
              <button
                @click="openDeleteModal(template)"
                class="p-2 text-surface-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                title="Eliminar"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Logs Tab -->
    <div v-if="activeTab === 'logs'" class="space-y-6">
      <!-- Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="card p-6 text-center">
          <p class="text-3xl font-bold text-surface-900">{{ stats.total }}</p>
          <p class="text-sm text-surface-500 mt-1">Total</p>
        </div>
        <div class="card p-6 text-center">
          <p class="text-3xl font-bold text-green-600">{{ stats.sent }}</p>
          <p class="text-sm text-surface-500 mt-1">Enviados</p>
        </div>
        <div class="card p-6 text-center">
          <p class="text-3xl font-bold text-red-600">{{ stats.failed }}</p>
          <p class="text-sm text-surface-500 mt-1">Fallidos</p>
        </div>
        <div class="card p-6 text-center">
          <p class="text-3xl font-bold text-amber-600">{{ stats.pending }}</p>
          <p class="text-sm text-surface-500 mt-1">Pendientes</p>
        </div>
      </div>

      <!-- Logs Table -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-semibold text-surface-900 text-lg">Historial de envíos</h3>
          <button @click="loadLogs" class="btn-secondary btn-sm">
            <ArrowPathIcon class="w-4 h-4" />
            Actualizar
          </button>
        </div>

        <div v-if="isLoadingLogs" class="flex justify-center py-8">
          <ArrowPathIcon class="w-6 h-6 animate-spin text-primary-600" />
        </div>

        <div v-else-if="logs.length === 0" class="text-center py-8 text-surface-500">
          No hay notificaciones enviadas aún.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-surface-100">
                <th class="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Destinatario</th>
                <th class="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Tipo</th>
                <th class="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Asunto</th>
                <th class="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Estado</th>
                <th class="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id" class="border-b border-surface-50 hover:bg-surface-50">
                <td class="py-3 px-4">
                  <p class="font-medium text-surface-900">
                    {{ log.patient ? `${log.patient.firstName} ${log.patient.lastName}` : 'Prueba' }}
                  </p>
                  <p class="text-xs text-surface-500">{{ log.recipient }}</p>
                </td>
                <td class="py-3 px-4 text-sm text-surface-600">
                  {{ templateTypeLabels[log.templateType] || log.templateType }}
                </td>
                <td class="py-3 px-4 text-sm text-surface-600 max-w-xs truncate">
                  {{ log.subject }}
                </td>
                <td class="py-3 px-4">
                  <span
                    :class="['px-2 py-1 rounded-full text-xs font-medium', getStatusBadge(log.status)]"
                  >
                    {{ statusLabels[log.status] || log.status }}
                  </span>
                </td>
                <td class="py-3 px-4 text-sm text-surface-500">
                  {{ formatDate(log.sentAt || log.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <Teleport to="body">
      <div v-if="showPreviewModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showPreviewModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <div>
              <h2 class="text-lg font-semibold text-surface-900">Vista previa</h2>
              <p class="text-sm text-surface-500">{{ previewSubject }}</p>
            </div>
            <button @click="showPreviewModal = false" class="text-surface-400 hover:text-surface-600">
              ✕
            </button>
          </div>
          <div class="p-6 overflow-y-auto max-h-[70vh]">
            <div class="border border-surface-200 rounded-xl overflow-hidden">
              <div v-html="previewHtml"></div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Template Modal -->
    <Teleport to="body">
      <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showTemplateModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ editingTemplate ? 'Editar plantilla' : 'Nueva plantilla' }}
            </h2>
            <button @click="showTemplateModal = false" class="text-surface-400 hover:text-surface-600">
              ✕
            </button>
          </div>
          <form @submit.prevent="saveTemplate" class="p-6 space-y-4">
            <div>
              <label class="label">Tipo de notificación *</label>
              <select 
                v-model="templateForm.type" 
                @change="onTemplateTypeChange"
                class="input"
                :disabled="!!editingTemplate"
              >
                <option v-for="t in templateTypes" :key="t.value" :value="t.value">
                  {{ t.label }}
                </option>
              </select>
            </div>

            <div>
              <label class="label">Nombre de la plantilla *</label>
              <input 
                v-model="templateForm.name" 
                type="text" 
                class="input" 
                placeholder="Ej: Confirmación de cita personalizada"
              />
            </div>

            <div>
              <label class="label">Asunto del email *</label>
              <input 
                v-model="templateForm.subject" 
                type="text" 
                class="input" 
                placeholder="Ej: Tu cita ha sido confirmada"
              />
              <p class="text-xs text-surface-400 mt-1" v-pre>
                Variables: {{patient_name}}, {{appointment_date}}, {{clinic_name}}
              </p>
            </div>

            <div class="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p class="text-sm text-blue-700">
                💡 La plantilla usará el diseño por defecto del tipo seleccionado. 
                Puedes personalizar solo el asunto.
              </p>
            </div>

            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showTemplateModal = false" class="btn-secondary">
                Cancelar
              </button>
              <button 
                type="submit" 
                class="btn-primary"
                :disabled="isSavingTemplate || !templateForm.name || !templateForm.subject"
              >
                {{ isSavingTemplate ? 'Guardando...' : (editingTemplate ? 'Guardar cambios' : 'Crear plantilla') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showDeleteModal = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div class="text-center">
            <div class="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <TrashIcon class="w-6 h-6 text-red-600" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">¿Eliminar plantilla?</h3>
            <p class="text-sm text-surface-500 mb-6">
              Esta acción no se puede deshacer. La plantilla 
              <strong>{{ templateToDelete?.name }}</strong> 
              será eliminada permanentemente.
            </p>
            <div class="flex gap-3 justify-center">
              <button
                @click="showDeleteModal = false"
                class="btn-secondary"
                :disabled="isDeletingTemplate"
              >
                Cancelar
              </button>
              <button
                @click="confirmDeleteTemplate"
                class="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
                :disabled="isDeletingTemplate"
              >
                {{ isDeletingTemplate ? 'Eliminando...' : 'Eliminar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
