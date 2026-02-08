<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/services/api'
import {
  DevicePhoneMobileIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline'

interface SmsSettings {
  id?: string
  accountSid: string
  authToken: string
  fromNumber: string
  isEnabled: boolean
  isConfigured: boolean
  sendOnCreate: boolean
  sendOnCancel: boolean
  reminder24hEnabled: boolean
  reminder1hEnabled: boolean
}

interface SmsTemplate {
  id: string
  type: string
  name: string
  content: string
  isActive: boolean
  isDefault?: boolean
}

// Tabs
const activeTab = ref<'config' | 'templates'>('config')

// Settings state
const settings = ref<SmsSettings>({
  accountSid: '',
  authToken: '',
  fromNumber: '',
  isEnabled: false,
  isConfigured: false,
  sendOnCreate: true,
  sendOnCancel: true,
  reminder24hEnabled: true,
  reminder1hEnabled: true,
})
const isSavingSettings = ref(false)
const isTestingConnection = ref(false)
const testPhone = ref('')
const isSendingTest = ref(false)
const settingsMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Templates state
const templates = ref<SmsTemplate[]>([])
const defaultTemplates = ref<SmsTemplate[]>([])
const isLoadingTemplates = ref(false)
const showTemplateModal = ref(false)
const editingTemplate = ref<SmsTemplate | null>(null)
const templateForm = ref({
  type: 'APPOINTMENT_CREATED',
  name: '',
  content: '',
  isActive: true,
})
const isSavingTemplate = ref(false)

// Template types
const templateTypes = [
  { value: 'APPOINTMENT_CREATED', label: 'Cita Confirmada' },
  { value: 'APPOINTMENT_REMINDER_24H', label: 'Recordatorio 24h' },
  { value: 'APPOINTMENT_REMINDER_1H', label: 'Recordatorio 1h' },
  { value: 'APPOINTMENT_CANCELLED', label: 'Cita Cancelada' },
  { value: 'CUSTOM', label: 'Personalizada' },
]

// Load settings
const loadSettings = async () => {
  try {
    const response = await api.get<any>('/sms/settings')
    if (response.data) {
      settings.value = { ...settings.value, ...response.data }
    }
  } catch (err) {
    console.error('Error loading SMS settings', err)
  }
}

// Save settings
const saveSettings = async () => {
  isSavingSettings.value = true
  settingsMessage.value = null
  try {
    const response = await api.put<any>('/sms/settings', settings.value)
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
    const response = await api.post<any>('/sms/settings/test')
    settingsMessage.value = { type: 'success', text: response.message || 'Conexión exitosa con Twilio' }
  } catch (err: any) {
    settingsMessage.value = { type: 'error', text: err.response?.data?.message || 'Error de conexión' }
  } finally {
    isTestingConnection.value = false
  }
}

// Send test SMS
const sendTestSms = async () => {
  if (!testPhone.value) return
  isSendingTest.value = true
  settingsMessage.value = null
  try {
    const response = await api.post<any>('/sms/settings/test-sms', { phone: testPhone.value })
    settingsMessage.value = { type: 'success', text: response.message || 'SMS enviado' }
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
    const [templatesRes, defaultsRes] = await Promise.all([
      api.get<any>('/sms/templates'),
      api.get<any>('/sms/templates/defaults'),
    ])
    templates.value = templatesRes.data || []
    defaultTemplates.value = defaultsRes.data || []
  } catch (err) {
    console.error('Error loading templates', err)
  } finally {
    isLoadingTemplates.value = false
  }
}

// Open create template modal
const openCreateModal = () => {
  editingTemplate.value = null
  templateForm.value = {
    type: 'APPOINTMENT_CREATED',
    name: '',
    content: '',
    isActive: true,
  }
  showTemplateModal.value = true
}

// Open edit template modal
const openEditModal = (template: SmsTemplate) => {
  editingTemplate.value = template
  templateForm.value = {
    type: template.type,
    name: template.name,
    content: template.content,
    isActive: template.isActive,
  }
  showTemplateModal.value = true
}

// Save template
const saveTemplate = async () => {
  isSavingTemplate.value = true
  try {
    if (editingTemplate.value) {
      await api.put(`/sms/templates/${editingTemplate.value.id}`, templateForm.value)
    } else {
      await api.post('/sms/templates', templateForm.value)
    }
    showTemplateModal.value = false
    await loadTemplates()
  } catch (err: any) {
    console.error('Error saving template', err)
  } finally {
    isSavingTemplate.value = false
  }
}

// Delete template
const showDeleteModal = ref(false)
const templateToDelete = ref<SmsTemplate | null>(null)
const isDeletingTemplate = ref(false)

const openDeleteModal = (template: SmsTemplate) => {
  templateToDelete.value = template
  showDeleteModal.value = true
}

const confirmDeleteTemplate = async () => {
  if (!templateToDelete.value) return
  isDeletingTemplate.value = true
  try {
    await api.delete(`/sms/templates/${templateToDelete.value.id}`)
    showDeleteModal.value = false
    await loadTemplates()
  } catch (err) {
    console.error('Error deleting template', err)
  } finally {
    isDeletingTemplate.value = false
  }
}

// Format template type label
const getTypeLabel = (type: string) => {
  return templateTypes.find(t => t.value === type)?.label || type
}

// On mount
onMounted(async () => {
  await loadSettings()
  await loadTemplates()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <div class="p-3 bg-emerald-100 rounded-xl">
        <DevicePhoneMobileIcon class="w-8 h-8 text-emerald-600" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">SMS (Twilio)</h1>
        <p class="text-surface-500">Configura notificaciones SMS para tus pacientes</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-xl border border-surface-200">
      <nav class="flex gap-2 p-2">
        <button
          @click="activeTab = 'config'"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'config' ? 'bg-emerald-100 text-emerald-700' : 'text-surface-600 hover:bg-surface-100'
          ]"
        >
          <Cog6ToothIcon class="w-5 h-5" />
          Configuración
        </button>
        <button
          @click="activeTab = 'templates'"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'templates' ? 'bg-emerald-100 text-emerald-700' : 'text-surface-600 hover:bg-surface-100'
          ]"
        >
          <DocumentTextIcon class="w-5 h-5" />
          Plantillas
        </button>
      </nav>
    </div>

    <!-- Config Tab -->
    <div v-if="activeTab === 'config'" class="space-y-6">
      <!-- Twilio Settings -->
      <div class="card p-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">Configuración Twilio</h2>
        
        <!-- Twilio Setup Guide -->
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 class="font-semibold text-blue-700 mb-2">📱 Cómo configurar Twilio</h3>
          <ol class="text-sm text-blue-600 space-y-1 list-decimal list-inside">
            <li>Ve a <a href="https://console.twilio.com" target="_blank" class="underline hover:text-blue-800">console.twilio.com</a> y crea una cuenta (o inicia sesión)</li>
            <li>En el Dashboard, copia el <strong>Account SID</strong> y <strong>Auth Token</strong></li>
            <li>Para el remitente tienes dos opciones:</li>
          </ol>
          <div class="mt-2 ml-4 space-y-2">
            <div class="bg-white/60 rounded-lg p-2">
              <p class="text-sm font-medium text-blue-700">Opción A: Sender ID (recomendado para España)</p>
              <p class="text-xs text-blue-600">Usa un nombre como "CLINICA" o "DentalERP" (máx. 11 caracteres). No necesitas comprar número, pero los pacientes no pueden responder.</p>
            </div>
            <div class="bg-white/60 rounded-lg p-2">
              <p class="text-sm font-medium text-blue-700">Opción B: Número de teléfono</p>
              <p class="text-xs text-blue-600">Compra un número en Phone Numbers → Buy a number. Permite respuestas, pero es más costoso.</p>
            </div>
          </div>
          <p class="text-xs text-blue-500 mt-3">💡 Para España, Sender ID es la opción más práctica y económica.</p>
        </div>
        
        <!-- Status Badge -->
        <div class="flex items-center gap-2 mb-4">
          <span
            :class="[
              'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
              settings.isConfigured ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            ]"
          >
            <CheckCircleIcon v-if="settings.isConfigured" class="w-4 h-4" />
            <ExclamationCircleIcon v-else class="w-4 h-4" />
            {{ settings.isConfigured ? 'Configurado' : 'Sin configurar' }}
          </span>
        </div>

        <form @submit.prevent="saveSettings" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="label">Account SID</label>
              <input v-model="settings.accountSid" type="text" class="input" placeholder="ACxxxxxxxx" />
            </div>
            <div>
              <label class="label">Auth Token</label>
              <input v-model="settings.authToken" type="password" class="input" placeholder="••••••••" />
            </div>
            <div>
              <label class="label">Remitente (Sender ID o Número)</label>
              <input 
                v-model="settings.fromNumber" 
                type="text" 
                class="input" 
                placeholder="CLINICA o +34xxxxxxxxx"
              />
              <p class="text-xs text-surface-400 mt-1">Sender ID: máx. 11 caracteres alfanuméricos. Número: formato +34...</p>
            </div>
            <div class="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                v-model="settings.isEnabled"
                id="smsEnabled"
                class="w-4 h-4 text-emerald-600 rounded"
              />
              <label for="smsEnabled" class="text-sm text-surface-700">Activar envío de SMS</label>
            </div>
          </div>

          <!-- Message -->
          <div
            v-if="settingsMessage"
            :class="[
              'p-3 rounded-lg text-sm',
              settingsMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            ]"
          >
            {{ settingsMessage.text }}
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3">
            <button type="submit" class="btn-primary" :disabled="isSavingSettings">
              {{ isSavingSettings ? 'Guardando...' : 'Guardar configuración' }}
            </button>
            <button
              type="button"
              @click="testConnection"
              class="btn-secondary"
              :disabled="!settings.isConfigured || isTestingConnection"
            >
              <ArrowPathIcon v-if="isTestingConnection" class="w-4 h-4 animate-spin" />
              {{ isTestingConnection ? 'Probando...' : 'Probar conexión' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Notification Toggles -->
      <div class="card p-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">Notificaciones automáticas</h2>
        <p class="text-sm text-surface-500 mb-4">Configura qué SMS se envían automáticamente a los pacientes.</p>

        <div class="space-y-3">
          <label class="flex items-center gap-3 p-3 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
            <input type="checkbox" v-model="settings.sendOnCreate" class="w-4 h-4 text-emerald-600 rounded" />
            <div>
              <span class="font-medium text-surface-900">SMS de confirmación al crear cita</span>
              <p class="text-xs text-surface-500">Se envía automáticamente cuando se crea una cita</p>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
            <input type="checkbox" v-model="settings.sendOnCancel" class="w-4 h-4 text-emerald-600 rounded" />
            <div>
              <span class="font-medium text-surface-900">SMS de cancelación</span>
              <p class="text-xs text-surface-500">Se envía cuando se cancela una cita</p>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
            <input type="checkbox" v-model="settings.reminder24hEnabled" class="w-4 h-4 text-emerald-600 rounded" />
            <div>
              <span class="font-medium text-surface-900">Recordatorio 24 horas antes</span>
              <p class="text-xs text-surface-500">Se envía un día antes de la cita</p>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
            <input type="checkbox" v-model="settings.reminder1hEnabled" class="w-4 h-4 text-emerald-600 rounded" />
            <div>
              <span class="font-medium text-surface-900">Recordatorio 1 hora antes</span>
              <p class="text-xs text-surface-500">Se envía una hora antes de la cita</p>
            </div>
          </label>
        </div>

        <div class="mt-4">
          <button @click="saveSettings" class="btn-primary" :disabled="isSavingSettings">
            Guardar configuración
          </button>
        </div>
      </div>

      <!-- Test SMS -->
      <div class="card p-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">Enviar SMS de prueba</h2>
        <div class="flex gap-3">
          <input
            v-model="testPhone"
            type="tel"
            class="input flex-1"
            placeholder="+34xxxxxxxxx"
          />
          <button
            @click="sendTestSms"
            class="btn-primary flex items-center gap-2"
            :disabled="!testPhone || !settings.isConfigured || isSendingTest"
          >
            <PaperAirplaneIcon class="w-4 h-4" />
            {{ isSendingTest ? 'Enviando...' : 'Enviar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Templates Tab -->
    <div v-if="activeTab === 'templates'" class="space-y-6">
      <!-- Custom Templates -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-surface-900">Plantillas personalizadas</h2>
          <button @click="openCreateModal" class="btn-primary flex items-center gap-2">
            <PlusIcon class="w-4 h-4" />
            Nueva plantilla
          </button>
        </div>

        <div v-if="isLoadingTemplates" class="text-center py-8 text-surface-400">
          Cargando plantillas...
        </div>

        <div v-else-if="templates.length === 0" class="text-center py-8 text-surface-400">
          No hay plantillas personalizadas. Usa las plantillas por defecto o crea una nueva.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="template in templates"
            :key="template.id"
            class="flex items-center justify-between p-4 bg-surface-50 rounded-xl"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-surface-900">{{ template.name }}</span>
                <span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                  {{ getTypeLabel(template.type) }}
                </span>
              </div>
              <p class="text-sm text-surface-500 mt-1 truncate">{{ template.content }}</p>
            </div>
            <div class="flex items-center gap-2 ml-4">
              <button
                @click="openEditModal(template)"
                class="p-2 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-primary-50"
              >
                <PencilSquareIcon class="w-4 h-4" />
              </button>
              <button
                @click="openDeleteModal(template)"
                class="p-2 text-surface-400 hover:text-red-600 rounded-lg hover:bg-red-50"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Default Templates -->
      <div class="card p-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">Plantillas por defecto</h2>
        <div class="space-y-3">
          <div
            v-for="template in defaultTemplates"
            :key="template.type"
            class="p-4 bg-surface-50 rounded-xl"
          >
            <div class="flex items-center gap-2 mb-2">
              <span class="font-medium text-surface-900">{{ template.name }}</span>
              <span class="px-2 py-0.5 bg-surface-200 text-surface-600 text-xs rounded-full">Por defecto</span>
            </div>
            <p class="text-sm text-surface-500">{{ template.content }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Template Modal -->
    <Teleport to="body">
      <div
        v-if="showTemplateModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showTemplateModal = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <div class="p-6 border-b border-surface-200">
            <h3 class="text-lg font-semibold">
              {{ editingTemplate ? 'Editar plantilla' : 'Nueva plantilla SMS' }}
            </h3>
          </div>
          <form @submit.prevent="saveTemplate" class="p-6 space-y-4">
            <div>
              <label class="label">Tipo de notificación</label>
              <select v-model="templateForm.type" class="input">
                <option v-for="type in templateTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="label">Nombre</label>
              <input v-model="templateForm.name" type="text" class="input" placeholder="Ej: Mi recordatorio" />
            </div>
            <div>
              <label class="label">Contenido del SMS</label>
              <textarea
                v-model="templateForm.content"
                rows="4"
                class="input"
                placeholder="Hola {{patient_name}}, tu cita es..."
              ></textarea>
              <p class="text-xs text-surface-400 mt-1">
                Variables: &#123;&#123;patient_name&#125;&#125;, &#123;&#123;appointment_date&#125;&#125;, &#123;&#123;appointment_time&#125;&#125;, &#123;&#123;clinic_name&#125;&#125;, &#123;&#123;clinic_phone&#125;&#125;
              </p>
              <p class="text-xs text-surface-400">
                Caracteres: {{ templateForm.content.length }}/160 (recomendado)
              </p>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" v-model="templateForm.isActive" id="templateActive" class="w-4 h-4" />
              <label for="templateActive" class="text-sm">Activar plantilla</label>
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showTemplateModal = false" class="btn-secondary">
                Cancelar
              </button>
              <button type="submit" class="btn-primary" :disabled="isSavingTemplate">
                {{ isSavingTemplate ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showDeleteModal = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
          <div class="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <TrashIcon class="w-6 h-6 text-red-600" />
          </div>
          <h3 class="text-lg font-semibold text-surface-900 mb-2">¿Eliminar plantilla?</h3>
          <p class="text-sm text-surface-500 mb-6">
            Esta acción no se puede deshacer. La plantilla 
            <strong>{{ templateToDelete?.name }}</strong> será eliminada.
          </p>
          <div class="flex gap-3 justify-center">
            <button @click="showDeleteModal = false" class="btn-secondary" :disabled="isDeletingTemplate">
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
    </Teleport>
  </div>
</template>
