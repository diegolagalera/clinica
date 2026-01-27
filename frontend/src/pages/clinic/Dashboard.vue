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
} from '@heroicons/vue/24/outline'

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
})
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
    <div class="grid md:grid-cols-3 gap-4">
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
      
      <RouterLink 
        to="/clinic/radiographs" 
        class="card p-6 hover:shadow-glow transition-shadow group"
      >
        <ChartBarIcon class="w-8 h-8 text-warning-500 mb-3" />
        <h3 class="font-semibold text-surface-900 group-hover:text-warning-600">Radiografías</h3>
        <p class="text-sm text-surface-500 mt-1">Análisis con IA</p>
      </RouterLink>
    </div>
  </div>
</template>
