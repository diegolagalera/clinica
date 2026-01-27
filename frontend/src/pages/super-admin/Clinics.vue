<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api } from '@/services/api'
import type { Clinic, Organization, ApiResponse, PaginatedResponse } from '@/types'
import {
  MagnifyingGlassIcon,
  BuildingStorefrontIcon,
  BuildingOffice2Icon,
} from '@heroicons/vue/24/outline'

interface ClinicWithOrg extends Clinic {
  organization?: Organization
}

// State
const clinics = ref<ClinicWithOrg[]>([])
const isLoading = ref(true)
const error = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)

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
        
        <div class="mt-4 pt-4 border-t border-surface-100 grid grid-cols-2 gap-4 text-center">
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
  </div>
</template>
