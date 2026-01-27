<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Appointment } from '@/types'
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()

// State
const appointments = ref<Appointment[]>([])
const isLoading = ref(true)
const activeTab = ref<'upcoming' | 'past'>('upcoming')

// Load appointments
const loadAppointments = async () => {
  isLoading.value = true
  
  try {
    // In a real implementation, this would call a patient-specific endpoint
    // For now, show placeholder state
    appointments.value = []
  } catch (err) {
    console.error('Error loading appointments:', err)
  } finally {
    isLoading.value = false
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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
  loadAppointments()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-display font-bold text-surface-900">Mis Citas</h1>
      <p class="text-surface-500 mt-1">Consulta tus citas programadas</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2">
      <button 
        @click="activeTab = 'upcoming'"
        :class="activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'"
        class="btn-sm"
      >
        Próximas
      </button>
      <button 
        @click="activeTab = 'past'"
        :class="activeTab === 'past' ? 'btn-primary' : 'btn-secondary'"
        class="btn-sm"
      >
        Anteriores
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- Appointments list -->
    <div v-else-if="appointments.length > 0" class="space-y-4">
      <div 
        v-for="apt in appointments" 
        :key="apt.id"
        class="card p-4"
      >
        <div class="flex items-start gap-4">
          <div class="w-16 h-16 rounded-xl bg-primary-100 flex flex-col items-center justify-center text-primary-700 flex-shrink-0">
            <span class="text-2xl font-bold">{{ new Date(apt.startTime).getDate() }}</span>
            <span class="text-xs">{{ new Date(apt.startTime).toLocaleDateString('es-ES', { month: 'short' }) }}</span>
          </div>
          <div class="flex-1">
            <div class="flex items-start justify-between">
              <div>
                <p class="font-medium text-surface-900">{{ apt.title || apt.type }}</p>
                <p class="text-surface-500 text-sm mt-1">
                  <ClockIcon class="w-4 h-4 inline mr-1" />
                  {{ formatTime(apt.startTime) }} - {{ formatTime(apt.endTime) }}
                </p>
                <p class="text-surface-500 text-sm mt-1">
                  Dr. {{ apt.worker?.firstName }} {{ apt.worker?.lastName }}
                </p>
              </div>
              <span :class="getStatusClass(apt.status)">
                {{ getStatusLabel(apt.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card p-12 text-center">
      <CalendarDaysIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-medium text-surface-900 mb-2">
        {{ activeTab === 'upcoming' ? 'No tienes citas próximas' : 'No tienes citas anteriores' }}
      </h3>
      <p class="text-surface-500">
        {{ activeTab === 'upcoming' ? 'Contacta con tu clínica para programar una cita' : 'Aquí aparecerán tus citas pasadas' }}
      </p>
    </div>
  </div>
</template>
