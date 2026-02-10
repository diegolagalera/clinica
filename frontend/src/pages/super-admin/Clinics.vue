<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '@/services/api'
import type { Clinic, Organization, ApiResponse, PaginatedResponse } from '@/types'
import {
  MagnifyingGlassIcon,
  BuildingStorefrontIcon,
  BuildingOffice2Icon,
  CpuChipIcon,
  XMarkIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline'

interface ClinicWithOrg extends Clinic {
  organization?: Organization
}

interface AiOverviewClinic {
  clinicId: string
  clinicName: string
  aiEnabled: boolean
  tokenLimit: number
  tokensUsed: number
  tokensRemaining: number
  usagePercent: number
}

// State
const clinics = ref<ClinicWithOrg[]>([])
const isLoading = ref(true)
const error = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)

// AI Overview state
const aiOverview = ref<AiOverviewClinic[]>([])
const aiOverviewLoading = ref(false)

// AI Config modal state
const showAiModal = ref(false)
const selectedClinic = ref<ClinicWithOrg | null>(null)
const aiConfigForm = ref({
  aiEnabled: false,
  aiMonthlyTokenLimit: 100000,
})
const savingAiConfig = ref(false)
const aiConfigSuccess = ref('')

// AI Usage modal state
const showUsageModal = ref(false)
const usageLoading = ref(false)
const usageData = ref<any>(null)
const selectedUsageMonth = ref('')
const selectedUsageClinic = ref<ClinicWithOrg | null>(null)

// Feature label mapping
const featureLabels: Record<string, string> = {
  chatbot: 'Chatbot WhatsApp',
  assistant: 'Asistente FAQ',
  radiograph: 'Análisis Radiografías',
  transcription: 'Transcripción Voz',
  voice_notes: 'Notas de Voz',
  email_template: 'Plantillas Email',
  stock_image: 'Imágenes Stock',
}

const featureIcons: Record<string, string> = {
  chatbot: '💬',
  assistant: '✨',
  radiograph: '🦷',
  transcription: '🎤',
  voice_notes: '🗒️',
  email_template: '📧',
  stock_image: '🖼️',
}

// Load clinics
const loadClinics = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const response = await api.get<ApiResponse<PaginatedResponse<ClinicWithOrg>>>('/clinics', {
      params: {
        page: currentPage.value,
        limit: 10,
        search: searchQuery.value || undefined,
      },
    })
    
    if (response.success && response.data) {
      clinics.value = response.data.data
      totalPages.value = response.data.pagination.totalPages
      total.value = response.data.pagination.total
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error loading clinics'
  } finally {
    isLoading.value = false
  }
}

// Load AI overview
const loadAiOverview = async () => {
  aiOverviewLoading.value = true
  try {
    const response = await api.get<ApiResponse<{ clinics: AiOverviewClinic[] }>>('/ai-admin/ai-overview')
    if (response.success && response.data) {
      aiOverview.value = response.data.clinics
    }
  } catch (err) {
    // Silently fail - not critical
  } finally {
    aiOverviewLoading.value = false
  }
}

// Get AI info for a specific clinic
const getAiInfo = (clinicId: string): AiOverviewClinic | undefined => {
  return aiOverview.value.find(c => c.clinicId === clinicId)
}

const formatTokenCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}

const getUsageColor = (percent: number): string => {
  if (percent >= 90) return 'bg-danger-500'
  if (percent >= 70) return 'bg-warning-500'
  return 'bg-accent-500'
}

// Open AI config modal
const openAiConfig = (clinic: ClinicWithOrg) => {
  selectedClinic.value = clinic
  aiConfigForm.value = {
    aiEnabled: clinic.aiEnabled ?? false,
    aiMonthlyTokenLimit: clinic.aiMonthlyTokenLimit ?? 100000,
  }
  aiConfigSuccess.value = ''
  showAiModal.value = true
}

// Save AI config
const saveAiConfig = async () => {
  if (!selectedClinic.value) return
  savingAiConfig.value = true
  aiConfigSuccess.value = ''
  
  try {
    await api.put(`/ai-admin/clinics/${selectedClinic.value.id}/ai-config`, aiConfigForm.value)
    
    // Update local state
    const clinic = clinics.value.find(c => c.id === selectedClinic.value!.id)
    if (clinic) {
      clinic.aiEnabled = aiConfigForm.value.aiEnabled
      clinic.aiMonthlyTokenLimit = aiConfigForm.value.aiMonthlyTokenLimit
    }
    
    aiConfigSuccess.value = 'Configuración de IA guardada correctamente'
    await loadAiOverview()
    
    setTimeout(() => {
      showAiModal.value = false
    }, 1500)
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error saving AI config'
  } finally {
    savingAiConfig.value = false
  }
}

