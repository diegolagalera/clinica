<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '@/services/api'
import { getTenantSlug } from '@/utils/tenant'
import { useToast } from '@/composables/useToast'
import {
  Cog6ToothIcon,
  KeyIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PhoneIcon,
  ArrowLeftIcon,
} from '@heroicons/vue/24/outline'

const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const testResult = ref<any>(null)

const form = ref({
  phoneNumberId: '',
  accessToken: '',
  businessAccountId: '',
  webhookVerifyToken: '',
  systemPrompt: '',
  autoReplyEnabled: true,
  inactivityTimeoutHours: 24,
  isEnabled: false,
})

const testPhone = ref('')
const isConfigured = ref(false)

// Dynamic webhook callback URL with tenant slug
const tenantSlug = getTenantSlug()
const webhookCallbackUrl = computed(() =>
  `https://cuspia.com/api/v1/whatsapp/webhook/${tenantSlug || 'tu-empresa'}`
)

// WA Notification settings
const waNotifyForm = ref<Record<string, any>>({
  waNotifyEnabled: false,
  waTemplateCreated: '',
  waTemplateMappingCreated: {} as Record<string, string>,
  waTemplateModified: '',
  waTemplateMappingModified: {} as Record<string, string>,
  waTemplateCancelled: '',
  waTemplateMappingCancelled: {} as Record<string, string>,
  waTemplateReminder24h: '',
  waTemplateMappingReminder24h: {} as Record<string, string>,
  waTemplateReminder1h: '',
  waTemplateMappingReminder1h: {} as Record<string, string>,
  waReminder24hEnabled: false,
  waReminder1hEnabled: false,
})
const waTemplates = ref<Array<{ name: string; status: string; language: string; components?: any[] }>>([])
const savingWaNotify = ref(false)

// System variables available for template mapping
const SYSTEM_VARIABLES = [
  { key: 'patient_name', label: 'Nombre del paciente', example: 'Juan García' },
  { key: 'appointment_date', label: 'Fecha de la cita', example: 'lunes, 10 de febrero de 2026' },
  { key: 'appointment_time', label: 'Hora de la cita', example: '18:30' },
  { key: 'clinic_name', label: 'Nombre de la clínica', example: 'Clínica Dental Ejemplo' },
  { key: 'doctor_name', label: 'Nombre del profesional', example: 'Dr. López' },
  { key: 'clinic_phone', label: 'Teléfono de la clínica', example: '+34912345678' },
]

// Get template body text from loaded templates
const getTemplateBody = (templateName: string): string => {
  if (!templateName) return ''
  const tpl = waTemplates.value.find(t => t.name === templateName)
  if (!tpl?.components) return ''
  const body = tpl.components.find((c: any) => c.type === 'BODY')
  return body?.text || ''
}

// Extract {{N}} placeholders from template body
const getTemplatePlaceholders = (templateName: string): string[] => {
  const body = getTemplateBody(templateName)
  if (!body) return []
  const matches = body.match(/\{\{\d+\}\}/g)
  return matches ? [...new Set(matches)].sort((a, b) => parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, ''))) : []
}

// Check if all event types with selected templates have complete mappings
const waNotifyValid = computed(() => {
  const eventTypes = [
    { template: 'waTemplateCreated', mapping: 'waTemplateMappingCreated' },
    { template: 'waTemplateModified', mapping: 'waTemplateMappingModified' },
    { template: 'waTemplateCancelled', mapping: 'waTemplateMappingCancelled' },
  ]
  // Check reminders too
  if (waNotifyForm.value.waReminder24hEnabled) {
    eventTypes.push({ template: 'waTemplateReminder24h', mapping: 'waTemplateMappingReminder24h' })
  }
  if (waNotifyForm.value.waReminder1hEnabled) {
    eventTypes.push({ template: 'waTemplateReminder1h', mapping: 'waTemplateMappingReminder1h' })
  }

  for (const { template, mapping } of eventTypes) {
    const tplName = waNotifyForm.value[template]
    if (!tplName) continue
    const placeholders = getTemplatePlaceholders(tplName)
    const currentMapping = waNotifyForm.value[mapping] || {}
    for (const ph of placeholders) {
      const num = ph.replace(/\D/g, '')
      if (!currentMapping[num]) return false
    }
  }
  return true
})

// Handle template change — reset mapping if template changes
const onTemplateChange = (mappingKey: string) => {
  waNotifyForm.value[mappingKey] = {}
}

