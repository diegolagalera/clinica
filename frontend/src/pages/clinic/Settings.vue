<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import type { ApiResponse } from '@/types'
import {
  Cog6ToothIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  ChevronRightIcon,
  CubeIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()

interface ClinicSettings {
  requireStockOnCompletion?: boolean
}

const settings = ref<ClinicSettings>({})
const isSaving = ref(false)
const saveMessage = ref('')

const configSections = [
  {
    id: 'email',
    name: 'Notificaciones Email',
    description: 'Configura el envío de emails automáticos (SMTP, plantillas, recordatorios)',
    icon: EnvelopeIcon,
    color: 'bg-blue-100 text-blue-600',
    route: '/clinic/notifications',
  },
  {
    id: 'sms',
    name: 'Notificaciones SMS',
    description: 'Configura el envío de SMS con Twilio (credenciales, plantillas, recordatorios)',
    icon: DevicePhoneMobileIcon,
    color: 'bg-emerald-100 text-emerald-600',
    route: '/clinic/sms',
  },
]

const goToSection = (route: string) => {
  router.push(route)
}

const loadSettings = async () => {
  try {
    const response = await api.get<ApiResponse<{ settings: ClinicSettings }>>('/clinics/current')
    if (response.success && response.data) {
      settings.value = response.data.settings || {}
    }
  } catch (err) {
    console.warn('Could not load clinic settings', err)
  }
}

const saveSettings = async () => {
  isSaving.value = true
  saveMessage.value = ''
  try {
    await api.put('/clinics/current', { settings: settings.value })
    saveMessage.value = 'Guardado'
    setTimeout(() => saveMessage.value = '', 2000)
  } catch (err) {
    console.error('Error saving settings', err)
    saveMessage.value = 'Error al guardar'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="max-w-4xl mx-auto py-6 px-4">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-8">
      <div class="p-3 bg-primary-100 rounded-xl">
        <Cog6ToothIcon class="w-8 h-8 text-primary-600" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Configuración</h1>
        <p class="text-surface-500">Gestiona la configuración de tu clínica</p>
      </div>
    </div>

    <!-- Clinic Settings Section -->
    <div class="card p-6 mb-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 bg-orange-100 rounded-lg">
          <CubeIcon class="w-5 h-5 text-orange-600" />
        </div>
        <h2 class="text-lg font-semibold text-surface-900">Opciones de Inventario</h2>
      </div>
      
      <div class="space-y-4">
        <!-- Require Stock Toggle -->
        <div class="flex items-center justify-between py-3 border-b border-surface-100">
          <div>
            <h3 class="font-medium text-surface-800">Requerir stock al completar cita</h3>
            <p class="text-sm text-surface-500">No permite marcar una cita como completada sin registrar el stock utilizado</p>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="saveMessage" class="text-sm" :class="saveMessage === 'Guardado' ? 'text-green-600' : 'text-red-500'">
              {{ saveMessage }}
            </span>
            <button
              type="button"
              @click="settings.requireStockOnCompletion = !settings.requireStockOnCompletion; saveSettings()"
              :disabled="isSaving"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                settings.requireStockOnCompletion ? 'bg-primary-600' : 'bg-surface-300'
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  settings.requireStockOnCompletion ? 'translate-x-6' : 'translate-x-1'
                ]"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Config Cards -->
    <h2 class="text-lg font-semibold text-surface-900 mb-4">Integraciones</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <button
        v-for="section in configSections"
        :key="section.id"
        @click="goToSection(section.route)"
        class="card p-6 text-left hover:shadow-lg hover:border-primary-200 transition-all group cursor-pointer"
      >
        <div class="flex items-start gap-4">
          <div :class="['p-3 rounded-xl', section.color]">
            <component :is="section.icon" class="w-6 h-6" />
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-surface-900 group-hover:text-primary-600 transition-colors">
                {{ section.name }}
              </h3>
              <ChevronRightIcon class="w-5 h-5 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p class="text-sm text-surface-500 mt-1">{{ section.description }}</p>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
