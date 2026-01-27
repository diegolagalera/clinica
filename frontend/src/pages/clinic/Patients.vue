<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import type { Patient, ApiResponse, PaginatedResponse } from '@/types'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()
const authStore = useAuthStore()

// State
const patients = ref<Patient[]>([])
const isLoading = ref(true)
const error = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)

// Modal state
const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const selectedPatient = ref<Patient | null>(null)
const formData = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  idNumber: '',
  address: '',
  city: '',
  postalCode: '',
  allergies: '',
  notes: '',
})
const isSaving = ref(false)
const formError = ref('')

// Load patients
const loadPatients = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const response = await api.get<ApiResponse<PaginatedResponse<Patient>>>('/patients', {
      params: {
        page: currentPage.value,
        limit: 10,
        search: searchQuery.value || undefined,
      },
    })
    
    if (response.success && response.data) {
      patients.value = response.data.data
      totalPages.value = response.data.pagination.totalPages
      total.value = response.data.pagination.total
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error loading patients'
  } finally {
    isLoading.value = false
  }
}

// Save patient
const savePatient = async () => {
  formError.value = ''
  isSaving.value = true
  
  try {
    const payload = {
      ...formData.value,
      dateOfBirth: formData.value.dateOfBirth || undefined,
    }
    
    if (modalMode.value === 'create') {
      await api.post('/patients', payload)
    } else if (selectedPatient.value) {
      await api.put(`/patients/${selectedPatient.value.id}`, payload)
    }
    
    showModal.value = false
    resetForm()
    await loadPatients()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error saving patient'
  } finally {
    isSaving.value = false
  }
}

// Modal helpers
const openCreateModal = () => {
  modalMode.value = 'create'
  resetForm()
  showModal.value = true
}

const openEditModal = (patient: Patient) => {
  modalMode.value = 'edit'
  selectedPatient.value = patient
  formData.value = {
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email || '',
    phone: patient.phone || '',
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split('T')[0] : '',
    gender: patient.gender || '',
    idNumber: patient.idNumber || '',
    address: patient.address || '',
    city: patient.city || '',
    postalCode: patient.postalCode || '',
    allergies: patient.allergies || '',
    notes: patient.notes || '',
  }
  showModal.value = true
}

const resetForm = () => {
  formData.value = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    idNumber: '',
    address: '',
    city: '',
    postalCode: '',
    allergies: '',
    notes: '',
  }
  selectedPatient.value = null
  formError.value = ''
}

const viewPatient = (patient: Patient) => {
  router.push(`/clinic/patients/${patient.id}`)
}

// Search debounce
let searchTimeout: number
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    currentPage.value = 1
    loadPatients()
  }, 300)
})

onMounted(() => {
  loadPatients()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold text-surface-900">Pacientes</h1>
        <p class="text-surface-500 mt-1">Gestiona los pacientes de la clínica</p>
      </div>
      <button @click="openCreateModal" class="btn-primary">
        <PlusIcon class="w-5 h-5" />
        Nuevo Paciente
      </button>
    </div>

    <!-- Search -->
    <div class="flex gap-4">
      <div class="relative flex-1 max-w-md">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por nombre, email o teléfono..."
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

    <!-- Patients list -->
    <div v-else-if="patients.length > 0" class="grid gap-4">
      <div 
        v-for="patient in patients" 
        :key="patient.id"
        @click="viewPatient(patient)"
        class="card p-4 cursor-pointer hover:shadow-glow transition-shadow"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold flex-shrink-0">
            {{ patient.firstName.charAt(0) }}{{ patient.lastName.charAt(0) }}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-surface-900">
              {{ patient.firstName }} {{ patient.lastName }}
            </h3>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span v-if="patient.email" class="flex items-center gap-1 text-sm text-surface-500">
                <EnvelopeIcon class="w-3 h-3" />
                {{ patient.email }}
              </span>
              <span v-if="patient.phone" class="flex items-center gap-1 text-sm text-surface-500">
                <PhoneIcon class="w-3 h-3" />
                {{ patient.phone }}
              </span>
            </div>
          </div>
          <span :class="patient.isActive ? 'badge-success' : 'badge-neutral'" class="flex-shrink-0">
            {{ patient.isActive ? 'Activo' : 'Inactivo' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card p-12 text-center">
      <UserGroupIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-medium text-surface-900 mb-2">No hay pacientes</h3>
      <p class="text-surface-500 mb-6">Crea el primer paciente para comenzar</p>
      <button @click="openCreateModal" class="btn-primary">
        <PlusIcon class="w-5 h-5" />
        Nuevo Paciente
      </button>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-surface-500">
        Mostrando {{ patients.length }} de {{ total }} pacientes
      </p>
      <div class="flex gap-2">
        <button 
          @click="currentPage--; loadPatients()"
          :disabled="currentPage <= 1"
          class="btn-secondary btn-sm"
        >
          Anterior
        </button>
        <button 
          @click="currentPage++; loadPatients()"
          :disabled="currentPage >= totalPages"
          class="btn-secondary btn-sm"
        >
          Siguiente
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 sticky top-0 bg-white">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ modalMode === 'create' ? 'Nuevo Paciente' : 'Editar Paciente' }}
            </h2>
            <button @click="showModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="savePatient" class="p-6 space-y-4">
            <div v-if="formError" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
              {{ formError }}
            </div>
            
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="label">Nombre *</label>
                <input v-model="formData.firstName" type="text" required class="input" placeholder="María" />
              </div>
              
              <div>
                <label class="label">Apellidos *</label>
                <input v-model="formData.lastName" type="text" required class="input" placeholder="García López" />
              </div>
              
              <div>
                <label class="label">Email</label>
                <input v-model="formData.email" type="email" class="input" placeholder="maria@email.com" />
              </div>
              
              <div>
                <label class="label">Teléfono</label>
                <input v-model="formData.phone" type="tel" class="input" placeholder="+34 612 345 678" />
              </div>
              
              <div>
                <label class="label">Fecha de nacimiento</label>
                <input v-model="formData.dateOfBirth" type="date" class="input" />
              </div>
              
              <div>
                <label class="label">Género</label>
                <select v-model="formData.gender" class="input">
                  <option value="">Seleccionar...</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              
              <div>
                <label class="label">DNI/NIE</label>
                <input v-model="formData.idNumber" type="text" class="input" placeholder="12345678A" />
              </div>
              
              <div>
                <label class="label">Ciudad</label>
                <input v-model="formData.city" type="text" class="input" placeholder="Madrid" />
              </div>
              
              <div class="md:col-span-2">
                <label class="label">Dirección</label>
                <input v-model="formData.address" type="text" class="input" placeholder="Calle Mayor 10, 2ºB" />
              </div>
              
              <div class="md:col-span-2">
                <label class="label">Alergias</label>
                <textarea v-model="formData.allergies" class="input" rows="2" placeholder="Penicilina, látex..."></textarea>
              </div>
              
              <div class="md:col-span-2">
                <label class="label">Notas</label>
                <textarea v-model="formData.notes" class="input" rows="2" placeholder="Notas adicionales..."></textarea>
              </div>
            </div>
            
            <div class="flex gap-3 pt-4">
              <button type="button" @click="showModal = false" class="btn-secondary flex-1">
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
  </div>
</template>
