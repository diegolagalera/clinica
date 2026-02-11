<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import type { Appointment, ApiResponse } from '@/types'
import {
  CalendarDaysIcon,
  UserGroupIcon,
  ClockIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowRightIcon,
  CpuChipIcon,
  ExclamationCircleIcon,
} from '@heroicons/vue/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid'

const router = useRouter()
const authStore = useAuthStore()

// State
const stats = ref({
  todayAppointments: 0,
  totalPatients: 0,
  completedToday: 0,
  pendingToday: 0,
})
const todayAppointments = ref<Appointment[]>([])
const isLoading = ref(true)

// AI Usage state (admin only)
const aiUsage = ref<any>(null)
const aiStatus = ref<{ active: boolean; aiEnabled: boolean; reason: string | null }>({ active: true, aiEnabled: true, reason: null })

// Rating stats state (admin only)
const ratingStats = ref<{ totalRatings: number; averageRating: number; distribution: Record<number, number> } | null>(null)

const featureLabels: Record<string, string> = {
  chatbot: 'Chatbot WhatsApp',
  assistant: 'Asistente FAQ',
  radiograph: 'Radiografías',
  transcription: 'Transcripción',
  voice_notes: 'Notas de Voz',
  email_template: 'Email',
  stock_image: 'Imágenes',
}

const featureIcons: Record<string, string> = {
  chatbot: '💬', assistant: '✨', radiograph: '🦷', transcription: '🎤',
  voice_notes: '🗒️', email_template: '📧', stock_image: '🖼️',
}

// Load dashboard data
const loadDashboard = async () => {
  isLoading.value = true
  
  try {
    // Load today's appointments
    const appointmentsResponse = await api.get<ApiResponse<Appointment[]>>('/appointments/today')
    if (appointmentsResponse.success && appointmentsResponse.data) {
      todayAppointments.value = appointmentsResponse.data
      stats.value.todayAppointments = todayAppointments.value.length
      stats.value.completedToday = todayAppointments.value.filter(a => a.status === 'COMPLETED').length
      stats.value.pendingToday = todayAppointments.value.filter(a => a.status === 'SCHEDULED').length
    }
    
    // Load patients count
    const patientsResponse = await api.get<ApiResponse<{ pagination: { total: number } }>>('/patients?limit=1')
    if (patientsResponse.success && patientsResponse.data) {
      stats.value.totalPatients = patientsResponse.data.pagination.total
    }
  } catch (err) {
    console.error('Error loading dashboard:', err)
  } finally {
    isLoading.value = false
  }
}

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'SCHEDULED': return 'badge-primary'
    case 'COMPLETED': return 'badge-success'
    case 'CANCELLED': return 'badge-danger'
    case 'NO_SHOW': return 'badge-warning'
    default: return 'badge-neutral'
  }
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    SCHEDULED: 'Programada',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    NO_SHOW: 'No presentado',
  }
  return labels[status] || status
}

onMounted(() => {
  loadDashboard()
  if (authStore.isAdmin) {
    loadAiUsage()
    loadRatingStats()
  }
})

// AI usage loader
const loadAiUsage = async () => {
  try {
    const statusRes = await api.get<any>('/chatbot/ai-status')
    if (statusRes.data) {
      aiStatus.value = statusRes.data
    }
    // Always load usage data regardless of AI status
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const usageRes = await api.get<any>('/chatbot/ai-usage', { params: { month } })
    if (usageRes.success && usageRes.data) {
      aiUsage.value = usageRes.data
    }
  } catch { /* ignore */ }
}

const formatTokenCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}

