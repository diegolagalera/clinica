<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/services/api'
import type { ApiResponse, Patient } from '@/types'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  DocumentTextIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckBadgeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  MicrophoneIcon,
  StopIcon,
} from '@heroicons/vue/24/outline'

interface ClinicalRecord {
  id: string
  recordType: string
  title: string | null
  content: string | null
  diagnosis: string | null
  treatment: string | null
  isSigned: boolean
  signedAt: string | null
  createdAt: string
  patient: {
    id: string
    firstName: string
    lastName: string
  }
  createdBy: {
    id: string
    firstName: string
    lastName: string
  }
}

interface RecordType {
  value: string
  label: string
}

// State
const records = ref<ClinicalRecord[]>([])
const patients = ref<Patient[]>([])
const recordTypes = ref<RecordType[]>([])
const total = ref(0)
const page = ref(1)
const limit = ref(10)
const totalPages = computed(() => Math.ceil(total.value / limit.value))
const isLoading = ref(true)
const error = ref('')
const searchQuery = ref('')
const selectedPatientId = ref('')
const selectedRecordType = ref('')
const showFilters = ref(false)

// Modal state
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showViewModal = ref(false)
const selectedRecord = ref<ClinicalRecord | null>(null)

// Form
const recordForm = ref({
  patientId: '',
  recordType: 'NOTE',
  title: '',
  content: '',
  diagnosis: '',
  treatment: '',
})

const isSaving = ref(false)
const formError = ref('')

// Audio recording state
const isRecording = ref(false)
const isTranscribing = ref(false)
const recordingTime = ref(0)
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let recordingInterval: number | undefined

const route = useRoute()

// Load records
const loadRecords = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: limit.value.toString(),
    })
    if (searchQuery.value) params.append('search', searchQuery.value)
    if (selectedPatientId.value) params.append('patientId', selectedPatientId.value)
    if (selectedRecordType.value) params.append('recordType', selectedRecordType.value)
    
    const response = await api.get<ApiResponse<{ data: ClinicalRecord[], pagination: { total: number } }>>(`/clinical-records?${params}`)
    if (response.success && response.data) {
      records.value = response.data.data || []
      total.value = response.data.pagination?.total || 0
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error loading records'
  } finally {
    isLoading.value = false
  }
}

// Load record types
const loadRecordTypes = async () => {
  try {
    const response = await api.get<ApiResponse<RecordType[]>>('/clinical-records/types')
    if (response.success && response.data) {
      recordTypes.value = response.data
    }
  } catch {
    // Use defaults
    recordTypes.value = [
      { value: 'NOTE', label: 'Nota clínica' },
      { value: 'PROCEDURE', label: 'Procedimiento' },
      { value: 'DIAGNOSIS', label: 'Diagnóstico' },
      { value: 'TREATMENT_PLAN', label: 'Plan de tratamiento' },
      { value: 'PRESCRIPTION', label: 'Receta' },
      { value: 'EXAM', label: 'Examen' },
      { value: 'FOLLOW_UP', label: 'Seguimiento' },
    ]
  }
}

// Load patients for dropdown
const loadPatients = async () => {
  try {
    const response = await api.get<ApiResponse<{ data: Patient[] }>>('/patients?limit=100')
    if (response.success && response.data) {
      patients.value = response.data.data || []
    }
  } catch {
    // Ignore - patients list optional
  }
}

// Debounced search
let searchTimeout: number | undefined
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    page.value = 1
    loadRecords()
  }, 300)
})

watch([selectedPatientId, selectedRecordType], () => {
  page.value = 1
  loadRecords()
})

// Create record
const createRecord = async () => {
  formError.value = ''
  isSaving.value = true
  
  try {
    await api.post('/clinical-records', {
      patientId: recordForm.value.patientId,
      recordType: recordForm.value.recordType,
      title: recordForm.value.title || undefined,
      content: recordForm.value.content || undefined,
      diagnosis: recordForm.value.diagnosis || undefined,
      treatment: recordForm.value.treatment || undefined,
    })
    showCreateModal.value = false
    resetForm()
    await loadRecords()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error creating record'
  } finally {
    isSaving.value = false
  }
}

// Update record
const updateRecord = async () => {
  if (!selectedRecord.value) return
  
  formError.value = ''
  isSaving.value = true
  
  try {
    await api.put(`/clinical-records/${selectedRecord.value.id}`, {
      title: recordForm.value.title || undefined,
      content: recordForm.value.content || undefined,
      diagnosis: recordForm.value.diagnosis || undefined,
      treatment: recordForm.value.treatment || undefined,
    })
    showEditModal.value = false
    await loadRecords()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error updating record'
  } finally {
    isSaving.value = false
  }
}

