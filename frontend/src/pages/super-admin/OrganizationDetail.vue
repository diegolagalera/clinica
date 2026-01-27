<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/services/api'
import type { Organization, Clinic, ApiResponse } from '@/types'
import {
  ArrowLeftIcon,
  BuildingStorefrontIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const orgId = computed(() => route.params.id as string)

// State
const organization = ref<Organization | null>(null)
const clinics = ref<Clinic[]>([])
const stats = ref({ clinicsCount: 0, usersCount: 0 })
const isLoading = ref(true)
const error = ref('')

// Clinic modal
const showClinicModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const selectedClinic = ref<Clinic | null>(null)
const clinicForm = ref({
  name: '',
  slug: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'ES',
  timezone: 'Europe/Madrid',
})
const isSaving = ref(false)
const formError = ref('')

// Delete confirmation
const showDeleteConfirm = ref(false)
const clinicToDelete = ref<Clinic | null>(null)
const isDeleting = ref(false)

// Load organization data
const loadOrganization = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const [orgResponse, statsResponse] = await Promise.all([
      api.get<ApiResponse<Organization>>(`/organizations/${orgId.value}`),
      api.get<ApiResponse<{ clinicsCount: number; usersCount: number }>>(`/organizations/${orgId.value}/stats`),
    ])
    
    if (orgResponse.success && orgResponse.data) {
      organization.value = orgResponse.data
    }
    
    if (statsResponse.success && statsResponse.data) {
      stats.value = statsResponse.data
      // Load clinics from stats response if available
      if ('organization' in statsResponse.data && (statsResponse.data as any).organization?.clinics) {
        clinics.value = (statsResponse.data as any).organization.clinics
      }
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error loading organization'
  } finally {
    isLoading.value = false
  }
}

// Save clinic
const saveClinic = async () => {
  formError.value = ''
  isSaving.value = true
  
  try {
    if (modalMode.value === 'create') {
      await api.post('/clinics', {
        ...clinicForm.value,
        organizationId: orgId.value,
      })
    } else if (selectedClinic.value) {
      await api.put(`/clinics/${selectedClinic.value.id}`, clinicForm.value)
    }
    
    showClinicModal.value = false
    resetForm()
    await loadOrganization()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error saving clinic'
  } finally {
    isSaving.value = false
  }
}

// Delete clinic
const deleteClinic = async () => {
  if (!clinicToDelete.value) return
  
  isDeleting.value = true
  
  try {
    await api.delete(`/clinics/${clinicToDelete.value.id}`)
    showDeleteConfirm.value = false
    clinicToDelete.value = null
    await loadOrganization()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error deleting clinic'
  } finally {
    isDeleting.value = false
  }
}

// Modal helpers
const openCreateClinicModal = () => {
  modalMode.value = 'create'
  resetForm()
  showClinicModal.value = true
}

const openEditClinicModal = (clinic: Clinic) => {
  modalMode.value = 'edit'
  selectedClinic.value = clinic
  clinicForm.value = {
    name: clinic.name,
    slug: clinic.slug,
    email: clinic.email || '',
    phone: clinic.phone || '',
    address: clinic.address || '',
    city: clinic.city || '',
    postalCode: clinic.postalCode || '',
    country: clinic.country || 'ES',
    timezone: clinic.timezone || 'Europe/Madrid',
  }
  showClinicModal.value = true
}

const resetForm = () => {
  clinicForm.value = {
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'ES',
    timezone: 'Europe/Madrid',
  }
  selectedClinic.value = null
  formError.value = ''
}

const confirmDeleteClinic = (clinic: Clinic) => {
  clinicToDelete.value = clinic
  showDeleteConfirm.value = true
}