const formatCost = (cost: string | number): string => {
  const n = typeof cost === 'string' ? parseFloat(cost) : cost
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

const usagePercent = () => {
  if (!aiUsage.value) return 0
  return Math.round((aiUsage.value.totals.totalTokens / aiUsage.value.tokenLimit) * 100)
}

const getUsageColor = (percent: number): string => {
  if (percent >= 90) return 'bg-danger-500'
  if (percent >= 70) return 'bg-warning-500'
  return 'bg-accent-500'
}

// Rating loader (admin only)
const loadRatingStats = async () => {
  try {
    const statsRes = await api.get<any>('/ratings/stats')
    if (statsRes.success && statsRes.data) {
      ratingStats.value = statsRes.data
    }
  } catch { /* ignore */ }
}

</script>

<template>
  <div class="space-y-6">
    <!-- Welcome header -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold text-surface-900">
          ¡Hola, {{ authStore.user?.firstName }}!
        </h1>
        <p class="text-surface-500 mt-1">
          {{ new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
        </p>
      </div>
      <RouterLink to="/clinic/calendar" class="btn-primary">
        <PlusIcon class="w-5 h-5" />
        Nueva Cita
      </RouterLink>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-xl bg-primary-100">
            <CalendarDaysIcon class="w-5 h-5 text-primary-600" />
          </div>
        </div>
        <p class="stat-value">{{ stats.todayAppointments }}</p>
        <p class="stat-label">Citas Hoy</p>
      </div>
      
      <div class="stat-card">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-xl bg-success-100">
            <ChartBarIcon class="w-5 h-5 text-success-600" />
          </div>
        </div>
        <p class="stat-value">{{ stats.completedToday }}</p>
        <p class="stat-label">Completadas</p>
      </div>
      
      <div class="stat-card">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-xl bg-warning-100">
            <ClockIcon class="w-5 h-5 text-warning-600" />
          </div>
        </div>
        <p class="stat-value">{{ stats.pendingToday }}</p>
        <p class="stat-label">Pendientes</p>
      </div>
      
      <div class="stat-card">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-xl bg-accent-100">
            <UserGroupIcon class="w-5 h-5 text-accent-600" />
          </div>
        </div>
        <p class="stat-value">{{ stats.totalPatients }}</p>
        <p class="stat-label">Pacientes</p>
      </div>
    </div>

    <!-- Admin cards row: AI + Rating -->
    <div v-if="authStore.isAdmin" class="grid md:grid-cols-2 gap-4">
      <!-- AI Usage Card -->
      <div class="card overflow-hidden">
        <div class="card-header flex items-center gap-3">
          <div class="p-2 rounded-xl bg-primary-100">
            <CpuChipIcon class="w-5 h-5 text-primary-600" />
          </div>
          <h2 class="font-semibold text-surface-900">Inteligencia Artificial</h2>
        </div>

        <!-- AI Disabled Banner -->
        <div v-if="!aiStatus.aiEnabled" class="mx-5 mt-5 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <ExclamationCircleIcon class="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p class="text-sm font-medium text-amber-800">IA desactivada</p>
        </div>

        <!-- AI Usage Data -->
        <div v-if="aiUsage && aiUsage.totals.totalTokens > 0" class="p-5 space-y-4">
          <!-- Summary row -->
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-primary-50 rounded-xl p-3 text-center">
              <p class="text-lg font-bold text-primary-700">{{ formatTokenCount(aiUsage.totals.totalTokens) }}</p>
              <p class="text-[10px] text-primary-500 font-medium">TOKENS</p>
            </div>
            <div class="bg-surface-50 rounded-xl p-3 text-center">
              <p class="text-lg font-bold text-surface-700">{{ aiUsage.totals.requestCount }}</p>
              <p class="text-[10px] text-surface-500 font-medium">PETICIONES</p>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="space-y-1">
            <div class="flex justify-between text-xs text-surface-500">
              <span>{{ formatTokenCount(aiUsage.totals.totalTokens) }} / {{ formatTokenCount(aiUsage.tokenLimit) }}</span>
              <span>{{ usagePercent() }}%</span>
            </div>
            <div class="w-full bg-surface-100 rounded-full h-2 overflow-hidden">
              <div 
                :class="getUsageColor(usagePercent())"
                class="h-full rounded-full transition-all duration-500"
                :style="{ width: `${Math.min(usagePercent(), 100)}%` }"
              ></div>
            </div>
          </div>

          <!-- Top features -->
          <div v-if="aiUsage.byFeature.length > 0">
            <p class="text-xs font-medium text-surface-500 mb-2">Uso por funcionalidad</p>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="feat in aiUsage.byFeature.slice(0, 4)" 
                :key="feat.feature"
                class="inline-flex items-center gap-1.5 text-xs bg-surface-50 text-surface-700 px-2.5 py-1.5 rounded-lg"
              >
                <span>{{ featureIcons[feat.feature] || '⚡' }}</span>
                {{ featureLabels[feat.feature] || feat.feature }}
                <span class="font-semibold">{{ formatTokenCount(feat.totalTokens) }}</span>
              </span>
            </div>
          </div>

          <p class="text-[10px] text-surface-400 text-center">Consumo del mes actual · Se reinicia mensualmente</p>
        </div>

        <!-- No usage and AI disabled -->
        <div v-else-if="!aiStatus.aiEnabled && (!aiUsage || aiUsage.totals.totalTokens === 0)" class="p-5 text-center">
          <p class="text-sm text-surface-400">Sin consumo de IA este mes</p>
        </div>

        <!-- Loading -->
        <div v-else-if="aiStatus.aiEnabled && !aiUsage" class="p-6 flex justify-center">
          <div class="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      </div>

      <!-- Clinic Rating Card -->
      <div class="card overflow-hidden">
        <div class="card-header flex items-center gap-3">
          <div class="p-2 rounded-xl bg-amber-100">
            <StarIconSolid class="w-5 h-5 text-amber-500" />
          </div>
          <h2 class="font-semibold text-surface-900">Valoración</h2>
        </div>

        <div v-if="!ratingStats" class="p-6 flex justify-center">
          <div class="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full"></div>
        </div>

        <div v-else-if="ratingStats.totalRatings === 0" class="p-8 text-center">
          <p class="text-3xl mb-2">⭐</p>
          <p class="text-sm text-surface-500">Aún no hay valoraciones</p>
          <p class="text-xs text-surface-400 mt-1">Aparecerán cuando los pacientes respondan</p>
        </div>

        <div v-else class="p-5">
          <div class="flex items-center gap-4 mb-4">
            <p class="text-4xl font-bold text-surface-900">{{ ratingStats.averageRating }}</p>
            <div>
              <div class="flex gap-0.5 mb-1">
                <StarIconSolid
                  v-for="i in 5"
                  :key="i"
                  class="w-5 h-5"
                  :class="i <= Math.round(ratingStats.averageRating) ? 'text-amber-400' : 'text-surface-200'"
                />
              </div>
              <p class="text-sm text-surface-500">{{ ratingStats.totalRatings }} valoración{{ ratingStats.totalRatings !== 1 ? 'es' : '' }}</p>
            </div>
          </div>

          <!-- Distribution bars -->
          <div class="space-y-1.5">
            <div v-for="star in [5, 4, 3, 2, 1]" :key="star" class="flex items-center gap-2">
              <span class="text-xs text-surface-500 w-3 text-right">{{ star }}</span>
              <StarIconSolid class="w-3 h-3 text-amber-400 flex-shrink-0" />
              <div class="flex-1 bg-surface-100 rounded-full h-1.5 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="star >= 4 ? 'bg-amber-400' : star === 3 ? 'bg-amber-300' : 'bg-surface-300'"
                  :style="{ width: `${(ratingStats.distribution[star] / ratingStats.totalRatings) * 100}%` }"
                ></div>
              </div>
              <span class="text-xs text-surface-400 w-4 text-right">{{ ratingStats.distribution[star] }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Today's appointments -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h2 class="font-semibold text-surface-900">Citas de Hoy</h2>
        <RouterLink to="/clinic/calendar" class="text-primary-600 text-sm hover:underline flex items-center gap-1">
          Ver calendario
          <ArrowRightIcon class="w-4 h-4" />
        </RouterLink>
      </div>
      
      <div v-if="isLoading" class="p-8 text-center">
        <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
      </div>
      
      <div v-else-if="todayAppointments.length > 0" class="divide-y divide-surface-100">
        <div 
          v-for="apt in todayAppointments" 
          :key="apt.id"
          class="flex items-center gap-4 p-4 hover:bg-surface-50 transition-colors cursor-pointer"
        >
          <div class="w-12 h-12 rounded-xl bg-surface-100 flex flex-col items-center justify-center text-surface-700">
            <span class="text-sm font-semibold">{{ formatTime(apt.startTime) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-surface-900">
              {{ apt.patient?.firstName }} {{ apt.patient?.lastName }}
            </p>
            <p class="text-sm text-surface-500">
              {{ apt.type }} • {{ apt.worker?.firstName }} {{ apt.worker?.lastName }}
            </p>
          </div>
          <span :class="getStatusClass(apt.status)">
            {{ getStatusLabel(apt.status) }}
          </span>
        </div>
      </div>
      
      <div v-else class="p-8 text-center text-surface-500">
        <CalendarDaysIcon class="w-10 h-10 mx-auto mb-3 text-surface-300" />
        <p>No hay citas programadas para hoy</p>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="grid md:grid-cols-2 gap-4">
      <RouterLink 
        to="/clinic/patients" 
        class="card p-6 hover:shadow-glow transition-shadow group"
      >
        <UserGroupIcon class="w-8 h-8 text-primary-500 mb-3" />
        <h3 class="font-semibold text-surface-900 group-hover:text-primary-600">Pacientes</h3>
        <p class="text-sm text-surface-500 mt-1">Ver y gestionar pacientes</p>
      </RouterLink>
      
      <RouterLink 
        to="/clinic/calendar" 
        class="card p-6 hover:shadow-glow transition-shadow group"
      >
        <CalendarDaysIcon class="w-8 h-8 text-accent-500 mb-3" />
        <h3 class="font-semibold text-surface-900 group-hover:text-accent-600">Calendario</h3>
        <p class="text-sm text-surface-500 mt-1">Gestionar citas</p>
      </RouterLink>
    </div>
  </div>
</template>