// Sign record
const signRecord = async (record: ClinicalRecord) => {
  if (!confirm('¿Estás seguro de firmar este registro? Una vez firmado no se puede modificar.')) return
  
  try {
    await api.post(`/clinical-records/${record.id}/sign`)
    await loadRecords()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error signing record'
  }
}

// Delete record
const deleteRecord = async (id: string) => {
  if (!confirm('¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.')) return
  
  try {
    await api.delete(`/clinical-records/${id}`)
    await loadRecords()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error deleting record'
  }
}

// Open modals
const openCreateModal = () => {
  resetForm()
  // Pre-select patient if coming from patient detail
  if (route.query.patientId) {
    recordForm.value.patientId = route.query.patientId as string
  }
  showCreateModal.value = true
}

const openEditModal = (record: ClinicalRecord) => {
  selectedRecord.value = record
  recordForm.value = {
    patientId: record.patient.id,
    recordType: record.recordType,
    title: record.title || '',
    content: record.content || '',
    diagnosis: record.diagnosis || '',
    treatment: record.treatment || '',
  }
  showEditModal.value = true
}

const openViewModal = (record: ClinicalRecord) => {
  selectedRecord.value = record
  showViewModal.value = true
}

const resetForm = () => {
  recordForm.value = {
    patientId: '',
    recordType: 'NOTE',
    title: '',
    content: '',
    diagnosis: '',
    treatment: '',
  }
  formError.value = ''
  // Reset recording state
  isRecording.value = false
  isTranscribing.value = false
  recordingTime.value = 0
}

// Audio recording functions
const formatRecordingTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    audioChunks = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data)
      }
    }

    mediaRecorder.onstop = async () => {
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop())
      
      // Create blob and transcribe
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      await transcribeAudioFile(audioBlob)
    }

    mediaRecorder.start(1000) // Collect data every second
    isRecording.value = true
    recordingTime.value = 0
    
    // Update timer
    recordingInterval = window.setInterval(() => {
      recordingTime.value++
    }, 1000)
  } catch (err: any) {
    formError.value = 'No se pudo acceder al micrófono. Por favor permite el acceso.'
    console.error('Microphone error:', err)
  }
}

const stopRecording = () => {
  if (mediaRecorder && isRecording.value) {
    clearInterval(recordingInterval)
    mediaRecorder.stop()
    isRecording.value = false
  }
}

const transcribeAudioFile = async (audioBlob: Blob) => {
  isTranscribing.value = true
  formError.value = ''
  
  try {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')
    
    const response = await api.postFormData<any>('/clinical-records/transcribe-audio', formData)
    
    if (response.success && response.data) {
      // Auto-fill form fields
      recordForm.value.title = response.data.title || ''
      recordForm.value.content = response.data.content || ''
      recordForm.value.diagnosis = response.data.diagnosis || ''
      recordForm.value.treatment = response.data.treatment || ''
    } else {
      formError.value = response.message || 'Error al procesar el audio'
    }
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error al transcribir el audio'
    console.error('Transcription error:', err)
  } finally {
    isTranscribing.value = false
  }
}

// Helpers
const getRecordTypeLabel = (type: string) => {
  return recordTypes.value.find(t => t.value === type)?.label || type
}