onMounted(() => {
  loadOrganization()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <button @click="router.push('/admin/organizations')" class="flex items-center gap-2 text-surface-500 hover:text-surface-700">
      <ArrowLeftIcon class="w-5 h-5" />
      Volver a organizaciones
    </button>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-4 rounded-xl bg-danger-50 text-danger-600">
      {{ error }}
    </div>

    <!-- Content -->
    <template v-else-if="organization">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-display font-bold text-surface-900">{{ organization.name }}</h1>
          <p class="text-surface-500 mt-1">{{ organization.slug }}</p>
        </div>
        <span :class="organization.isActive ? 'badge-success' : 'badge-neutral'">
          {{ organization.isActive ? 'Activa' : 'Inactiva' }}
        </span>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="stat-card">
          <p class="stat-value">{{ stats.clinicsCount }}</p>
          <p class="stat-label">Clínicas</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">{{ stats.usersCount }}</p>
          <p class="stat-label">Usuarios</p>
        </div>
      </div>

      <!-- Organization details -->
      <div class="card">
        <div class="card-header">
          <h2 class="font-semibold text-surface-900">Detalles</h2>
        </div>
        <div class="card-body grid md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-surface-500">Email</p>
            <p class="text-surface-900">{{ organization.email || '-' }}</p>
          </div>
          <div>
            <p class="text-sm text-surface-500">Teléfono</p>
            <p class="text-surface-900">{{ organization.phone || '-' }}</p>
          </div>
          <div class="md:col-span-2">
            <p class="text-sm text-surface-500">Dirección</p>
            <p class="text-surface-900">{{ organization.address || '-' }}</p>
          </div>
        </div>
      </div>

      <!-- Clinics section -->
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <h2 class="font-semibold text-surface-900">Clínicas</h2>
          <button @click="openCreateClinicModal" class="btn-primary btn-sm">
            <PlusIcon class="w-4 h-4" />
            Nueva Clínica
          </button>
        </div>
        
        <div v-if="clinics.length > 0" class="divide-y divide-surface-100">
          <div 
            v-for="clinic in clinics" 
            :key="clinic.id"
            class="flex items-center gap-4 p-4 hover:bg-surface-50 transition-colors"
          >
            <div class="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center flex-shrink-0">
              <BuildingStorefrontIcon class="w-5 h-5 text-accent-600" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-surface-900">{{ clinic.name }}</p>
              <p class="text-sm text-surface-500">{{ clinic.city || clinic.address || clinic.slug }}</p>
            </div>
            <span :class="clinic.isActive ? 'badge-success' : 'badge-neutral'">
              {{ clinic.isActive ? 'Activa' : 'Inactiva' }}
            </span>
            <div class="flex items-center gap-2">
              <button @click="openEditClinicModal(clinic)" class="btn-ghost btn-sm">
                <PencilIcon class="w-4 h-4" />
              </button>
              <button @click="confirmDeleteClinic(clinic)" class="btn-ghost btn-sm text-danger-600">
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div v-else class="p-8 text-center text-surface-500">
          <BuildingStorefrontIcon class="w-10 h-10 mx-auto mb-3 text-surface-300" />
          <p>No hay clínicas en esta organización</p>
        </div>
      </div>
    </template>

    <!-- Clinic Modal -->
    <Teleport to="body">
      <div v-if="showClinicModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showClinicModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 sticky top-0 bg-white">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ modalMode === 'create' ? 'Nueva Clínica' : 'Editar Clínica' }}
            </h2>
            <button @click="showClinicModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="saveClinic" class="p-6 space-y-4">
            <div v-if="formError" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
              {{ formError }}
            </div>
            
            <div class="grid md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="label">Nombre *</label>
                <input v-model="clinicForm.name" type="text" required class="input" placeholder="Clínica Dental Centro" />
              </div>
              
              <div class="md:col-span-2">
                <label class="label">Slug *</label>
                <input v-model="clinicForm.slug" type="text" required class="input" placeholder="centro" />
              </div>
              
              <div>
                <label class="label">Email</label>
                <input v-model="clinicForm.email" type="email" class="input" placeholder="centro@clinica.com" />
              </div>
              
              <div>
                <label class="label">Teléfono</label>
                <input v-model="clinicForm.phone" type="tel" class="input" placeholder="+34 912 345 678" />
              </div>
              
              <div class="md:col-span-2">
                <label class="label">Dirección</label>
                <input v-model="clinicForm.address" type="text" class="input" placeholder="Calle Sol 45" />
              </div>
              
              <div>
                <label class="label">Ciudad</label>
                <input v-model="clinicForm.city" type="text" class="input" placeholder="Madrid" />
              </div>
              
              <div>
                <label class="label">Código Postal</label>
                <input v-model="clinicForm.postalCode" type="text" class="input" placeholder="28001" />
              </div>
            </div>
            
            <div class="flex gap-3 pt-4">
              <button type="button" @click="showClinicModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isSaving" class="btn-primary flex-1">
                {{ isSaving ? 'Guardando...' : (modalMode === 'create' ? 'Crear' : 'Guardar') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showDeleteConfirm = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
          <div class="p-6 text-center">
            <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-danger-50 flex items-center justify-center">
              <TrashIcon class="w-6 h-6 text-danger-600" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">¿Eliminar clínica?</h3>
            <p class="text-surface-500 mb-6">
              Esta acción eliminará permanentemente <strong>{{ clinicToDelete?.name }}</strong>.
            </p>
            <div class="flex gap-3">
              <button @click="showDeleteConfirm = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button @click="deleteClinic" :disabled="isDeleting" class="btn-danger flex-1">
                {{ isDeleting ? 'Eliminando...' : 'Eliminar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
