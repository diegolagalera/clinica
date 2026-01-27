<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/services/api'
import {
  StarIcon,
  ChartBarIcon,
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  UserIcon,
} from '@heroicons/vue/24/solid'
import { StarIcon as StarOutline } from '@heroicons/vue/24/outline'

interface RatingStats {
  totalRatings: number
  averageRating: number
  distribution: Record<number, number>
}

interface Rating {
  id: string
  rating: number
  comment?: string
  createdAt: string
  appointment?: {
    startTime: string
    appointmentWorkers?: Array<{
      user: {
        firstName: string
        lastName: string
      }
    }>
  }
}

interface RatingRequest {
  id: string
  token: string
  status: 'PENDING' | 'SENT' | 'COMPLETED' | 'EXPIRED' | 'SKIPPED'
  scheduledFor: string
  expiresAt: string
  sentAt?: string
  completedAt?: string
  createdAt: string
  patient?: {
    firstName: string
    lastName: string
    email?: string
  }
  appointment?: {
    startTime: string
  }
}

// State
const loading = ref(true)
const stats = ref<RatingStats | null>(null)
const recentRatings = ref<Rating[]>([])
const ratingRequests = ref<RatingRequest[]>([])
const selectedTab = ref<'overview' | 'ratings' | 'requests'>('overview')

// Load data
const loadData = async () => {
  loading.value = true
  try {
    const [statsRes, ratingsRes, requestsRes] = await Promise.all([
      api.get<{ data: RatingStats }>('/ratings/stats'),
      api.get<{ data: Rating[] }>('/ratings/recent?limit=20'),
      api.get<{ data: RatingRequest[] }>('/ratings/requests'),
    ])
    stats.value = statsRes.data
    recentRatings.value = ratingsRes.data || []
    ratingRequests.value = requestsRes.data || []
  } catch (error) {
    console.error('Error loading rating data:', error)
  } finally {
    loading.value = false
  }
}

// Stats computed
const avgRatingDisplay = computed(() => {
  if (!stats.value) return '0.0'
  return stats.value.averageRating.toFixed(1)
})

const starPercentages = computed(() => {
  if (!stats.value || stats.value.totalRatings === 0) {
    return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  }
  const total = stats.value.totalRatings
  const result: Record<number, number> = {}
  for (let i = 1; i <= 5; i++) {
    result[i] = Math.round((stats.value.distribution[i] || 0) / total * 100)
  }
  return result
})

// Helpers
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-700'
    case 'SENT':
      return 'bg-blue-100 text-blue-700'
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700'
    case 'EXPIRED':
      return 'bg-red-100 text-red-700'
    case 'SKIPPED':
      return 'bg-gray-100 text-gray-500'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    COMPLETED: 'Valorado',
    SENT: 'Enviado',
    PENDING: 'Pendiente',
    EXPIRED: 'Expirado',
    SKIPPED: 'Omitido',
  }
  return labels[status] || status
}