const getRecordTypeClass = (type: string) => {
  switch (type) {
    case 'NOTE': return 'bg-blue-100 text-blue-700'
    case 'PROCEDURE': return 'bg-green-100 text-green-700'
    case 'DIAGNOSIS': return 'bg-orange-100 text-orange-700'
    case 'TREATMENT_PLAN': return 'bg-purple-100 text-purple-700'
    case 'PRESCRIPTION': return 'bg-pink-100 text-pink-700'
    case 'EXAM': return 'bg-cyan-100 text-cyan-700'
    case 'FOLLOW_UP': return 'bg-gray-100 text-gray-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(async () => {
  await Promise.all([loadRecords(), loadRecordTypes(), loadPatients()])
  
  // Check for patientId in query params
  if (route.query.patientId) {
    selectedPatientId.value = route.query.patientId as string
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold text-surface-900">Registros Clínicos</h1>
        <p class="text-surface-500 mt-1">Historial médico y notas de pacientes</p>
      </div>
      <button @click="openCreateModal" class="btn-primary">
        <PlusIcon class="w-5 h-5" />
        Nuevo Registro
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="relative flex-1 max-w-md">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar registros..."
          class="input pl-10"
        />
      </div>
      <button @click="showFilters = !showFilters" class="btn-secondary">
        <FunnelIcon class="w-5 h-5" />
        Filtros
      </button>
    </div>

    <!-- Filter panel -->
    <div v-if="showFilters" class="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="label">Paciente</label>
        <select v-model="selectedPatientId" class="input">
          <option value="">Todos los pacientes</option>
          <option v-for="patient in patients" :key="patient.id" :value="patient.id">
            {{ patient.firstName }} {{ patient.lastName }}
          </option>
        </select>
      </div>
      <div>
        <label class="label">Tipo de registro</label>
        <select v-model="selectedRecordType" class="input">
          <option value="">Todos los tipos</option>
          <option v-for="type in recordTypes" :key="type.value" :value="type.value">
            {{ type.label }}
          </option>
        </select>
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

    <!-- Records list -->
    <div v-else-if="records.length > 0" class="space-y-4">
      <div 
        v-for="record in records" 
        :key="record.id" 
        class="card p-4 hover:shadow-md transition-shadow cursor-pointer"
        @click="openViewModal(record)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2">
              <span :class="['px-2 py-1 rounded-md text-xs font-medium', getRecordTypeClass(record.recordType)]">
                {{ getRecordTypeLabel(record.recordType) }}
              </span>
              <span v-if="record.isSigned" class="flex items-center gap-1 text-green-600 text-xs">
                <CheckBadgeIcon class="w-4 h-4" />
                Firmado
              </span>
            </div>
            <h3 class="font-semibold text-surface-900 truncate">
              {{ record.title || 'Sin título' }}
            </h3>
            <p class="text-sm text-surface-600 mt-1">
              Paciente: <span class="font-medium">{{ record.patient.firstName }} {{ record.patient.lastName }}</span>
            </p>
            <p class="text-xs text-surface-400 mt-2">
              {{ formatDate(record.createdAt) }} por {{ record.createdBy.firstName }} {{ record.createdBy.lastName }}
            </p>
          </div>
          <div class="flex items-center gap-2" @click.stop>
            <button 
              v-if="!record.isSigned"
              @click="signRecord(record)" 
              class="p-2 text-surface-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
              title="Firmar"
            >
              <CheckBadgeIcon class="w-5 h-5" />
            </button>
            <button 
              v-if="!record.isSigned"
              @click="openEditModal(record)" 
              class="p-2 text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
              title="Editar"
            >
              <PencilIcon class="w-5 h-5" />
            </button>
            <button 
              v-if="!record.isSigned"
              @click="deleteRecord(record.id)" 
              class="p-2 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
              title="Eliminar"
            >
              <TrashIcon class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between">
        <p class="text-sm text-surface-500">
          Mostrando {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, total) }} de {{ total }}
        </p>
        <div class="flex gap-2">
          <button 
            @click="page--; loadRecords()" 
            :disabled="page === 1" 
            class="btn-secondary btn-sm"
          >
            <ChevronLeftIcon class="w-4 h-4" />
          </button>
          <button 
            @click="page++; loadRecords()" 
            :disabled="page >= totalPages" 
            class="btn-secondary btn-sm"
          >
            <ChevronRightIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card p-12 text-center">
      <DocumentTextIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-medium text-surface-900 mb-2">No hay registros</h3>
      <p class="text-surface-500 mb-6">Crea el primer registro clínico</p>
      <button @click="openCreateModal" class="btn-primary">
        <PlusIcon class="w-5 h-5" />
        Nuevo Registro
      </button>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showCreateModal || showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showCreateModal = false; showEditModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ showCreateModal ? 'Nuevo Registro Clínico' : 'Editar Registro' }}
            </h2>
            <div class="flex items-center gap-2">
              <!-- Audio Recording Button (only in create mode) -->
              <button 
                v-if="showCreateModal && !isTranscribing"
                type="button"
                @click="isRecording ? stopRecording() : startRecording()"
                :class="[
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  isRecording 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse' 
                    : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                ]"
                :title="isRecording ? 'Detener grabación' : 'Grabar con micrófono'"
              >
                <StopIcon v-if="isRecording" class="w-5 h-5" />
                <MicrophoneIcon v-else class="w-5 h-5" />
                <span v-if="isRecording">{{ formatRecordingTime(recordingTime) }}</span>
                <span v-else class="hidden sm:inline">IA</span>
              </button>
              
              <!-- Transcribing Indicator -->
              <div 
                v-if="isTranscribing"
                class="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm"
              >
                <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Procesando con IA...
              </div>
              
              <button @click="showCreateModal = false; showEditModal = false" class="text-surface-400 hover:text-surface-600">
                <XMarkIcon class="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <form @submit.prevent="showCreateModal ? createRecord() : updateRecord()" class="p-6 space-y-4">
            <div v-if="formError" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
              {{ formError }}
            </div>
            
            <div v-if="showCreateModal" class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Paciente *</label>
                <select v-model="recordForm.patientId" required class="input">
                  <option value="">Seleccionar paciente</option>
                  <option v-for="patient in patients" :key="patient.id" :value="patient.id">
                    {{ patient.firstName }} {{ patient.lastName }}
                  </option>
                </select>
              </div>
              <div>
                <label class="label">Tipo de registro *</label>
                <select v-model="recordForm.recordType" required class="input">
                  <option v-for="type in recordTypes" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
              </div>
            </div>
            
            <div>
              <label class="label">Título</label>
              <input v-model="recordForm.title" type="text" class="input" placeholder="Título descriptivo" />
            </div>
            
            <div>
              <label class="label">Notas / Contenido</label>
              <textarea v-model="recordForm.content" rows="4" class="input" placeholder="Notas del registro..."></textarea>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Diagnóstico</label>
                <textarea v-model="recordForm.diagnosis" rows="3" class="input" placeholder="Diagnóstico..."></textarea>
              </div>
              <div>
                <label class="label">Tratamiento</label>
                <textarea v-model="recordForm.treatment" rows="3" class="input" placeholder="Tratamiento indicado..."></textarea>
              </div>
            </div>
            
            <div class="flex gap-3 pt-4">
              <button type="button" @click="showCreateModal = false; showEditModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isSaving" class="btn-primary flex-1">
                {{ isSaving ? 'Guardando...' : (showCreateModal ? 'Crear Registro' : 'Guardar Cambios') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- View Modal -->
    <Teleport to="body">
      <div v-if="showViewModal && selectedRecord" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showViewModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <div class="flex items-center gap-3">
              <span :class="['px-2 py-1 rounded-md text-xs font-medium', getRecordTypeClass(selectedRecord.recordType)]">
                {{ getRecordTypeLabel(selectedRecord.recordType) }}
              </span>
              <span v-if="selectedRecord.isSigned" class="flex items-center gap-1 text-green-600 text-xs">
                <CheckBadgeIcon class="w-4 h-4" />
                Firmado
              </span>
            </div>
            <button @click="showViewModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <div class="p-6 space-y-4">
            <div>
              <h2 class="text-xl font-semibold text-surface-900">{{ selectedRecord.title || 'Sin título' }}</h2>
              <p class="text-surface-500 mt-1">
                Paciente: {{ selectedRecord.patient.firstName }} {{ selectedRecord.patient.lastName }}
              </p>
            </div>
            
            <div v-if="selectedRecord.content" class="bg-surface-50 p-4 rounded-lg">
              <label class="text-sm font-medium text-surface-600 mb-2 block">Notas</label>
              <p class="text-surface-800 whitespace-pre-wrap">{{ selectedRecord.content }}</p>
            </div>
            
            <div v-if="selectedRecord.diagnosis" class="bg-orange-50 p-4 rounded-lg">
              <label class="text-sm font-medium text-orange-700 mb-2 block">Diagnóstico</label>
              <p class="text-surface-800 whitespace-pre-wrap">{{ selectedRecord.diagnosis }}</p>
            </div>
            
            <div v-if="selectedRecord.treatment" class="bg-green-50 p-4 rounded-lg">
              <label class="text-sm font-medium text-green-700 mb-2 block">Tratamiento</label>
              <p class="text-surface-800 whitespace-pre-wrap">{{ selectedRecord.treatment }}</p>
            </div>
            
            <div class="border-t border-surface-100 pt-4 text-sm text-surface-500">
              <p>Creado: {{ formatDate(selectedRecord.createdAt) }} por {{ selectedRecord.createdBy.firstName }} {{ selectedRecord.createdBy.lastName }}</p>
              <p v-if="selectedRecord.signedAt">Firmado: {{ formatDate(selectedRecord.signedAt) }}</p>
            </div>
            
            <div class="flex gap-3 pt-4">
              <button @click="showViewModal = false" class="btn-secondary flex-1">
                Cerrar
              </button>
              <button 
                v-if="!selectedRecord.isSigned" 
                @click="showViewModal = false; openEditModal(selectedRecord)" 
                class="btn-primary flex-1"
              >
                Editar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
