<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/services/api'
import Odontogram from '@/components/odontogram/Odontogram.vue'
import type { Patient, ApiResponse } from '@/types'

const route = useRoute()
const patientId = computed(() => route.params.patientId as string)

const patient = ref<Patient | null>(null)
const isLoading = ref(true)

const loadPatient = async () => {
  try {
    const response = await api.get<ApiResponse<Patient>>(`/patients/${patientId.value}`)
    if (response.success && response.data) {
      patient.value = response.data
    }
  } catch (err) {
    console.error('Error loading patient:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadPatient()
})
</script>

<template>
  <div class="odontogram-fullscreen min-h-screen bg-surface-100">
    <!-- Compact Header -->
    <header class="sticky top-0 z-20 bg-white border-b border-surface-200 shadow-sm">
      <div class="px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold">
            🦷
          </div>
          <div>
            <h1 class="text-lg font-semibold text-surface-900">Odontograma</h1>
            <p v-if="patient" class="text-sm text-surface-500">
              {{ patient.firstName }} {{ patient.lastName }}
            </p>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <span class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Modo Pantalla Completa
          </span>
        </div>
      </div>
    </header>
    
    <!-- Full Odontogram -->
    <main class="p-4 md:p-6">
      <div v-if="isLoading" class="flex items-center justify-center py-20">
        <div class="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
      
      <div v-else-if="!patient" class="text-center py-20">
        <p class="text-surface-500">Paciente no encontrado</p>
      </div>
      
      <Odontogram v-else :patientId="patientId" :isFullscreen="true" />
    </main>
  </div>
</template>
