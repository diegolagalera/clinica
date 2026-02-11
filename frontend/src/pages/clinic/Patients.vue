<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import type { Patient, ApiResponse, PaginatedResponse } from '@/types'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  PencilIcon,
} from '@heroicons/vue/24/outline'
import PhoneCountrySelect from '@/components/PhoneCountrySelect.vue'

const router = useRouter()

// Country codes list (most common for Spain market)
const countryCodes = [
  { code: '+34', country: 'ES', name: 'España', flag: '🇪🇸' },
  { code: '+33', country: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: '+351', country: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: '+44', country: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  { code: '+49', country: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: '+39', country: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: '+212', country: 'MA', name: 'Marruecos', flag: '🇲🇦' },
  { code: '+52', country: 'MX', name: 'México', flag: '🇲🇽' },
  { code: '+54', country: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: '+57', country: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: '+1', country: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+55', country: 'BR', name: 'Brasil', flag: '🇧🇷' },
]

// State
const patients = ref<Patient[]>([])
const isLoading = ref(true)
const error = ref('')
const searchQuery = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
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
  phoneCountry: '+34',
  phoneNumber: '',
  dateOfBirth: '',
  gender: '',
  idNumber: '',
  address: '',
  city: '',
  postalCode: '',
  allergies: '',
  notes: '',
  isActive: true,
  acceptsMarketing: true,
})
const isSaving = ref(false)

// Load patients
const loadPatients = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const params: Record<string, unknown> = {
      page: currentPage.value,
      limit: 10,
      search: searchQuery.value || undefined,
    }
    
    // Add status filter
    if (statusFilter.value === 'active') {
      params.isActive = 'true'
    } else if (statusFilter.value === 'inactive') {
      params.isActive = 'false'
    }
    
    const response = await api.get<ApiResponse<PaginatedResponse<Patient>>>('/patients', { params })
    
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
  isSaving.value = true
  
  try {
    // Combine phone in E.164 format
    const phone = formData.value.phoneNumber 
      ? `${formData.value.phoneCountry}${formData.value.phoneNumber.replace(/\D/g, '')}`
      : ''
    
    const payload = {
      firstName: formData.value.firstName,
      lastName: formData.value.lastName,
      email: formData.value.email,
      phone,
      dateOfBirth: formData.value.dateOfBirth || undefined,
      gender: formData.value.gender,
      idNumber: formData.value.idNumber,
      address: formData.value.address,
      city: formData.value.city,
      postalCode: formData.value.postalCode,
      allergies: formData.value.allergies,
      notes: formData.value.notes,
      isActive: formData.value.isActive,
      acceptsMarketing: formData.value.acceptsMarketing,
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
    // Error toast is handled by API service interceptor
    // Keep modal open for user to fix the form
    showModal.value = true
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
  
  // Parse phone number to extract country code and number
  let phoneCountry = '+34'
  let phoneNumber = ''
  if (patient.phone) {
    // Try to find matching country code
    const matchedCountry = countryCodes.find(c => patient.phone?.startsWith(c.code))
    if (matchedCountry) {
      phoneCountry = matchedCountry.code
      phoneNumber = patient.phone.slice(matchedCountry.code.length)
    } else {
      // If no match, assume it's the full number without country code
      phoneNumber = patient.phone.replace(/^\+/, '')
    }
  }
  
  formData.value = {
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email || '',
    phoneCountry,
    phoneNumber,
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split('T')[0] : '',
    gender: patient.gender || '',
    idNumber: patient.idNumber || '',
    address: patient.address || '',
    city: patient.city || '',
    postalCode: patient.postalCode || '',
    allergies: patient.allergies || '',
    notes: patient.notes || '',
    isActive: patient.isActive,
    acceptsMarketing: (patient as any).acceptsMarketing ?? true,
  }
  showModal.value = true
}

const resetForm = () => {
  formData.value = {
    firstName: '',
    lastName: '',
    email: '',
    phoneCountry: '+34',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    idNumber: '',
    address: '',
    city: '',
    postalCode: '',
    allergies: '',
    notes: '',
    isActive: true,
    acceptsMarketing: true,
  }
  selectedPatient.value = null
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

// Status filter change
watch(statusFilter, () => {
  currentPage.value = 1
  loadPatients()
})

// Toggle patient active status
const togglePatientStatus = async (patient: Patient, event: Event) => {
  event.stopPropagation()
  try {
    await api.put(`/patients/${patient.id}`, { isActive: !patient.isActive })
    await loadPatients()
  } catch (err: any) {
    console.error('Error updating patient status:', err)
  }
}

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

    <!-- Search and Filter -->
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
      <select v-model="statusFilter" class="input w-auto pr-10 cursor-pointer">
        <option value="all">Todos los pacientes</option>
        <option value="active">Solo activos</option>
        <option value="inactive">Solo inactivos</option>
      </select>
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
                <!-- WhatsApp unavailable warning -->
                <span v-if="patient.whatsappAvailable === false" class="relative group ml-0.5">
                  <span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-600 cursor-help">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                  </span>
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50">
                    Este número no existe en WhatsApp
                    <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-800"></div>
                  </div>
                </span>
              </span>
            </div>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <!-- Toggle de estado activo con tooltip -->
            <div class="relative group">
              <button
                @click="togglePatientStatus(patient, $event)"
                :class="patient.isActive ? 'bg-primary-600' : 'bg-surface-300'"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              >
                <span
                  :class="patient.isActive ? 'translate-x-6' : 'translate-x-1'"
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                />
              </button>
              <!-- Tooltip a la izquierda -->
              <div class="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-3 py-1.5 bg-surface-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50">
                {{ patient.isActive ? 'Desactivar paciente' : 'Activar paciente' }}
                <div class="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-surface-800"></div>
              </div>
            </div>
            <button 
              @click.stop="openEditModal(patient)"
              class="p-2 text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Editar paciente"
            >
              <PencilIcon class="w-5 h-5" />
            </button>
          </div>
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
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in">
          <!-- Header (sticky) -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 flex-shrink-0">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ modalMode === 'create' ? 'Nuevo Paciente' : 'Editar Paciente' }}
            </h2>
            <button @click="showModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <!-- Scrollable content -->
          <form @submit.prevent="savePatient" class="flex flex-col flex-1 overflow-hidden">
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
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
                
                <div class="md:col-span-2">
                  <label class="label">Teléfono</label>
                  <div class="flex gap-2">
                    <PhoneCountrySelect v-model="formData.phoneCountry" />
                    <input 
                      v-model="formData.phoneNumber" 
                      type="tel" 
                      class="input flex-1" 
                      placeholder="612345678"
                      @input="formData.phoneNumber = formData.phoneNumber.replace(/\D/g, '')"
                    />
                  </div>
                  <p class="text-xs text-surface-400 mt-1">Solo números, sin espacios</p>
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
                
                <!-- Marketing Preferences -->
                <div class="md:col-span-2 pt-4 border-t border-surface-200">
                  <div class="flex items-center justify-between">
                    <div>
                      <label class="label mb-0">📧 Acepta emails de marketing</label>
                      <p class="text-xs text-surface-400">Cumpleaños, promociones y newsletters</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        v-model="formData.acceptsMarketing" 
                        class="sr-only peer"
                      />
                      <div class="w-11 h-6 bg-surface-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Footer (sticky) -->
            <div class="flex gap-3 px-6 py-4 border-t border-surface-100 flex-shrink-0 bg-white rounded-b-2xl">
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