const getWorkerNames = (rating: Rating) => {
  if (!rating.appointment?.appointmentWorkers?.length) return 'Sin asignar'
  return rating.appointment.appointmentWorkers
    .map(w => `${w.user.firstName} ${w.user.lastName}`)
    .join(', ')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Valoraciones</h1>
        <p class="text-surface-500 mt-1">Opiniones anónimas de los pacientes sobre sus visitas</p>
      </div>
      <button
        @click="loadData"
        class="btn-secondary flex items-center gap-2"
        :disabled="loading"
      >
        <ArrowPathIcon class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        Actualizar
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <ArrowPathIcon class="w-8 h-8 animate-spin text-primary-600" />
    </div>

    <!-- Content -->
    <div v-else>
      <!-- Tabs -->
      <div class="bg-white rounded-xl border border-surface-200 mb-6">
        <nav class="flex gap-2 p-2">
          <button
            @click="selectedTab = 'overview'"
            :class="[
              'flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-all',
              selectedTab === 'overview'
                ? 'bg-primary-50 text-primary-700 shadow-sm'
                : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50',
            ]"
          >
            <ChartBarIcon class="w-5 h-5" />
            Resumen
          </button>
          <button
            @click="selectedTab = 'ratings'"
            :class="[
              'flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-all',
              selectedTab === 'ratings'
                ? 'bg-primary-50 text-primary-700 shadow-sm'
                : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50',
            ]"
          >
            <ChatBubbleLeftEllipsisIcon class="w-5 h-5" />
            Valoraciones
          </button>
          <button
            @click="selectedTab = 'requests'"
            :class="[
              'flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-all',
              selectedTab === 'requests'
                ? 'bg-primary-50 text-primary-700 shadow-sm'
                : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50',
            ]"
          >
            <ClockIcon class="w-5 h-5" />
            Solicitudes
          </button>
        </nav>
      </div>

      <!-- Overview Tab -->
      <div v-if="selectedTab === 'overview'" class="space-y-6">
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Average Rating -->
          <div class="card p-6 text-center">
            <div class="flex justify-center items-center gap-1 mb-2">
              <span class="text-4xl font-bold text-surface-900">{{ avgRatingDisplay }}</span>
              <StarIcon class="w-8 h-8 text-amber-400" />
            </div>
            <p class="text-surface-500">Valoración media</p>
            <p class="text-sm text-surface-400 mt-1">{{ stats?.totalRatings || 0 }} valoraciones</p>
          </div>

          <!-- Distribution -->
          <div class="card p-6 col-span-2">
            <h3 class="font-semibold text-surface-900 mb-4">Distribución de valoraciones</h3>
            <div class="space-y-2">
              <div v-for="star in [5, 4, 3, 2, 1]" :key="star" class="flex items-center gap-3">
                <div class="flex items-center gap-1 w-16">
                  <span class="text-sm font-medium text-surface-700">{{ star }}</span>
                  <StarIcon class="w-4 h-4 text-amber-400" />
                </div>
                <div class="flex-1 bg-surface-100 rounded-full h-3">
                  <div
                    class="h-3 rounded-full transition-all"
                    :class="star >= 4 ? 'bg-green-500' : star === 3 ? 'bg-yellow-500' : 'bg-red-400'"
                    :style="{ width: `${starPercentages[star]}%` }"
                  ></div>
                </div>
                <span class="text-sm text-surface-500 w-12 text-right">{{ starPercentages[star] }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Info Box -->
        <div class="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h4 class="font-semibold text-blue-800 mb-2">📧 ¿Cómo funciona?</h4>
          <ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Cuando una cita se marca como <strong>completada</strong>, se programa un email automático</li>
            <li>El email se envía <strong>24 horas después</strong> con un enlace único y anónimo</li>
            <li>El paciente puede valorar su experiencia con estrellas (1-5) y un comentario opcional</li>
            <li>El enlace es válido durante <strong>7 días</strong> y solo puede usarse una vez</li>
          </ul>
        </div>

        <!-- Recent Ratings Preview -->
        <div class="card p-6" v-if="recentRatings.length > 0">
          <h3 class="font-semibold text-surface-900 mb-4">Últimas valoraciones</h3>
          <div class="space-y-3">
            <div
              v-for="rating in recentRatings.slice(0, 3)"
              :key="rating.id"
              class="flex items-start gap-4 p-4 bg-surface-50 rounded-xl"
            >
              <div class="flex gap-0.5">
                <StarIcon
                  v-for="i in 5"
                  :key="i"
                  class="w-5 h-5"
                  :class="i <= rating.rating ? 'text-amber-400' : 'text-surface-200'"
                />
              </div>
              <div class="flex-1">
                <p v-if="rating.comment" class="text-surface-700 italic">"{{ rating.comment }}"</p>
                <p v-else class="text-surface-400 text-sm">Sin comentario</p>
                <p class="text-xs text-surface-400 mt-1">
                  {{ getWorkerNames(rating) }} · {{ formatDate(rating.createdAt) }}
                </p>
              </div>
            </div>
          </div>
          <button
            v-if="recentRatings.length > 3"
            @click="selectedTab = 'ratings'"
            class="btn-secondary btn-sm mt-4"
          >
            Ver todas las valoraciones
          </button>
        </div>

        <!-- No ratings yet -->
        <div v-else class="card p-12 text-center">
          <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <StarOutline class="w-8 h-8 text-surface-400" />
          </div>
          <h3 class="text-lg font-semibold text-surface-700 mb-2">Aún no hay valoraciones</h3>
          <p class="text-surface-500">Las valoraciones aparecerán aquí cuando los pacientes respondan a los emails de solicitud</p>
        </div>
      </div>

      <!-- Ratings Tab -->
      <div v-if="selectedTab === 'ratings'" class="space-y-4">
        <div v-if="recentRatings.length === 0" class="card p-12 text-center">
          <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ChatBubbleLeftEllipsisIcon class="w-8 h-8 text-surface-400" />
          </div>
          <h3 class="text-lg font-semibold text-surface-700 mb-2">Sin valoraciones</h3>
          <p class="text-surface-500">Cuando los pacientes valoren sus visitas, podrás verlas aquí</p>
        </div>

        <div v-else class="card divide-y divide-surface-100">
          <div
            v-for="rating in recentRatings"
            :key="rating.id"
            class="p-5 hover:bg-surface-50 transition-colors"
          >
            <div class="flex items-start gap-4">
              <!-- Stars -->
              <div class="flex gap-0.5 shrink-0">
                <StarIcon
                  v-for="i in 5"
                  :key="i"
                  class="w-5 h-5"
                  :class="i <= rating.rating ? 'text-amber-400' : 'text-surface-200'"
                />
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <p v-if="rating.comment" class="text-surface-700">"{{ rating.comment }}"</p>
                <p v-else class="text-surface-400 italic text-sm">Sin comentario</p>
                <div class="flex items-center gap-3 mt-2 text-sm text-surface-500">
                  <span class="flex items-center gap-1">
                    <UserIcon class="w-4 h-4" />
                    {{ getWorkerNames(rating) }}
                  </span>
                  <span>·</span>
                  <span>{{ formatDate(rating.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Requests Tab -->
      <div v-if="selectedTab === 'requests'" class="space-y-4">
        <div v-if="ratingRequests.length === 0" class="card p-12 text-center">
          <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClockIcon class="w-8 h-8 text-surface-400" />
          </div>
          <h3 class="text-lg font-semibold text-surface-700 mb-2">Sin solicitudes</h3>
          <p class="text-surface-500">Las solicitudes de valoración aparecerán aquí cuando se marquen citas como completadas</p>
        </div>

        <div v-else class="card overflow-hidden">
          <table class="min-w-full divide-y divide-surface-200">
            <thead class="bg-surface-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Paciente</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Fecha cita</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Estado</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Programado</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Expira</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr v-for="request in ratingRequests" :key="request.id" class="hover:bg-surface-50">
                <td class="px-4 py-3">
                  <div class="font-medium text-surface-900">
                    {{ request.patient?.firstName }} {{ request.patient?.lastName }}
                  </div>
                  <div class="text-sm text-surface-500">{{ request.patient?.email || 'Sin email' }}</div>
                </td>
                <td class="px-4 py-3 text-sm text-surface-700">
                  {{ request.appointment ? formatDate(request.appointment.startTime) : '-' }}
                </td>
                <td class="px-4 py-3">
                  <span
                    :class="[
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                      getStatusBadgeClass(request.status),
                    ]"
                  >
                    <CheckCircleIcon v-if="request.status === 'COMPLETED'" class="w-3.5 h-3.5" />
                    <ClockIcon v-else-if="request.status === 'PENDING'" class="w-3.5 h-3.5" />
                    <ExclamationTriangleIcon v-else-if="request.status === 'EXPIRED'" class="w-3.5 h-3.5" />
                    {{ getStatusLabel(request.status) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-surface-500">
                  {{ formatDate(request.scheduledFor) }}
                </td>
                <td class="px-4 py-3 text-sm text-surface-500">
                  {{ formatDate(request.expiresAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
}
</style>