// Token limit presets
const tokenPresets = [
  { label: '50K', value: 50000 },
  { label: '100K', value: 100000 },
  { label: '250K', value: 250000 },
  { label: '500K', value: 500000 },
  { label: '1M', value: 1000000 },
]

// Open usage modal
const openUsageModal = async (clinic: ClinicWithOrg) => {
  selectedUsageClinic.value = clinic
  const now = new Date()
  selectedUsageMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  showUsageModal.value = true
  await loadUsageSummary(clinic.id, selectedUsageMonth.value)
}

const loadUsageSummary = async (clinicId: string, month: string) => {
  usageLoading.value = true
  usageData.value = null
  try {
    const response = await api.get<any>(`/ai-admin/clinics/${clinicId}/ai-usage`, {
      params: { month },
    })
    if (response.success && response.data) {
      usageData.value = response.data
    }
  } catch { /* ignore */ } finally {
    usageLoading.value = false
  }
}

const changeMonth = (delta: number) => {
  if (!selectedUsageClinic.value) return
  const [y, m] = selectedUsageMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  selectedUsageMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  loadUsageSummary(selectedUsageClinic.value.id, selectedUsageMonth.value)
}

const isCurrentMonth = computed(() => {
  const now = new Date()
  return selectedUsageMonth.value === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

const monthLabel = computed(() => {
  if (!selectedUsageMonth.value) return ''
  const [y, m] = selectedUsageMonth.value.split('-').map(Number)
  const date = new Date(y, m - 1)
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
})

const formatCost = (cost: string | number): string => {
  const n = typeof cost === 'string' ? parseFloat(cost) : cost
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

// Search debounce
let searchTimeout: number
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    currentPage.value = 1
    loadClinics()
  }, 300)
})