const fetchSettings = async () => {
  loading.value = true
  try {
    const res = await api.get<any>('/chatbot/settings')
    if (res.data) {
      form.value.phoneNumberId = res.data.phoneNumberId || ''
      form.value.accessToken = res.data.accessToken || ''
      form.value.businessAccountId = res.data.businessAccountId || ''
      form.value.webhookVerifyToken = res.data.webhookVerifyToken || ''
      form.value.systemPrompt = res.data.systemPrompt || ''
      form.value.autoReplyEnabled = res.data.autoReplyEnabled ?? true
      form.value.inactivityTimeoutHours = res.data.inactivityTimeoutHours || 24
      form.value.isEnabled = res.data.isEnabled ?? false
      isConfigured.value = res.data.isConfigured ?? false
    }
  } catch (err: any) {
    console.error('Failed to load settings', err)
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  if (form.value.isEnabled && !form.value.businessAccountId) {
    toast.error('El Business Account ID es obligatorio para habilitar el chatbot')
    return
  }

  saving.value = true
  try {
    const res = await api.put<any>('/chatbot/settings', form.value)
    const wasConfigured = isConfigured.value
    isConfigured.value = res.data?.isConfigured ?? false
    toast.success('Configuración guardada correctamente')
    // If just became configured, load templates & notification settings
    if (!wasConfigured && isConfigured.value) {
      fetchWaNotifySettings()
      fetchWaTemplates()
    }
  } catch (err: any) {
    toast.error('Error al guardar configuración')
  } finally {
    saving.value = false
  }
}

const testConnection = async () => {
  if (!testPhone.value) {
    toast.error('Introduce un número de teléfono para enviar el test')
    return
  }
  testing.value = true
  testResult.value = null
  try {
    const res = await api.post<any>('/chatbot/settings/test', { testPhone: testPhone.value })
    testResult.value = res.data
  } catch (err: any) {
    testResult.value = { success: false, error: err.message }
  } finally {
    testing.value = false
  }
}



const fetchWaNotifySettings = async () => {
  try {
    const res = await api.get<any>('/chatbot/settings/wa-notifications')
    if (res.data) {
      waNotifyForm.value.waNotifyEnabled = res.data.waNotifyEnabled ?? false
      waNotifyForm.value.waTemplateCreated = res.data.waTemplateCreated || ''
      waNotifyForm.value.waTemplateMappingCreated = res.data.waTemplateMappingCreated || {}
      waNotifyForm.value.waTemplateModified = res.data.waTemplateModified || ''
      waNotifyForm.value.waTemplateMappingModified = res.data.waTemplateMappingModified || {}
      waNotifyForm.value.waTemplateCancelled = res.data.waTemplateCancelled || ''
      waNotifyForm.value.waTemplateMappingCancelled = res.data.waTemplateMappingCancelled || {}
      waNotifyForm.value.waTemplateReminder24h = res.data.waTemplateReminder24h || ''
      waNotifyForm.value.waTemplateMappingReminder24h = res.data.waTemplateMappingReminder24h || {}
      waNotifyForm.value.waTemplateReminder1h = res.data.waTemplateReminder1h || ''
      waNotifyForm.value.waTemplateMappingReminder1h = res.data.waTemplateMappingReminder1h || {}
      waNotifyForm.value.waReminder24hEnabled = res.data.waReminder24hEnabled ?? false
      waNotifyForm.value.waReminder1hEnabled = res.data.waReminder1hEnabled ?? false
    }
  } catch { /* ignore */ }
}

const fetchWaTemplates = async () => {
  try {
    const res = await api.get<any>('/chatbot/templates')
    waTemplates.value = (res.data || []).filter((t: any) => t.status === 'APPROVED')
  } catch { waTemplates.value = [] }
}

const saveWaNotifySettings = async () => {
  savingWaNotify.value = true
  try {
    await api.put('/chatbot/settings/wa-notifications', waNotifyForm.value)
    toast.success('Configuración de notificaciones guardada')
  } catch {
    toast.error('Error al guardar configuración de notificaciones')
  } finally {
    savingWaNotify.value = false
  }
}

onMounted(async () => {
  await fetchSettings()
  // Only fetch templates & notification settings if WhatsApp is already configured
  if (isConfigured.value) {
    fetchWaNotifySettings()
    fetchWaTemplates()
  }
})
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <router-link to="/clinic/whatsapp" class="p-2 hover:bg-surface-100 rounded-lg">
        <ArrowLeftIcon class="w-5 h-5 text-surface-500" />
      </router-link>
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
          <Cog6ToothIcon class="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-surface-900">Configuración WhatsApp</h1>
          <p class="text-xs text-surface-500">API Cloud de Meta Business</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <ArrowPathIcon class="w-8 h-8 text-surface-400 animate-spin" />
    </div>

    <template v-else>
      <!-- Status Banner -->
      <div :class="[
        'rounded-xl p-4 flex items-center gap-3',
        isConfigured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
      ]">
        <component :is="isConfigured ? CheckCircleIcon : ExclamationTriangleIcon"
          :class="['w-6 h-6', isConfigured ? 'text-green-600' : 'text-amber-600']"
        />
        <div>
          <p :class="['font-medium text-sm', isConfigured ? 'text-green-800' : 'text-amber-800']">
            {{ isConfigured ? 'WhatsApp configurado correctamente' : 'WhatsApp aún no configurado' }}
          </p>
          <p :class="['text-xs', isConfigured ? 'text-green-600' : 'text-amber-600']">
            {{ isConfigured ? 'El chatbot está listo para recibir mensajes.' : 'Introduce las credenciales de tu cuenta de Meta Business.' }}
          </p>
        </div>
      </div>

      <!-- API Credentials Card -->
      <div class="card">
        <div class="p-5 border-b border-surface-100">
          <div class="flex items-center gap-2">
            <KeyIcon class="w-5 h-5 text-surface-500" />
            <h2 class="font-semibold text-surface-900">Credenciales API</h2>
          </div>
          <p class="text-xs text-surface-500 mt-1">Obtenlas desde tu panel de Meta for Developers → WhatsApp → API Setup</p>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Phone Number ID</label>
            <input v-model="form.phoneNumberId" type="text" class="input w-full" placeholder="Ej: 123456789012345" />
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Access Token</label>
            <input v-model="form.accessToken" type="password" class="input w-full" placeholder="Ej: EAAG..." />
            <p class="text-xs text-surface-400 mt-1">Token permanente de tu app de Meta. Se almacena encriptado.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Business Account ID (WABA ID)</label>
            <input v-model="form.businessAccountId" type="text" class="input w-full" placeholder="Ej: 987654321098765" />
            <p class="text-xs text-surface-400 mt-1">
              Es el <strong>WhatsApp Business Account ID</strong>, NO el del Business Manager. 
              <a href="https://business.facebook.com/settings/whatsapp-business-accounts" target="_blank" class="text-primary-600 hover:underline">Ver en Meta</a>.
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Webhook Verify Token</label>
            <input v-model="form.webhookVerifyToken" type="text" class="input w-full" placeholder="Token secreto para verificar webhooks" />
            <p class="text-xs text-surface-400 mt-1">Debe coincidir con el que configures en Meta → Webhook Settings.</p>
            <div class="mt-2 text-xs bg-surface-50 border border-surface-200 rounded p-2 text-surface-600">
              <span class="block mb-1 font-semibold">Callback URL (Producción):</span>
              <code class="font-mono bg-white px-2 py-1 rounded border border-surface-100 block w-full select-all">{{ webhookCallbackUrl }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- AI System Prompt Card -->
      <div class="card">
        <div class="p-5 border-b border-surface-100">
          <div class="flex items-center gap-2">
            <ChatBubbleLeftRightIcon class="w-5 h-5 text-surface-500" />
            <h2 class="font-semibold text-surface-900">Personalidad del Chatbot (IA)</h2>
          </div>
          <p class="text-xs text-surface-500 mt-1">Instrucciones del sistema para la IA. Si se deja vacío, se usa un prompt predeterminado profesional para clínica dental.</p>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">System Prompt</label>
            <textarea
              v-model="form.systemPrompt"
              rows="6"
              class="input w-full resize-y text-sm"
              placeholder="Eres un asistente virtual profesional de una clínica dental..."
            ></textarea>
          </div>
          <div class="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
            <div>
              <p class="text-sm font-medium text-surface-800">Auto-respuesta IA</p>
              <p class="text-xs text-surface-500">La IA responde automáticamente a mensajes nuevos</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="form.autoReplyEnabled" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Timeout inactividad (horas)</label>
            <input v-model.number="form.inactivityTimeoutHours" type="number" min="1" max="168" class="input w-32" />
            <p class="text-xs text-surface-400 mt-1">Cierra la conversación automáticamente tras este periodo sin mensajes.</p>
          </div>
          <div class="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
            <div>
              <p class="text-sm font-medium text-surface-800">Módulo habilitado</p>
              <p class="text-xs text-surface-500">Activa/desactiva el chatbot de WhatsApp para esta clínica</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="form.isEnabled" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end">
        <button @click="saveSettings" class="btn-primary px-6" :disabled="saving">
          {{ saving ? 'Guardando...' : 'Guardar configuración' }}
        </button>
      </div>

      <!-- Test Connection -->
      <div class="card" v-if="isConfigured">
        <div class="p-5 border-b border-surface-100">
          <div class="flex items-center gap-2">
            <PhoneIcon class="w-5 h-5 text-surface-500" />
            <h2 class="font-semibold text-surface-900">Test de Conexión</h2>
          </div>
          <p class="text-xs text-surface-500 mt-1">Envía un mensaje de prueba para verificar que la API funciona.</p>
        </div>
        <div class="p-5 space-y-4">
          <div class="flex gap-2">
            <input v-model="testPhone" type="text" class="input flex-1" placeholder="Número con código país: 34666555444" />
            <button @click="testConnection" class="btn-primary" :disabled="testing">
              {{ testing ? 'Enviando...' : 'Enviar test' }}
            </button>
          </div>
          <div v-if="testResult" :class="['p-3 rounded-lg text-sm', testResult.success ? 'bg-green-50 text-green-700' : 'bg-danger-50 text-danger-700']">
            {{ testResult.success ? '✅ Mensaje de prueba enviado correctamente' : `❌ Error: ${testResult.error}` }}
          </div>
        </div>
      </div>

      <!-- Appointment Notification Settings -->
      <div class="card" v-if="isConfigured">
        <div class="p-5 border-b border-surface-100">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <h2 class="font-semibold text-surface-900">Notificaciones de Citas por WhatsApp</h2>
          </div>
          <p class="text-xs text-surface-500 mt-1">Envía notificaciones automáticas a pacientes vía WhatsApp cuando se crean, modifican o cancelan citas.</p>
        </div>
        <div class="p-5 space-y-5">
          <!-- Enable toggle -->
          <div class="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
            <div>
              <p class="text-sm font-medium text-surface-800">Notificaciones activadas</p>
              <p class="text-xs text-surface-500">Muestra la opción de enviar WhatsApp al crear o editar citas</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="waNotifyForm.waNotifyEnabled" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <template v-if="waNotifyForm.waNotifyEnabled">
            <!-- Event templates -->
            <div class="space-y-4">
              <h3 class="text-sm font-medium text-surface-700">Plantillas por evento</h3>
              
              <!-- Cita creada -->
              <div class="space-y-2">
                <label class="block text-xs font-medium text-surface-600">✅ Cita creada</label>
                <select v-model="waNotifyForm.waTemplateCreated" @change="onTemplateChange('waTemplateMappingCreated')" class="input w-full text-sm">
                  <option value="">Sin plantilla</option>
                  <option v-for="t in waTemplates" :key="t.name" :value="t.name">{{ t.name }} ({{ t.language }})</option>
                </select>
                <!-- Template preview + variable mapping -->
                <div v-if="waNotifyForm.waTemplateCreated && getTemplateBody(waNotifyForm.waTemplateCreated)" class="ml-2 p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-3">
                  <p class="text-xs text-surface-500 font-medium">Vista previa de la plantilla:</p>
                  <p class="text-xs text-surface-700 whitespace-pre-line bg-white p-2 rounded border border-surface-100">{{ getTemplateBody(waNotifyForm.waTemplateCreated) }}</p>
                  <div v-if="getTemplatePlaceholders(waNotifyForm.waTemplateCreated).length" class="space-y-2">
                    <p class="text-xs font-medium text-surface-600">Asignar variables:</p>
                    <div v-for="ph in getTemplatePlaceholders(waNotifyForm.waTemplateCreated)" :key="ph" class="flex items-center gap-2">
                      <span class="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded min-w-[50px] text-center">{{ ph }}</span>
                      <span class="text-xs text-surface-400">=</span>
                      <select v-model="waNotifyForm.waTemplateMappingCreated[ph.replace(/\D/g, '')]" class="input text-xs flex-1">
                        <option value="">— Seleccionar variable —</option>
                        <option v-for="sv in SYSTEM_VARIABLES" :key="sv.key" :value="sv.key">{{ sv.label }} (ej: {{ sv.example }})</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Cita modificada -->
              <div class="space-y-2">
                <label class="block text-xs font-medium text-surface-600">📝 Cita modificada</label>
                <select v-model="waNotifyForm.waTemplateModified" @change="onTemplateChange('waTemplateMappingModified')" class="input w-full text-sm">
                  <option value="">Sin plantilla</option>
                  <option v-for="t in waTemplates" :key="t.name" :value="t.name">{{ t.name }} ({{ t.language }})</option>
                </select>
                <div v-if="waNotifyForm.waTemplateModified && getTemplateBody(waNotifyForm.waTemplateModified)" class="ml-2 p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-3">
                  <p class="text-xs text-surface-500 font-medium">Vista previa de la plantilla:</p>
                  <p class="text-xs text-surface-700 whitespace-pre-line bg-white p-2 rounded border border-surface-100">{{ getTemplateBody(waNotifyForm.waTemplateModified) }}</p>
                  <div v-if="getTemplatePlaceholders(waNotifyForm.waTemplateModified).length" class="space-y-2">
                    <p class="text-xs font-medium text-surface-600">Asignar variables:</p>
                    <div v-for="ph in getTemplatePlaceholders(waNotifyForm.waTemplateModified)" :key="ph" class="flex items-center gap-2">
                      <span class="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded min-w-[50px] text-center">{{ ph }}</span>
                      <span class="text-xs text-surface-400">=</span>
                      <select v-model="waNotifyForm.waTemplateMappingModified[ph.replace(/\D/g, '')]" class="input text-xs flex-1">
                        <option value="">— Seleccionar variable —</option>
                        <option v-for="sv in SYSTEM_VARIABLES" :key="sv.key" :value="sv.key">{{ sv.label }} (ej: {{ sv.example }})</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Cita cancelada -->
              <div class="space-y-2">
                <label class="block text-xs font-medium text-surface-600">❌ Cita cancelada</label>
                <select v-model="waNotifyForm.waTemplateCancelled" @change="onTemplateChange('waTemplateMappingCancelled')" class="input w-full text-sm">
                  <option value="">Sin plantilla</option>
                  <option v-for="t in waTemplates" :key="t.name" :value="t.name">{{ t.name }} ({{ t.language }})</option>
                </select>
                <div v-if="waNotifyForm.waTemplateCancelled && getTemplateBody(waNotifyForm.waTemplateCancelled)" class="ml-2 p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-3">
                  <p class="text-xs text-surface-500 font-medium">Vista previa de la plantilla:</p>
                  <p class="text-xs text-surface-700 whitespace-pre-line bg-white p-2 rounded border border-surface-100">{{ getTemplateBody(waNotifyForm.waTemplateCancelled) }}</p>
                  <div v-if="getTemplatePlaceholders(waNotifyForm.waTemplateCancelled).length" class="space-y-2">
                    <p class="text-xs font-medium text-surface-600">Asignar variables:</p>
                    <div v-for="ph in getTemplatePlaceholders(waNotifyForm.waTemplateCancelled)" :key="ph" class="flex items-center gap-2">
                      <span class="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded min-w-[50px] text-center">{{ ph }}</span>
                      <span class="text-xs text-surface-400">=</span>
                      <select v-model="waNotifyForm.waTemplateMappingCancelled[ph.replace(/\D/g, '')]" class="input text-xs flex-1">
                        <option value="">— Seleccionar variable —</option>
                        <option v-for="sv in SYSTEM_VARIABLES" :key="sv.key" :value="sv.key">{{ sv.label }} (ej: {{ sv.example }})</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Reminder settings -->
            <div class="space-y-3 pt-3 border-t border-surface-100">
              <h3 class="text-sm font-medium text-surface-700">Recordatorios automáticos</h3>
              
              <!-- 24h reminder -->
              <div class="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-surface-800">Recordatorio 24h antes</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input v-model="waNotifyForm.waReminder24hEnabled" type="checkbox" class="sr-only peer" />
                  <div class="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
              <div v-if="waNotifyForm.waReminder24hEnabled" class="space-y-2">
                <label class="block text-xs font-medium text-surface-600">Plantilla recordatorio 24h</label>
                <select v-model="waNotifyForm.waTemplateReminder24h" @change="onTemplateChange('waTemplateMappingReminder24h')" class="input w-full text-sm">
                  <option value="">Sin plantilla</option>
                  <option v-for="t in waTemplates" :key="t.name" :value="t.name">{{ t.name }} ({{ t.language }})</option>
                </select>
                <div v-if="waNotifyForm.waTemplateReminder24h && getTemplateBody(waNotifyForm.waTemplateReminder24h)" class="ml-2 p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-3">
                  <p class="text-xs text-surface-500 font-medium">Vista previa de la plantilla:</p>
                  <p class="text-xs text-surface-700 whitespace-pre-line bg-white p-2 rounded border border-surface-100">{{ getTemplateBody(waNotifyForm.waTemplateReminder24h) }}</p>
                  <div v-if="getTemplatePlaceholders(waNotifyForm.waTemplateReminder24h).length" class="space-y-2">
                    <p class="text-xs font-medium text-surface-600">Asignar variables:</p>
                    <div v-for="ph in getTemplatePlaceholders(waNotifyForm.waTemplateReminder24h)" :key="ph" class="flex items-center gap-2">
                      <span class="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded min-w-[50px] text-center">{{ ph }}</span>
                      <span class="text-xs text-surface-400">=</span>
                      <select v-model="waNotifyForm.waTemplateMappingReminder24h[ph.replace(/\D/g, '')]" class="input text-xs flex-1">
                        <option value="">— Seleccionar variable —</option>
                        <option v-for="sv in SYSTEM_VARIABLES" :key="sv.key" :value="sv.key">{{ sv.label }} (ej: {{ sv.example }})</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 1h reminder -->
              <div class="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-surface-800">Recordatorio 1h antes</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input v-model="waNotifyForm.waReminder1hEnabled" type="checkbox" class="sr-only peer" />
                  <div class="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
              <div v-if="waNotifyForm.waReminder1hEnabled" class="space-y-2">
                <label class="block text-xs font-medium text-surface-600">Plantilla recordatorio 1h</label>
                <select v-model="waNotifyForm.waTemplateReminder1h" @change="onTemplateChange('waTemplateMappingReminder1h')" class="input w-full text-sm">
                  <option value="">Sin plantilla</option>
                  <option v-for="t in waTemplates" :key="t.name" :value="t.name">{{ t.name }} ({{ t.language }})</option>
                </select>
                <div v-if="waNotifyForm.waTemplateReminder1h && getTemplateBody(waNotifyForm.waTemplateReminder1h)" class="ml-2 p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-3">
                  <p class="text-xs text-surface-500 font-medium">Vista previa de la plantilla:</p>
                  <p class="text-xs text-surface-700 whitespace-pre-line bg-white p-2 rounded border border-surface-100">{{ getTemplateBody(waNotifyForm.waTemplateReminder1h) }}</p>
                  <div v-if="getTemplatePlaceholders(waNotifyForm.waTemplateReminder1h).length" class="space-y-2">
                    <p class="text-xs font-medium text-surface-600">Asignar variables:</p>
                    <div v-for="ph in getTemplatePlaceholders(waNotifyForm.waTemplateReminder1h)" :key="ph" class="flex items-center gap-2">
                      <span class="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded min-w-[50px] text-center">{{ ph }}</span>
                      <span class="text-xs text-surface-400">=</span>
                      <select v-model="waNotifyForm.waTemplateMappingReminder1h[ph.replace(/\D/g, '')]" class="input text-xs flex-1">
                        <option value="">— Seleccionar variable —</option>
                        <option v-for="sv in SYSTEM_VARIABLES" :key="sv.key" :value="sv.key">{{ sv.label }} (ej: {{ sv.example }})</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Validation warning -->
            <div v-if="!waNotifyValid" class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p class="text-xs text-amber-800">⚠️ Debes asignar una variable del sistema a cada <code class="bg-amber-100 px-1 rounded" v-pre>{{N}}</code> de las plantillas seleccionadas para poder guardar.</p>
            </div>

            <!-- Save WA notifications -->
            <div class="flex justify-end pt-2">
              <button @click="saveWaNotifySettings" class="btn-primary px-6" :disabled="savingWaNotify || !waNotifyValid">
                {{ savingWaNotify ? 'Guardando...' : 'Guardar notificaciones' }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
