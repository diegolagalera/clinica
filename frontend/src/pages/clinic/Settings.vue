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
  SwatchIcon,
  ArrowPathIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()

interface ClinicSettings {
  requireStockOnCompletion?: boolean
  odontogramColors?: Record<string, string>
}

const settings = ref<ClinicSettings>({})
const isSaving = ref(false)
const saveMessage = ref('')
const colorSaveMessage = ref('')

// Default odontogram colors
const defaultOdontogramColors: Record<string, { label: string; color: string; group: string }> = {
  CARIES: { label: 'Caries', color: '#E11D48', group: 'crown' },
  FILLING: { label: 'Obturación', color: '#2563EB', group: 'crown' },
  TEMPORARY_FILLING: { label: 'Obt. temporal', color: '#7DD3FC', group: 'crown' },
  CROWN: { label: 'Corona', color: '#F59E0B', group: 'crown' },
  VENEER: { label: 'Carilla', color: '#DB2777', group: 'crown' },
  BRIDGE: { label: 'Puente', color: '#0891B2', group: 'crown' },
  SEALANT: { label: 'Sellante', color: '#65A30D', group: 'crown' },
  FRACTURE: { label: 'Fractura', color: '#EA580C', group: 'crown' },
  EROSION: { label: 'Erosión', color: '#D97706', group: 'crown' },
  ABRASION: { label: 'Abrasión', color: '#92400E', group: 'crown' },
  ROOT_CANAL: { label: 'Endodoncia', color: '#7C3AED', group: 'root' },
  PERIAPICAL_LESION: { label: 'Lesión periapical', color: '#DC2626', group: 'root' },
  ROOT_RESORPTION: { label: 'Reabsorción', color: '#C2410C', group: 'root' },
  ROOT_FRACTURE: { label: 'Fractura radicular', color: '#991B1B', group: 'root' },
  MISSING: { label: 'Ausente', color: '#CBD5E1', group: 'tooth' },
  IMPLANT: { label: 'Implante', color: '#059669', group: 'tooth' },
  EXTRACTION_INDICATED: { label: 'Extracción indicada', color: '#B91C1C', group: 'tooth' },
}

// Get current color for a condition (override or default)
const getColor = (key: string): string => {
  return settings.value.odontogramColors?.[key] || defaultOdontogramColors[key]?.color || '#9CA3AF'
}

// Update a single color
const updateColor = (key: string, color: string) => {
  if (!settings.value.odontogramColors) {
    settings.value.odontogramColors = {}
  }
  settings.value.odontogramColors[key] = color
  saveColorSettings()
}

// Reset all colors to defaults
const resetColors = () => {
  settings.value.odontogramColors = {}
  saveColorSettings()
}

// Check if any color has been customized
const hasCustomColors = (): boolean => {
  return Object.keys(settings.value.odontogramColors || {}).length > 0
}

// Debounced save for color changes
let colorSaveTimeout: ReturnType<typeof setTimeout> | null = null
const saveColorSettings = () => {
  colorSaveMessage.value = ''
  if (colorSaveTimeout) clearTimeout(colorSaveTimeout)
  colorSaveTimeout = setTimeout(async () => {
    isSaving.value = true
    try {
      await api.put('/clinics/current', { settings: settings.value })
      colorSaveMessage.value = 'Guardado'
      setTimeout(() => colorSaveMessage.value = '', 2000)
    } catch (err) {
      console.error('Error saving color settings', err)
      colorSaveMessage.value = 'Error al guardar'
    } finally {
      isSaving.value = false
    }
  }, 500)
}

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

    <!-- Odontogram Colors Section -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-violet-100 rounded-lg">
            <SwatchIcon class="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-surface-900">Colores del Odontograma</h2>
            <p class="text-sm text-surface-500">Personaliza los colores de las condiciones dentales</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="colorSaveMessage" class="text-sm" :class="colorSaveMessage === 'Guardado' ? 'text-green-600' : 'text-red-500'">
            {{ colorSaveMessage }}
          </span>
          <button
            v-if="hasCustomColors()"
            @click="resetColors"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-300 bg-surface-50 text-surface-700 hover:bg-surface-100 transition-colors"
          >
            <ArrowPathIcon class="w-3.5 h-3.5" />
            Restaurar por defecto
          </button>
        </div>
      </div>

      <!-- Crown conditions -->
      <div class="mb-5">
        <h3 class="text-xs font-semibold text-surface-400 tracking-wider uppercase mb-3">Condiciones de Corona</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div
            v-for="(info, key) in defaultOdontogramColors"
            :key="key"
            v-show="info.group === 'crown'"
            class="flex items-center gap-2.5 p-2.5 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <label :for="'color-' + key" class="relative cursor-pointer group">
              <span 
                class="block w-7 h-7 rounded-lg border-2 border-surface-200 group-hover:border-primary-400 transition-colors shadow-sm"
                :style="{ backgroundColor: getColor(key as string) }"
              ></span>
              <input
                :id="'color-' + key"
                type="color"
                :value="getColor(key as string)"
                @input="(e) => updateColor(key as string, (e.target as HTMLInputElement).value)"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            <span class="text-sm text-surface-700 font-medium">{{ info.label }}</span>
          </div>
        </div>
      </div>

      <!-- Root conditions -->
      <div class="mb-5">
        <h3 class="text-xs font-semibold text-surface-400 tracking-wider uppercase mb-3">Condiciones de Raíz</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div
            v-for="(info, key) in defaultOdontogramColors"
            :key="key"
            v-show="info.group === 'root'"
            class="flex items-center gap-2.5 p-2.5 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <label :for="'color-' + key" class="relative cursor-pointer group">
              <span 
                class="block w-7 h-7 rounded-lg border-2 border-surface-200 group-hover:border-primary-400 transition-colors shadow-sm"
                :style="{ backgroundColor: getColor(key as string) }"
              ></span>
              <input
                :id="'color-' + key"
                type="color"
                :value="getColor(key as string)"
                @input="(e) => updateColor(key as string, (e.target as HTMLInputElement).value)"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            <span class="text-sm text-surface-700 font-medium">{{ info.label }}</span>
          </div>
        </div>
      </div>

      <!-- Tooth conditions -->
      <div>
        <h3 class="text-xs font-semibold text-surface-400 tracking-wider uppercase mb-3">Condiciones del Diente</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div
            v-for="(info, key) in defaultOdontogramColors"
            :key="key"
            v-show="info.group === 'tooth'"
            class="flex items-center gap-2.5 p-2.5 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <label :for="'color-' + key" class="relative cursor-pointer group">
              <span 
                class="block w-7 h-7 rounded-lg border-2 border-surface-200 group-hover:border-primary-400 transition-colors shadow-sm"
                :style="{ backgroundColor: getColor(key as string) }"
              ></span>
              <input
                :id="'color-' + key"
                type="color"
                :value="getColor(key as string)"
                @input="(e) => updateColor(key as string, (e.target as HTMLInputElement).value)"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            <span class="text-sm text-surface-700 font-medium">{{ info.label }}</span>
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