onMounted(() => {
  loadClinics()
  loadAiOverview()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-display font-bold text-surface-900">Clínicas</h1>
      <p class="text-surface-500 mt-1">Vista general de todas las clínicas de la plataforma</p>
    </div>

    <!-- Search -->
    <div class="flex gap-4">
      <div class="relative flex-1 max-w-md">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar clínicas..."
          class="input pl-10"
        />
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 rounded-xl bg-danger-50 text-danger-600">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- Clinics grid -->
    <div v-else-if="clinics.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div 
        v-for="clinic in clinics" 
        :key="clinic.id"
        class="card p-4 hover:shadow-glow transition-shadow"
      >
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center flex-shrink-0">
            <BuildingStorefrontIcon class="w-6 h-6 text-accent-600" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-surface-900 truncate">{{ clinic.name }}</h3>
            <p class="text-sm text-surface-500 truncate">{{ clinic.city || clinic.address || '-' }}</p>
            
            <div v-if="clinic.organization" class="flex items-center gap-1 mt-2 text-xs text-surface-400">
              <BuildingOffice2Icon class="w-3 h-3" />
              {{ clinic.organization.name }}
            </div>
          </div>
          <span :class="clinic.isActive ? 'badge-success' : 'badge-neutral'" class="flex-shrink-0">
            {{ clinic.isActive ? 'Activa' : 'Inactiva' }}
          </span>
        </div>
        
        <!-- AI Usage Section -->
        <div class="mt-4 pt-4 border-t border-surface-100">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <CpuChipIcon class="w-4 h-4 text-surface-400" />
              <span class="text-xs font-medium text-surface-600">IA</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="text-xs text-accent-600 hover:text-accent-700 font-medium"
                @click="openUsageModal(clinic)"
              >
                Ver consumo
              </button>
              <span class="text-surface-300">·</span>
              <button
                class="text-xs text-primary-600 hover:text-primary-700 font-medium"
                @click="openAiConfig(clinic)"
              >
                Configurar
              </button>
            </div>
          </div>
          
          <template v-if="getAiInfo(clinic.id)">
            <div class="flex items-center gap-2 mb-1">
              <span 
                :class="getAiInfo(clinic.id)!.aiEnabled ? 'bg-success-100 text-success-700' : 'bg-surface-100 text-surface-500'"
                class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              >
                {{ getAiInfo(clinic.id)!.aiEnabled ? 'Activa' : 'Desactivada' }}
              </span>
              <span v-if="getAiInfo(clinic.id)!.aiEnabled" class="text-[10px] text-surface-400">
                {{ formatTokenCount(getAiInfo(clinic.id)!.tokensUsed) }} / {{ formatTokenCount(getAiInfo(clinic.id)!.tokenLimit) }} tokens
              </span>
            </div>
            
            <!-- Progress bar -->
            <div v-if="getAiInfo(clinic.id)!.aiEnabled" class="w-full bg-surface-100 rounded-full h-1.5 overflow-hidden">
              <div 
                :class="getUsageColor(getAiInfo(clinic.id)!.usagePercent)"
                class="h-full rounded-full transition-all duration-500"
                :style="{ width: `${Math.min(getAiInfo(clinic.id)!.usagePercent, 100)}%` }"
              ></div>
            </div>
          </template>
          <div v-else class="text-[10px] text-surface-400">Cargando...</div>
        </div>

        <div class="mt-3 pt-3 border-t border-surface-100 grid grid-cols-2 gap-4 text-center">
          <div>
            <p class="text-lg font-semibold text-surface-900">-</p>
            <p class="text-xs text-surface-500">Pacientes</p>
          </div>
          <div>
            <p class="text-lg font-semibold text-surface-900">-</p>
            <p class="text-xs text-surface-500">Citas hoy</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card p-12 text-center">
      <BuildingStorefrontIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-medium text-surface-900 mb-2">No hay clínicas</h3>
      <p class="text-surface-500">Las clínicas aparecerán aquí cuando se creen dentro de las organizaciones</p>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-surface-500">
        Mostrando {{ clinics.length }} de {{ total }} clínicas
      </p>
      <div class="flex gap-2">
        <button 
          @click="currentPage--; loadClinics()"
          :disabled="currentPage <= 1"
          class="btn-secondary btn-sm"
        >
          Anterior
        </button>
        <button 
          @click="currentPage++; loadClinics()"
          :disabled="currentPage >= totalPages"
          class="btn-secondary btn-sm"
        >
          Siguiente
        </button>
      </div>
    </div>

    <!-- AI Config Modal -->
    <Teleport to="body">
      <div v-if="showAiModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showAiModal = false"></div>
        
        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                <CpuChipIcon class="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 class="font-semibold text-surface-900">Configuración de IA</h3>
                <p class="text-sm text-surface-500">{{ selectedClinic?.name }}</p>
              </div>
            </div>
            <button @click="showAiModal = false" class="p-1 rounded-lg hover:bg-surface-100">
              <XMarkIcon class="w-5 h-5 text-surface-400" />
            </button>
          </div>

          <!-- Form -->
          <div class="space-y-4">
            <!-- Enable/Disable toggle -->
            <div class="flex items-center justify-between p-4 rounded-xl bg-surface-50">
              <div>
                <p class="font-medium text-surface-900 text-sm">Habilitar IA</p>
                <p class="text-xs text-surface-500">Permitir acceso a funciones de IA</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="aiConfigForm.aiEnabled" class="sr-only peer">
                <div class="w-11 h-6 bg-surface-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <!-- Token limit -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-2">
                Límite mensual de tokens
              </label>
              <input
                v-model.number="aiConfigForm.aiMonthlyTokenLimit"
                type="number"
                min="0"
                step="10000"
                class="input"
              />
              <p class="text-xs text-surface-400 mt-1">
                {{ formatTokenCount(aiConfigForm.aiMonthlyTokenLimit) }} tokens/mes
              </p>
              
              <!-- Quick presets -->
              <div class="flex gap-2 mt-2">
                <button
                  v-for="preset in tokenPresets"
                  :key="preset.value"
                  @click="aiConfigForm.aiMonthlyTokenLimit = preset.value"
                  :class="aiConfigForm.aiMonthlyTokenLimit === preset.value ? 'bg-primary-100 text-primary-700 border-primary-300' : 'bg-surface-50 text-surface-600 border-surface-200'"
                  class="px-3 py-1 text-xs font-medium rounded-lg border transition-colors hover:bg-primary-50"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Success message -->
          <div v-if="aiConfigSuccess" class="p-3 rounded-xl bg-success-50 text-success-700 text-sm text-center">
            {{ aiConfigSuccess }}
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-2">
            <button @click="showAiModal = false" class="btn-secondary flex-1">
              Cancelar
            </button>
            <button 
              @click="saveAiConfig" 
              :disabled="savingAiConfig"
              class="btn-primary flex-1"
            >
              {{ savingAiConfig ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- AI Usage Detail Modal -->
    <Teleport to="body">
      <div v-if="showUsageModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showUsageModal = false"></div>
        
        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
                <ChartBarIcon class="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <h3 class="font-semibold text-surface-900">Consumo de IA</h3>
                <p class="text-sm text-surface-500">{{ selectedUsageClinic?.name }}</p>
              </div>
            </div>
            <button @click="showUsageModal = false" class="p-1 rounded-lg hover:bg-surface-100">
              <XMarkIcon class="w-5 h-5 text-surface-400" />
            </button>
          </div>

          <!-- Month Navigation -->
          <div class="flex items-center justify-between bg-surface-50 rounded-xl px-4 py-2.5">
            <button @click="changeMonth(-1)" class="p-1 rounded-lg hover:bg-surface-200 transition-colors">
              <ChevronLeftIcon class="w-5 h-5 text-surface-600" />
            </button>
            <span class="font-medium text-surface-800 capitalize">{{ monthLabel }}</span>
            <button 
              @click="changeMonth(1)" 
              :disabled="isCurrentMonth"
              :class="isCurrentMonth ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-200'"
              class="p-1 rounded-lg transition-colors"
            >
              <ChevronRightIcon class="w-5 h-5 text-surface-600" />
            </button>
          </div>

          <!-- Loading -->
          <div v-if="usageLoading" class="flex justify-center py-8">
            <div class="animate-spin w-7 h-7 border-3 border-primary-500 border-t-transparent rounded-full"></div>
          </div>

          <template v-else-if="usageData">
            <!-- Summary Cards -->
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-primary-50 rounded-xl p-3 text-center">
                <p class="text-lg font-bold text-primary-700">{{ formatTokenCount(usageData.totals.totalTokens) }}</p>
                <p class="text-[10px] text-primary-500 font-medium">TOKENS</p>
              </div>
              <div class="bg-accent-50 rounded-xl p-3 text-center">
                <p class="text-lg font-bold text-accent-700">{{ formatCost(usageData.totals.totalCost) }}</p>
                <p class="text-[10px] text-accent-500 font-medium">COSTE EST.</p>
              </div>
              <div class="bg-surface-50 rounded-xl p-3 text-center">
                <p class="text-lg font-bold text-surface-700">{{ usageData.totals.requestCount }}</p>
                <p class="text-[10px] text-surface-500 font-medium">PETICIONES</p>
              </div>
            </div>

            <!-- Usage Bar -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs text-surface-500">
                <span>{{ formatTokenCount(usageData.totals.totalTokens) }} / {{ formatTokenCount(usageData.tokenLimit) }}</span>
                <span>{{ Math.round((usageData.totals.totalTokens / usageData.tokenLimit) * 100) }}%</span>
              </div>
              <div class="w-full bg-surface-100 rounded-full h-2 overflow-hidden">
                <div 
                  :class="getUsageColor(Math.round((usageData.totals.totalTokens / usageData.tokenLimit) * 100))"
                  class="h-full rounded-full transition-all duration-500"
                  :style="{ width: `${Math.min((usageData.totals.totalTokens / usageData.tokenLimit) * 100, 100)}%` }"
                ></div>
              </div>
            </div>

            <!-- Feature Breakdown -->
            <div v-if="usageData.byFeature.length > 0">
              <h4 class="text-sm font-semibold text-surface-700 mb-3">Desglose por funcionalidad</h4>
              <div class="space-y-2">
                <div 
                  v-for="feat in usageData.byFeature" 
                  :key="feat.feature"
                  class="flex items-center justify-between p-3 bg-surface-50 rounded-xl"
                >
                  <div class="flex items-center gap-2.5">
                    <span class="text-base">{{ featureIcons[feat.feature] || '⚡' }}</span>
                    <div>
                      <p class="text-sm font-medium text-surface-800">{{ featureLabels[feat.feature] || feat.feature }}</p>
                      <p class="text-[10px] text-surface-400">{{ feat.requestCount }} peticiones</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-semibold text-surface-800">{{ formatTokenCount(feat.totalTokens) }}</p>
                    <p class="text-[10px] text-surface-400">{{ formatCost(feat.totalCost) }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else class="py-8 text-center">
              <p class="text-surface-400 text-sm">Sin consumo en este periodo</p>
            </div>

            <!-- Model Breakdown -->
            <div v-if="usageData.byModel.length > 0">
              <h4 class="text-sm font-semibold text-surface-700 mb-3">Desglose por modelo</h4>
              <div class="grid grid-cols-2 gap-2">
                <div 
                  v-for="mdl in usageData.byModel" 
                  :key="mdl.model"
                  class="p-3 bg-surface-50 rounded-xl"
                >
                  <p class="text-xs font-mono font-medium text-surface-700">{{ mdl.model }}</p>
                  <p class="text-sm font-semibold text-surface-800 mt-1">{{ formatTokenCount(mdl.totalTokens) }} tokens</p>
                  <p class="text-[10px] text-surface-400">{{ formatCost(mdl.totalCost) }} · {{ mdl.requestCount }} req</p>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>
