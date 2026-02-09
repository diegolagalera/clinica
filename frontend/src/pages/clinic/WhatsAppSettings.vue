<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/services/api'
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
  saving.value = true
  try {
    const res = await api.put<any>('/chatbot/settings', form.value)
    isConfigured.value = res.data?.isConfigured ?? false
    toast.success('Configuración guardada correctamente')
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

onMounted(fetchSettings)
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
            <label class="block text-sm font-medium text-surface-700 mb-1">Business Account ID <span class="text-surface-400">(Opcional)</span></label>
            <input v-model="form.businessAccountId" type="text" class="input w-full" placeholder="Ej: 987654321098765" />
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Webhook Verify Token</label>
            <input v-model="form.webhookVerifyToken" type="text" class="input w-full" placeholder="Token secreto para verificar webhooks" />
            <p class="text-xs text-surface-400 mt-1">Debe coincidir con el que configures en Meta → Webhook Settings.</p>
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
    </template>
  </div>
</template>
