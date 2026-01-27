<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import type { Appointment, ApiResponse } from '@/types'
import {
  CalendarDaysIcon,
  ClockIcon,
  DocumentTextIcon,
  BellIcon,
  ArrowRightIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()
const authStore = useAuthStore()

// State
const nextAppointment = ref<Appointment | null>(null)
const upcomingAppointments = ref<Appointment[]>([])
const isLoading = ref(true)

// Load dashboard data
const loadDashboard = async () => {
  isLoading.value = true
  
  try {
    // For patients, we'd need a patient-specific endpoint
    // For now, show placeholder data
    // In a real implementation, you'd call /patients/me/appointments
  } catch (err) {
    console.error('Error loading dashboard:', err)
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

onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Welcome header -->
    <div class="card p-6 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
      <h1 class="text-2xl font-display font-bold">
        ¡Bienvenido, {{ authStore.user?.firstName }}!
      </h1>
      <p class="opacity-90 mt-1">
        Tu portal de paciente para gestionar tus citas y documentos
      </p>
    </div>

    <!-- Next appointment -->
    <div class="card">
      <div class="card-header">
        <h2 class="font-semibold text-surface-900">Próxima Cita</h2>
      </div>
      
      <div v-if="nextAppointment" class="card-body">
        <div class="flex items-start gap-4">
          <div class="w-16 h-16 rounded-xl bg-primary-100 flex flex-col items-center justify-center text-primary-700">
            <span class="text-2xl font-bold">{{ new Date(nextAppointment.startTime).getDate() }}</span>
            <span class="text-xs">{{ new Date(nextAppointment.startTime).toLocaleDateString('es-ES', { month: 'short' }) }}</span>
          </div>
          <div class="flex-1">
            <p class="font-medium text-surface-900">{{ nextAppointment.title || nextAppointment.type }}</p>
            <p class="text-surface-500 mt-1">
              <ClockIcon class="w-4 h-4 inline mr-1" />
              {{ formatTime(nextAppointment.startTime) }}
            </p>
            <p class="text-surface-500 mt-1">
              Dr. {{ nextAppointment.worker?.firstName }} {{ nextAppointment.worker?.lastName }}
            </p>
          </div>
        </div>
      </div>
      
      <div v-else class="card-body text-center py-8 text-surface-500">
        <CalendarDaysIcon class="w-10 h-10 mx-auto mb-3 text-surface-300" />
        <p>No tienes citas programadas</p>
        <RouterLink to="/patient/appointments" class="btn-primary mt-4">
          Ver Citas
        </RouterLink>
      </div>
    </div>

    <!-- Quick links -->
    <div class="grid md:grid-cols-3 gap-4">
      <RouterLink 
        to="/patient/appointments" 
        class="card p-6 hover:shadow-glow transition-shadow group"
      >
        <CalendarDaysIcon class="w-8 h-8 text-primary-500 mb-3" />
        <h3 class="font-semibold text-surface-900 group-hover:text-primary-600">Mis Citas</h3>
        <p class="text-sm text-surface-500 mt-1">Ver y gestionar tus citas</p>
      </RouterLink>
      
      <RouterLink 
        to="/patient/records" 
        class="card p-6 hover:shadow-glow transition-shadow group"
      >
        <DocumentTextIcon class="w-8 h-8 text-accent-500 mb-3" />
        <h3 class="font-semibold text-surface-900 group-hover:text-accent-600">Historial</h3>
        <p class="text-sm text-surface-500 mt-1">Consulta tu historial clínico</p>
      </RouterLink>
      
      <RouterLink 
        to="/patient/invoices" 
        class="card p-6 hover:shadow-glow transition-shadow group"
      >
        <DocumentTextIcon class="w-8 h-8 text-warning-500 mb-3" />
        <h3 class="font-semibold text-surface-900 group-hover:text-warning-600">Facturas</h3>
        <p class="text-sm text-surface-500 mt-1">Ver tus facturas</p>
      </RouterLink>
    </div>

    <!-- Notifications -->
    <div class="card">
      <div class="card-header flex items-center gap-2">
        <BellIcon class="w-5 h-5 text-surface-500" />
        <h2 class="font-semibold text-surface-900">Notificaciones</h2>
      </div>
      <div class="card-body text-center py-8 text-surface-500">
        <p>No tienes notificaciones nuevas</p>
      </div>
    </div>
  </div>
</template>
