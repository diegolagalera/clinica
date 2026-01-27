<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import type { Patient, Appointment, ApiResponse, User, Radiograph } from '@/types'
import OdontogramComponent from '@/components/odontogram/Odontogram.vue'
import {
  ArrowLeftIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  PhotoIcon,
  PencilIcon,
  PlusIcon,
  XMarkIcon,
  CheckBadgeIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MicrophoneIcon,
  StopIcon,
  StarIcon,
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

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const patientId = computed(() => route.params.id as string)

// Check if current user is admin
const isAdmin = computed(() => {
  const role = authStore.user?.role
  return role === 'ADMIN' || role === 'SUPERADMIN'
})

// Check if appointment can be edited
const canEditAppointment = (apt: Appointment) => {
  if (isAdmin.value) return true
  return apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED'
}

// State
const patient = ref<Patient | null>(null)
const appointments = ref<Appointment[]>([])
const records = ref<ClinicalRecord[]>([])
const stats = ref({ totalAppointments: 0, totalRecords: 0, totalRadiographs: 0 })
const isLoading = ref(true)
const error = ref('')

// Tabs
const activeTab = ref('info')

// Records
const recordTypes: RecordType[] = [
  { value: 'NOTE', label: 'Nota clínica' },
  { value: 'PROCEDURE', label: 'Procedimiento' },
  { value: 'DIAGNOSIS', label: 'Diagnóstico' },
  { value: 'TREATMENT_PLAN', label: 'Plan de tratamiento' },
  { value: 'PRESCRIPTION', label: 'Receta' },
  { value: 'EXAM', label: 'Examen' },
  { value: 'FOLLOW_UP', label: 'Seguimiento' },
]
const isLoadingRecords = ref(false)
const showRecordModal = ref(false)
const isEditingRecord = ref(false)
const selectedRecord = ref<ClinicalRecord | null>(null)
const isSavingRecord = ref(false)
const recordForm = ref({
  recordType: 'NOTE',
  title: '',
  content: '',
  diagnosis: '',
  treatment: '',
})
const expandedRecords = ref<Set<string>>(new Set())

// Audio recording state
const isRecording = ref(false)
const isTranscribing = ref(false)
const recordingTime = ref(0)
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let recordingInterval: number | undefined

// Appointments
const isLoadingAppointments = ref(false)
const showAppointmentModal = ref(false)
const isSavingAppointment = ref(false)
const isEditingAppointment = ref(false)
const selectedAppointment = ref<Appointment | null>(null)
const appointmentForm = ref({
  type: 'VISIT',
  title: '',
  startTime: '',
  endTime: '',
  notes: '',
  status: 'SCHEDULED',
  workerIds: [] as string[],
})

// Rating requests tracking
const ratingRequestsSent = ref<Record<string, boolean>>({})
const sendingRatingFor = ref<string | null>(null)

// Workers list
const workers = ref<User[]>([])
const showWorkerDropdown = ref(false)

// Edit patient modal
const showEditPatientModal = ref(false)
const isSavingPatient = ref(false)
const patientFormError = ref('')
const patientForm = ref({
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

const appointmentTypes = [
  { value: 'VISIT', label: 'Visita' },
  { value: 'SURGERY', label: 'Cirugía' },
  { value: 'REVIEW', label: 'Revisión' },
  { value: 'EMERGENCY', label: 'Urgencia' },
  { value: 'FOLLOWUP', label: 'Seguimiento' },
]

const appointmentStatuses = [
  { value: 'SCHEDULED', label: 'Programada' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'CANCELLED', label: 'Cancelada' },
  { value: 'NO_SHOW', label: 'No presentado' },
]

// Load workers
const loadWorkers = async () => {
  try {
    const response = await api.get<ApiResponse<User[]>>('/staff')
    if (response.success && response.data && Array.isArray(response.data)) {
      workers.value = response.data
    }
  } catch (err) {
    console.warn('Could not load workers list', err)
  }
}

// Open edit patient modal
const openEditPatientModal = () => {
  if (!patient.value) return
  patientForm.value = {
    firstName: patient.value.firstName,
    lastName: patient.value.lastName,
    email: patient.value.email || '',
    phone: patient.value.phone || '',
    dateOfBirth: patient.value.dateOfBirth ? patient.value.dateOfBirth.split('T')[0] : '',
    gender: patient.value.gender || '',
    idNumber: patient.value.idNumber || '',
    address: patient.value.address || '',
    city: patient.value.city || '',
    postalCode: patient.value.postalCode || '',
    allergies: patient.value.allergies || '',
    notes: patient.value.notes || '',
  }
  patientFormError.value = ''
  showEditPatientModal.value = true
}

// Save patient
const savePatient = async () => {
  patientFormError.value = ''
  isSavingPatient.value = true
  
  try {
    const payload = {
      ...patientForm.value,
      dateOfBirth: patientForm.value.dateOfBirth || undefined,
    }
    
    await api.put(`/patients/${patientId.value}`, payload)
    
    showEditPatientModal.value = false
    await loadPatient()
  } catch (err: any) {
    patientFormError.value = err.response?.data?.message || 'Error al guardar el paciente'
  } finally {
    isSavingPatient.value = false
  }
}

// Helper to get workers display string for an appointment
const getWorkersDisplay = (apt: Appointment): string => {
  // Try appointmentWorkers first
  if (apt.appointmentWorkers && apt.appointmentWorkers.length > 0) {
    return apt.appointmentWorkers
      .map(aw => `Dr. ${aw.user?.firstName || ''} ${aw.user?.lastName || ''}`.trim())
      .filter(name => name !== 'Dr.')
      .join(', ')
  }
  // Fallback to single worker
  if (apt.worker) {
    return `Dr. ${apt.worker.firstName} ${apt.worker.lastName}`
  }
  return ''
}

// Load patient data
const loadPatient = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const [patientResponse, statsResponse] = await Promise.all([
      api.get<ApiResponse<Patient>>(`/patients/${patientId.value}`),
      api.get<ApiResponse<{ totalAppointments: number; totalRecords: number; totalRadiographs: number }>>(`/patients/${patientId.value}/stats`),
    ])
    
    if (patientResponse.success && patientResponse.data) {
      patient.value = patientResponse.data
      // Get appointments if included
      if ((patientResponse.data as any).appointments) {
        appointments.value = (patientResponse.data as any).appointments
      }
    }
    
    if (statsResponse.success && statsResponse.data) {
      stats.value = statsResponse.data
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error loading patient'
  } finally {
    isLoading.value = false
  }
}

// Load clinical records
const loadRecords = async () => {
  isLoadingRecords.value = true
  try {
    const response = await api.get<ApiResponse<{ data: ClinicalRecord[], pagination: { total: number } }>>(
      `/clinical-records/patient/${patientId.value}`
    )
    if (response.success && response.data) {
      records.value = response.data.data || []
      stats.value.totalRecords = response.data.pagination?.total || 0
    }
  } catch (err: any) {
    console.error('Error loading records:', err)
  } finally {
    isLoadingRecords.value = false
  }
}

// Load appointments
const loadAppointments = async () => {
  isLoadingAppointments.value = true
  try {
    const response = await api.get<ApiResponse<{ data: Appointment[], pagination: { total: number } }>>(
      `/appointments/patient/${patientId.value}`
    )
    if (response.success && response.data) {
      appointments.value = response.data.data || []
      stats.value.totalAppointments = response.data.pagination?.total || 0
    }
  } catch (err: any) {
    console.error('Error loading appointments:', err)
  } finally {
    isLoadingAppointments.value = false
  }
}

// Create/update record
const saveRecord = async () => {
  isSavingRecord.value = true
  try {
    if (isEditingRecord.value && selectedRecord.value) {
      await api.put(`/clinical-records/${selectedRecord.value.id}`, {
        title: recordForm.value.title || undefined,
        content: recordForm.value.content || undefined,
        diagnosis: recordForm.value.diagnosis || undefined,
        treatment: recordForm.value.treatment || undefined,
      })
    } else {
      await api.post('/clinical-records', {
        patientId: patientId.value,
        recordType: recordForm.value.recordType,
        title: recordForm.value.title || undefined,
        content: recordForm.value.content || undefined,
        diagnosis: recordForm.value.diagnosis || undefined,
        treatment: recordForm.value.treatment || undefined,
      })
    }
    showRecordModal.value = false
    resetRecordForm()
    await loadRecords()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error saving record'
  } finally {
    isSavingRecord.value = false
  }
}

// Sign record
const signRecord = async (record: ClinicalRecord) => {
  if (!confirm('¿Firmar este registro? Una vez firmado no se puede modificar.')) return
  try {
    await api.post(`/clinical-records/${record.id}/sign`)
    await loadRecords()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error signing record'
  }
}

// Delete record
const deleteRecord = async (id: string) => {
  if (!confirm('¿Eliminar este registro?')) return
  try {
    await api.delete(`/clinical-records/${id}`)
    await loadRecords()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error deleting record'
  }
}

// Open modals
const openCreateRecordModal = () => {
  isEditingRecord.value = false
  selectedRecord.value = null
  resetRecordForm()
  showRecordModal.value = true
}

const openEditRecordModal = (record: ClinicalRecord) => {
  isEditingRecord.value = true
  selectedRecord.value = record
  recordForm.value = {
    recordType: record.recordType,
    title: record.title || '',
    content: record.content || '',
    diagnosis: record.diagnosis || '',
    treatment: record.treatment || '',
  }
  showRecordModal.value = true
}

const resetRecordForm = () => {
  recordForm.value = {
    recordType: 'NOTE',
    title: '',
    content: '',
    diagnosis: '',
    treatment: '',
  }
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
      stream.getTracks().forEach(track => track.stop())
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      await transcribeAudioFile(audioBlob)
    }

    mediaRecorder.start(1000)
    isRecording.value = true
    recordingTime.value = 0
    
    recordingInterval = window.setInterval(() => {
      recordingTime.value++
    }, 1000)
  } catch (err: any) {
    error.value = 'No se pudo acceder al micrófono. Por favor permite el acceso.'
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
  error.value = ''
  
  try {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')
    
    const response = await api.postFormData<any>('/clinical-records/transcribe-audio', formData)
    
    if (response.success && response.data) {
      recordForm.value.title = response.data.title || ''
      recordForm.value.content = response.data.content || ''
      recordForm.value.diagnosis = response.data.diagnosis || ''
      recordForm.value.treatment = response.data.treatment || ''
    } else {
      error.value = response.message || 'Error al procesar el audio'
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error al transcribir el audio'
  } finally {
    isTranscribing.value = false
  }
}

const toggleRecordExpand = (id: string) => {
  if (expandedRecords.value.has(id)) {
    expandedRecords.value.delete(id)
  } else {
    expandedRecords.value.add(id)
  }
}

// Appointment functions
const openAppointmentModal = () => {
  isEditingAppointment.value = false
  selectedAppointment.value = null
  // Set default times
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 1)
  const end = new Date(now)
  end.setHours(end.getHours() + 1)
  
  appointmentForm.value = {
    type: 'VISIT',
    title: '',
    startTime: now.toISOString().slice(0, 16),
    endTime: end.toISOString().slice(0, 16),
    notes: '',
    status: 'SCHEDULED',
    workerIds: authStore.user?.id ? [authStore.user.id] : [],
  }
  showAppointmentModal.value = true
}

const openEditAppointmentModal = (apt: Appointment) => {
  isEditingAppointment.value = true
  selectedAppointment.value = apt
  
  // Get workerIds from appointmentWorkers or fallback to workerId
  const workerIds = apt.appointmentWorkers?.length 
    ? apt.appointmentWorkers.map(aw => aw.userId)
    : (apt.workerId ? [apt.workerId] : [])
  
  // Helper to format date for datetime-local input (keeps local time)
  const toLocalDateTimeString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }
  
  appointmentForm.value = {
    type: apt.type,
    title: apt.title || '',
    startTime: toLocalDateTimeString(new Date(apt.startTime)),
    endTime: toLocalDateTimeString(new Date(apt.endTime)),
    notes: apt.notes || '',
    status: apt.status || 'SCHEDULED',
    workerIds: workerIds,
  }
  showAppointmentModal.value = true
}

const saveAppointment = async () => {
  isSavingAppointment.value = true
  try {
    if (isEditingAppointment.value && selectedAppointment.value) {
      await api.put(`/appointments/${selectedAppointment.value.id}`, {
        type: appointmentForm.value.type,
        title: appointmentForm.value.title || undefined,
        startTime: appointmentForm.value.startTime,
        endTime: appointmentForm.value.endTime,
        notes: appointmentForm.value.notes || undefined,
        status: appointmentForm.value.status,
        workerIds: appointmentForm.value.workerIds.length > 0 ? appointmentForm.value.workerIds : undefined,
      })
    } else {
      await api.post('/appointments', {
        patientId: patientId.value,
        type: appointmentForm.value.type,
        title: appointmentForm.value.title || undefined,
        startTime: appointmentForm.value.startTime,
        endTime: appointmentForm.value.endTime,
        notes: appointmentForm.value.notes || undefined,
        workerIds: appointmentForm.value.workerIds.length > 0 ? appointmentForm.value.workerIds : undefined,
      })
    }
    showAppointmentModal.value = false
    isEditingAppointment.value = false
    selectedAppointment.value = null
    await loadAppointments()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error saving appointment'
  } finally {
    isSavingAppointment.value = false
  }
}

const cancelAppointment = async (apt: Appointment) => {
  if (!confirm('¿Cancelar esta cita?')) return
  try {
    await api.delete(`/appointments/${apt.id}`)
    await loadAppointments()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error cancelling appointment'
  }
}

// Send rating request email for completed appointment
const sendRatingRequest = async (appointmentId: string) => {
  sendingRatingFor.value = appointmentId
  try {
    const response = await api.post<{ success: boolean; error?: string; ratingUrl?: string; alreadySent?: boolean }>(
      `/ratings/test/${appointmentId}`
    )
    if (response.success) {
      ratingRequestsSent.value[appointmentId] = true
      // Show a toast or notification
      alert('Email de valoración enviado correctamente')
    } else if (response.alreadySent) {
      ratingRequestsSent.value[appointmentId] = true
      alert('El email de valoración ya fue enviado anteriormente')
    } else {
      alert(response.error || 'Error al enviar el email')
    }
  } catch (err: any) {
    console.error('Error sending rating request:', err)
    alert(err.message || 'Error al enviar el email de valoración')
  } finally {
    sendingRatingFor.value = null
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'SCHEDULED': return 'Programada'
    case 'COMPLETED': return 'Completada'
    case 'CANCELLED': return 'Cancelada'
    case 'NO_SHOW': return 'No asistió'
    default: return status
  }
}

// Helpers
const getRecordTypeLabel = (type: string) => {
  return recordTypes.find(t => t.value === type)?.label || type
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

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const calculateAge = (dateOfBirth: string) => {
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// === RADIOGRAPHS ===
const radiographs = ref<Radiograph[]>([])
const isLoadingRadiographs = ref(false)
const showRadiographModal = ref(false)
const selectedRadiograph = ref<Radiograph | null>(null)
const isUploadingRadiograph = ref(false)
const radiographFileInput = ref<HTMLInputElement | null>(null)
const radiographUploadNotes = ref('')
const isSavingNotes = ref(false)
const editingNotesId = ref<string | null>(null)
const editingNotesContent = ref('')
const radiographError = ref('')
// Polling for AI analysis status
let pollingInterval: ReturnType<typeof setInterval> | null = null

// Check if any radiograph is still processing
const hasProcessingRadiographs = () => {
  return radiographs.value.some(r => 
    r.aiResult?.status === 'PENDING' || r.aiResult?.status === 'PROCESSING'
  )
}

// Start polling if needed
const startPollingIfNeeded = () => {
  if (hasProcessingRadiographs() && !pollingInterval) {
    pollingInterval = setInterval(async () => {
      // Silently refresh without loading state
      try {
        const response = await api.get<ApiResponse<Radiograph[]>>(`/radiographs/patient/${patientId.value}`)
        if (response.success && response.data) {
          radiographs.value = response.data
          // Stop polling if no more processing
          if (!hasProcessingRadiographs()) {
            stopPolling()
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000) // Poll every 3 seconds
  }
}

// Stop polling
const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// Load radiographs
const loadRadiographs = async () => {
  isLoadingRadiographs.value = true
  try {
    const response = await api.get<ApiResponse<Radiograph[]>>(`/radiographs/patient/${patientId.value}`)
    if (response.success && response.data) {
      radiographs.value = response.data
      // Start polling if any radiograph is processing
      startPollingIfNeeded()
    }
  } catch (err: any) {
    console.error('Error loading radiographs:', err)
  } finally {
    isLoadingRadiographs.value = false
  }
}

// Trigger file input
const triggerRadiographUpload = () => {
  radiographFileInput.value?.click()
}

// Handle file selection
const handleRadiographFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Validate file type
  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    radiographError.value = 'Solo se permiten archivos PNG o JPG'
    return
  }

  radiographError.value = ''
  isUploadingRadiograph.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('notes', radiographUploadNotes.value)

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authStore.accessToken}`,
    }
    
    // Add clinic context headers
    if (authStore.currentClinicId) {
      headers['X-Clinic-Id'] = authStore.currentClinicId
    }
    if (authStore.currentOrganizationId) {
      headers['X-Organization-Id'] = authStore.currentOrganizationId
    }

    const response = await fetch(`/api/v1/radiographs/patient/${patientId.value}`, {
      method: 'POST',
      headers,
      body: formData,
    })
    
    const result = await response.json()
    if (result.success) {
      await loadRadiographs()
      radiographUploadNotes.value = ''
      showRadiographModal.value = false
      radiographError.value = ''
    } else {
      radiographError.value = result.message || 'Error al subir la radiografía'
    }
  } catch (err: any) {
    console.error('Error uploading radiograph:', err)
    radiographError.value = 'Error al subir la radiografía'
  } finally {
    isUploadingRadiograph.value = false
    // Reset file input
    if (target) target.value = ''
  }
}

// Retry AI analysis
const retryAnalysis = async (radiographId: string) => {
  try {
    const response = await api.post<ApiResponse<unknown>>(`/radiographs/${radiographId}/retry-analysis`)
    if (response.success) {
      await loadRadiographs()
    }
  } catch (err: any) {
    console.error('Error retrying analysis:', err)
    radiographError.value = 'Error al reintentar el análisis'
  }
}

// Get image URL for radiograph - load with auth and return data URL
const radiographImageCache = ref<Record<string, string>>({})

const loadRadiographImage = async (radiographId: string): Promise<string> => {
  // Check cache first
  if (radiographImageCache.value[radiographId]) {
    return radiographImageCache.value[radiographId]
  }

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authStore.accessToken}`,
    }
    if (authStore.currentClinicId) {
      headers['X-Clinic-Id'] = authStore.currentClinicId
    }

    const response = await fetch(`/api/v1/radiographs/${radiographId}/image`, {
      headers,
    })
    
    if (response.ok) {
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      radiographImageCache.value[radiographId] = dataUrl
      return dataUrl
    }
  } catch (err) {
    console.error('Error loading radiograph image:', err)
  }
  return ''
}

// Load images when radiographs are loaded
const loadAllRadiographImages = async () => {
  for (const radiograph of radiographs.value) {
    loadRadiographImage(radiograph.id)
  }
}

// Get image URL for radiograph (returns cached data URL or placeholder)
const getRadiographImageUrl = (radiograph: Radiograph) => {
  // Start loading if not cached
  if (!radiographImageCache.value[radiograph.id]) {
    loadRadiographImage(radiograph.id).then(dataUrl => {
      if (dataUrl) {
        // Force reactivity update
        radiographImageCache.value = { ...radiographImageCache.value, [radiograph.id]: dataUrl }
      }
    })
  }
  return radiographImageCache.value[radiograph.id] || ''
}

// View radiograph detail
const viewRadiograph = (radiograph: Radiograph) => {
  selectedRadiograph.value = radiograph
}

// Close radiograph detail
const closeRadiographDetail = () => {
  selectedRadiograph.value = null
}

// Start editing notes
const startEditingNotes = (radiograph: Radiograph) => {
  editingNotesId.value = radiograph.id
  editingNotesContent.value = radiograph.notes || ''
}

// Save notes
const saveNotes = async (radiographId: string) => {
  isSavingNotes.value = true
  try {
    const response = await api.put<ApiResponse<Radiograph>>(`/radiographs/${radiographId}/notes`, {
      notes: editingNotesContent.value
    })
    if (response.success) {
      await loadRadiographs()
      editingNotesId.value = null
      editingNotesContent.value = ''
    }
  } catch (err: any) {
    console.error('Error saving notes:', err)
    radiographError.value = 'Error al guardar las notas'
  } finally {
    isSavingNotes.value = false
  }
}

// Cancel editing notes
const cancelEditingNotes = () => {
  editingNotesId.value = null
  editingNotesContent.value = ''
}

// Get AI status label
const getAiStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'PENDING': 'Pendiente',
    'PROCESSING': 'Analizando...',
    'COMPLETED': 'Completado',
    'FAILED': 'Error',
    'REVIEWED': 'Revisado',
    'REJECTED': 'Rechazado',
  }
  return labels[status] || status
}

// Get AI status class
const getAiStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    'PENDING': 'bg-yellow-100 text-yellow-700',
    'PROCESSING': 'bg-blue-100 text-blue-700',
    'COMPLETED': 'bg-green-100 text-green-700',
    'FAILED': 'bg-red-100 text-red-700',
    'REVIEWED': 'bg-purple-100 text-purple-700',
    'REJECTED': 'bg-gray-100 text-gray-700',
  }
  return classes[status] || 'bg-gray-100 text-gray-700'
}

// Get severity class
const getSeverityClass = (severity: string) => {
  const classes: Record<string, string> = {
    'LOW': 'bg-green-100 text-green-700',
    'MEDIUM': 'bg-yellow-100 text-yellow-700',
    'HIGH': 'bg-red-100 text-red-700',
  }
  return classes[severity] || 'bg-gray-100 text-gray-700'
}

// Load records when switching to records tab
watch(activeTab, (tab, oldTab) => {
  if (tab === 'records' && records.value.length === 0) {
    loadRecords()
  }
  if (tab === 'appointments' && appointments.value.length === 0) {
    loadAppointments()
  }
  if (tab === 'radiographs' && radiographs.value.length === 0) {
    loadRadiographs()
  }
  // Stop polling when leaving radiographs tab
  if (oldTab === 'radiographs' && tab !== 'radiographs') {
    stopPolling()
  }
})

onMounted(() => {
  loadPatient()
  loadWorkers()
})

// Cleanup polling on unmount
onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <button @click="router.push('/clinic/patients')" class="flex items-center gap-2 text-surface-500 hover:text-surface-700">
      <ArrowLeftIcon class="w-5 h-5" />
      Volver a pacientes
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
    <template v-else-if="patient">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-start gap-4">
        <div class="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-2xl font-semibold flex-shrink-0">
          {{ patient.firstName.charAt(0) }}{{ patient.lastName.charAt(0) }}
        </div>
        <div class="flex-1">
          <h1 class="text-2xl font-display font-bold text-surface-900">
            {{ patient.firstName }} {{ patient.lastName }}
          </h1>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <span v-if="patient.email" class="flex items-center gap-1 text-surface-500">
              <EnvelopeIcon class="w-4 h-4" />
              {{ patient.email }}
            </span>
            <span v-if="patient.phone" class="flex items-center gap-1 text-surface-500">
              <PhoneIcon class="w-4 h-4" />
              {{ patient.phone }}
            </span>
          </div>
        </div>
        <button @click="openEditPatientModal" class="btn-secondary">
          <PencilIcon class="w-4 h-4" />
          Editar
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-4">
        <div class="stat-card text-center cursor-pointer" @click="activeTab = 'appointments'">
          <CalendarDaysIcon class="w-6 h-6 mx-auto text-primary-500 mb-2" />
          <p class="stat-value">{{ stats.totalAppointments }}</p>
          <p class="stat-label">Citas</p>
        </div>
        <div class="stat-card text-center cursor-pointer" @click="activeTab = 'records'">
          <DocumentTextIcon class="w-6 h-6 mx-auto text-accent-500 mb-2" />
          <p class="stat-value">{{ stats.totalRecords }}</p>
          <p class="stat-label">Registros</p>
        </div>
        <div class="stat-card text-center cursor-pointer" @click="activeTab = 'radiographs'">
          <PhotoIcon class="w-6 h-6 mx-auto text-warning-500 mb-2" />
          <p class="stat-value">{{ stats.totalRadiographs }}</p>
          <p class="stat-label">Radiografías</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="border-b border-surface-200">
        <nav class="flex gap-4">
          <button
            @click="activeTab = 'info'"
            :class="['px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px', 
              activeTab === 'info' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700']"
          >
            Información
          </button>
          <button
            @click="activeTab = 'records'"
            :class="['px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px', 
              activeTab === 'records' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700']"
          >
            Historial Clínico
          </button>
          <button
            @click="activeTab = 'appointments'"
            :class="['px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px', 
              activeTab === 'appointments' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700']"
          >
            Citas
          </button>
          <button
            @click="activeTab = 'radiographs'"
            :class="['px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px', 
              activeTab === 'radiographs' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700']"
          >
            Radiografías
          </button>
          <button
            @click="activeTab = 'odontogram'"
            :class="['px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px', 
              activeTab === 'odontogram' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700']"
          >
            Odontograma
          </button>
        </nav>
      </div>

      <!-- Tab: Info -->
      <div v-if="activeTab === 'info'" class="card">
        <div class="card-header">
          <h2 class="font-semibold text-surface-900">Información Personal</h2>
        </div>
        <div class="card-body grid md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-surface-500">Fecha de nacimiento</p>
            <p class="text-surface-900">
              {{ patient.dateOfBirth ? `${formatDate(patient.dateOfBirth)} (${calculateAge(patient.dateOfBirth)} años)` : '-' }}
            </p>
          </div>
          <div>
            <p class="text-sm text-surface-500">Género</p>
            <p class="text-surface-900">
              {{ patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Femenino' : patient.gender || '-' }}
            </p>
          </div>
          <div>
            <p class="text-sm text-surface-500">DNI/NIE</p>
            <p class="text-surface-900">{{ patient.idNumber || '-' }}</p>
          </div>
          <div>
            <p class="text-sm text-surface-500">Dirección</p>
            <p class="text-surface-900">
              {{ [patient.address, patient.city, patient.postalCode].filter(Boolean).join(', ') || '-' }}
            </p>
          </div>
          <div v-if="patient.allergies" class="md:col-span-2">
            <p class="text-sm text-surface-500">Alergias</p>
            <p class="text-danger-600 font-medium">{{ patient.allergies }}</p>
          </div>
          <div v-if="patient.notes" class="md:col-span-2">
            <p class="text-sm text-surface-500">Notas</p>
            <p class="text-surface-900">{{ patient.notes }}</p>
          </div>
        </div>
      </div>

      <!-- Tab: Records -->
      <div v-if="activeTab === 'records'" class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="font-semibold text-surface-900">Historial Clínico</h2>
          <button @click="openCreateRecordModal" class="btn-primary btn-sm">
            <PlusIcon class="w-4 h-4" />
            Nuevo Registro
          </button>
        </div>

        <!-- Loading records -->
        <div v-if="isLoadingRecords" class="flex justify-center py-8">
          <div class="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full"></div>
        </div>

        <!-- Records list -->
        <div v-else-if="records.length > 0" class="space-y-3">
          <div v-for="record in records" :key="record.id" class="card p-0 overflow-hidden">
            <!-- Record header -->
            <div 
              class="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-50"
              @click="toggleRecordExpand(record.id)"
            >
              <component 
                :is="expandedRecords.has(record.id) ? ChevronUpIcon : ChevronDownIcon" 
                class="w-5 h-5 text-surface-400"
              />
              <span :class="['px-2 py-1 rounded-md text-xs font-medium', getRecordTypeClass(record.recordType)]">
                {{ getRecordTypeLabel(record.recordType) }}
              </span>
              <span class="flex-1 font-medium text-surface-900 truncate">
                {{ record.title || 'Sin título' }}
              </span>
              <span v-if="record.isSigned" class="flex items-center gap-1 text-green-600 text-xs">
                <CheckBadgeIcon class="w-4 h-4" />
              </span>
              <span class="text-xs text-surface-400">{{ formatDateTime(record.createdAt) }}</span>
            </div>

            <!-- Record content (expanded) -->
            <div v-if="expandedRecords.has(record.id)" class="border-t border-surface-100 bg-surface-50 p-4 space-y-3">
              <div v-if="record.content">
                <p class="text-sm font-medium text-surface-600 mb-1">Notas</p>
                <p class="text-surface-800 whitespace-pre-wrap">{{ record.content }}</p>
              </div>
              <div v-if="record.diagnosis" class="p-3 bg-orange-50 rounded-lg">
                <p class="text-sm font-medium text-orange-700 mb-1">Diagnóstico</p>
                <p class="text-surface-800">{{ record.diagnosis }}</p>
              </div>
              <div v-if="record.treatment" class="p-3 bg-green-50 rounded-lg">
                <p class="text-sm font-medium text-green-700 mb-1">Tratamiento</p>
                <p class="text-surface-800">{{ record.treatment }}</p>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-surface-200">
                <p class="text-xs text-surface-500">
                  Por {{ record.createdBy.firstName }} {{ record.createdBy.lastName }}
                  <span v-if="record.isSigned && record.signedAt"> · Firmado {{ formatDateTime(record.signedAt) }}</span>
                </p>
                <div v-if="!record.isSigned" class="flex gap-2">
                  <button @click.stop="signRecord(record)" class="btn-sm text-green-600 hover:bg-green-50">
                    <CheckBadgeIcon class="w-4 h-4" />
                    Firmar
                  </button>
                  <button @click.stop="openEditRecordModal(record)" class="btn-sm text-primary-600 hover:bg-primary-50">
                    <PencilIcon class="w-4 h-4" />
                  </button>
                  <button @click.stop="deleteRecord(record.id)" class="btn-sm text-danger-600 hover:bg-danger-50">
                    <TrashIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="card p-8 text-center">
          <DocumentTextIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
          <p class="text-surface-500">No hay registros clínicos</p>
          <button @click="openCreateRecordModal" class="btn-primary mt-4">
            <PlusIcon class="w-4 h-4" />
            Crear Primer Registro
          </button>
        </div>
      </div>

      <!-- Tab: Appointments -->
      <div v-if="activeTab === 'appointments'" class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="font-semibold text-surface-900">Citas del Paciente</h2>
          <button @click="openAppointmentModal" class="btn-primary btn-sm">
            <PlusIcon class="w-4 h-4" />
            Nueva Cita
          </button>
        </div>

        <!-- Loading appointments -->
        <div v-if="isLoadingAppointments" class="flex justify-center py-8">
          <div class="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
        
        <div v-else-if="appointments.length > 0" class="space-y-3">
          <div 
            v-for="apt in appointments" 
            :key="apt.id"
            class="card flex items-center gap-4 p-4"
          >
            <div class="w-14 h-14 rounded-xl bg-primary-100 flex flex-col items-center justify-center text-primary-700">
              <span class="text-lg font-semibold">{{ new Date(apt.startTime).getDate() }}</span>
              <span class="text-[10px] uppercase">{{ new Date(apt.startTime).toLocaleDateString('es-ES', { month: 'short' }) }}</span>
            </div>
            <div class="flex-1">
              <p class="font-medium text-surface-900">{{ apt.title || apt.type }}</p>
              <p class="text-sm text-surface-500">
                {{ new Date(apt.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }}
                - {{ new Date(apt.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }}
              </p>
              <p v-if="getWorkersDisplay(apt)" class="text-xs text-surface-400 mt-1">
                {{ getWorkersDisplay(apt) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span :class="[
                'px-2 py-1 rounded-md text-xs font-medium',
                apt.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                apt.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                apt.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                apt.status === 'NO_SHOW' ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-700'
              ]">
                {{ getStatusLabel(apt.status) }}
              </span>
              <!-- Send rating button for completed appointments -->
              <button 
                v-if="apt.status === 'COMPLETED' && isAdmin && !ratingRequestsSent[apt.id]"
                @click="sendRatingRequest(apt.id)"
                :disabled="sendingRatingFor === apt.id"
                class="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                title="Enviar email de valoración"
              >
                <StarIcon v-if="sendingRatingFor !== apt.id" class="w-4 h-4" />
                <div v-else class="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              </button>
              <span 
                v-else-if="apt.status === 'COMPLETED' && ratingRequestsSent[apt.id]"
                class="p-2 text-green-500"
                title="Email de valoración enviado"
              >
                <StarIcon class="w-4 h-4" />
              </span>
              <button 
                v-if="canEditAppointment(apt)"
                @click="openEditAppointmentModal(apt)" 
                class="p-2 text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                title="Editar cita"
              >
                <PencilIcon class="w-4 h-4" />
              </button>
              <button 
                v-if="canEditAppointment(apt)"
                @click="cancelAppointment(apt)" 
                class="p-2 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                title="Cancelar cita"
              >
                <XMarkIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div v-else class="card p-8 text-center">
          <CalendarDaysIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
          <p class="text-surface-500">No hay citas registradas</p>
          <button @click="openAppointmentModal" class="btn-primary mt-4">
            <PlusIcon class="w-4 h-4" />
            Programar Cita
          </button>
        </div>
      </div>

      <!-- Tab: Radiographs -->
      <div v-if="activeTab === 'radiographs'" class="space-y-6">
        <!-- Header with upload button -->
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-surface-900">Radiografías</h2>
          <button @click="radiographError = ''; showRadiographModal = true" class="btn-primary">
            <PlusIcon class="w-4 h-4" />
            Subir Radiografía
          </button>
        </div>

        <!-- Hidden file input -->
        <input
          ref="radiographFileInput"
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          class="hidden"
          @change="handleRadiographFileChange"
        />

        <!-- Loading -->
        <div v-if="isLoadingRadiographs" class="flex justify-center py-8">
          <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
        </div>

        <!-- Radiographs Grid -->
        <div v-else-if="radiographs.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="radiograph in radiographs"
            :key="radiograph.id"
            class="card overflow-hidden hover:shadow-lg transition-shadow"
          >
            <!-- Image -->
            <div class="aspect-video bg-surface-100 relative cursor-pointer" @click="viewRadiograph(radiograph)">
              <img
                :src="getRadiographImageUrl(radiograph)"
                :alt="radiograph.originalFilename"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <!-- AI Status Badge -->
              <div v-if="radiograph.aiResult" class="absolute top-2 right-2">
                <span :class="['px-2 py-1 rounded-full text-xs font-medium', getAiStatusClass(radiograph.aiResult.status)]">
                  {{ getAiStatusLabel(radiograph.aiResult.status) }}
                </span>
              </div>
            </div>

            <!-- Content -->
            <div class="p-4 space-y-3">
              <!-- File info -->
              <div class="text-sm text-surface-500">
                <p class="font-medium text-surface-700 truncate">{{ radiograph.originalFilename }}</p>
                <p>{{ new Date(radiograph.createdAt).toLocaleDateString('es-ES') }}</p>
                <p v-if="radiograph.uploadedBy">
                  Subido por: {{ radiograph.uploadedBy.firstName }} {{ radiograph.uploadedBy.lastName }}
                </p>
              </div>

              <!-- AI Analysis Result -->
              <div v-if="radiograph.aiResult && radiograph.aiResult.status === 'COMPLETED'" class="space-y-2">
                <p class="text-sm font-medium text-surface-700">Análisis IA:</p>
                <p class="text-sm text-surface-600 line-clamp-3">{{ radiograph.aiResult.summary }}</p>
                
                <!-- Suspicious Areas Count -->
                <div v-if="radiograph.aiResult.suspiciousAreas && radiograph.aiResult.suspiciousAreas.length > 0" class="flex items-center gap-2">
                  <span class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                    {{ radiograph.aiResult.suspiciousAreas.length }} hallazgo(s)
                  </span>
                  <span v-if="radiograph.aiResult.confidence" class="text-xs text-surface-500">
                    Confianza: {{ Math.round((radiograph.aiResult.confidence as number) * 100) }}%
                  </span>
                </div>
              </div>

              <!-- Error state with retry -->
              <div v-else-if="radiograph.aiResult && radiograph.aiResult.status === 'FAILED'" class="space-y-2">
                <p class="text-sm text-red-600">{{ radiograph.aiResult.errorMessage || 'Error en el análisis' }}</p>
                <button @click="retryAnalysis(radiograph.id)" class="btn-secondary text-sm">
                  Reintentar análisis
                </button>
              </div>

              <!-- Processing state -->
              <div v-else-if="radiograph.aiResult && radiograph.aiResult.status === 'PROCESSING'" class="flex items-center gap-2 text-blue-600">
                <div class="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span class="text-sm">Analizando...</span>
              </div>

              <!-- Worker Notes -->
              <div class="border-t border-surface-100 pt-3">
                <div v-if="editingNotesId === radiograph.id">
                  <textarea
                    v-model="editingNotesContent"
                    class="form-input w-full text-sm"
                    rows="2"
                    placeholder="Añadir notas del profesional..."
                  ></textarea>
                  <div class="flex gap-2 mt-2">
                    <button @click="saveNotes(radiograph.id)" :disabled="isSavingNotes" class="btn-primary text-xs">
                      Guardar
                    </button>
                    <button @click="cancelEditingNotes" class="btn-secondary text-xs">
                      Cancelar
                    </button>
                  </div>
                </div>
                <div v-else>
                  <p v-if="radiograph.notes" class="text-sm text-surface-600">
                    <strong>Notas:</strong> {{ radiograph.notes }}
                  </p>
                  <button @click="startEditingNotes(radiograph)" class="text-xs text-primary-600 hover:text-primary-700 mt-1">
                    {{ radiograph.notes ? 'Editar notas' : 'Añadir notas' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="card p-8 text-center">
          <PhotoIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
          <p class="text-surface-500">No hay radiografías</p>
          <button @click="radiographError = ''; showRadiographModal = true" class="btn-primary mt-4">
            <PlusIcon class="w-4 h-4" />
            Subir primera radiografía
          </button>
        </div>
      </div>

      <!-- Tab: Odontogram -->
      <div v-if="activeTab === 'odontogram'" class="space-y-6">
        <OdontogramComponent :patientId="patientId" />
      </div>

      <!-- Radiograph Upload Modal -->
      <Teleport to="body">
        <div v-if="showRadiographModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-surface-900/50" @click="showRadiographModal = false"></div>
          <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
            <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
              <h2 class="text-lg font-semibold text-surface-900">Subir Radiografía</h2>
              <button @click="showRadiographModal = false" class="text-surface-400 hover:text-surface-600">
                <XMarkIcon class="w-6 h-6" />
              </button>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-2">Archivo (PNG o JPG)</label>
                <div
                  class="border-2 border-dashed border-surface-300 rounded-xl p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                  @click="triggerRadiographUpload"
                >
                  <PhotoIcon class="w-10 h-10 mx-auto text-surface-400 mb-2" />
                  <p class="text-sm text-surface-600">Click para seleccionar archivo</p>
                  <p class="text-xs text-surface-400 mt-1">Máximo 10MB</p>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-2">Notas (opcional)</label>
                <textarea
                  v-model="radiographUploadNotes"
                  class="form-input w-full"
                  rows="2"
                  placeholder="Notas sobre la radiografía..."
                ></textarea>
              </div>
              <p v-if="isUploadingRadiograph" class="text-sm text-primary-600 flex items-center gap-2">
                <div class="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                Subiendo y analizando...
              </p>
              <p v-if="radiographError" class="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {{ radiographError }}
              </p>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Radiograph Detail Modal -->
      <Teleport to="body">
        <div v-if="selectedRadiograph" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-surface-900/75" @click="closeRadiographDetail"></div>
          <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scale-in">
            <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
              <h2 class="text-lg font-semibold text-surface-900">{{ selectedRadiograph.originalFilename }}</h2>
              <button @click="closeRadiographDetail" class="text-surface-400 hover:text-surface-600">
                <XMarkIcon class="w-6 h-6" />
              </button>
            </div>
            <div class="flex flex-col lg:flex-row max-h-[calc(90vh-80px)] overflow-hidden">
              <!-- Image -->
              <div class="lg:w-2/3 bg-surface-900 flex items-center justify-center">
                <img
                  :src="getRadiographImageUrl(selectedRadiograph)"
                  :alt="selectedRadiograph.originalFilename"
                  class="max-w-full max-h-[60vh] object-contain"
                />
              </div>
              <!-- Analysis Panel -->
              <div class="lg:w-1/3 p-6 overflow-y-auto bg-surface-50">
                <h3 class="font-semibold text-surface-900 mb-4">Análisis IA</h3>
                
                <template v-if="selectedRadiograph.aiResult && selectedRadiograph.aiResult.status === 'COMPLETED'">
                  <!-- Summary -->
                  <div class="mb-4">
                    <p class="text-sm font-medium text-surface-700 mb-1">Resumen</p>
                    <p class="text-sm text-surface-600">{{ selectedRadiograph.aiResult.summary }}</p>
                  </div>
                  
                  <!-- Confidence -->
                  <div v-if="selectedRadiograph.aiResult.confidence" class="mb-4">
                    <p class="text-sm font-medium text-surface-700 mb-1">Confianza</p>
                    <div class="flex items-center gap-2">
                      <div class="flex-1 bg-surface-200 rounded-full h-2">
                        <div
                          class="bg-primary-500 h-2 rounded-full"
                          :style="`width: ${(selectedRadiograph.aiResult.confidence as number) * 100}%`"
                        ></div>
                      </div>
                      <span class="text-sm text-surface-600">{{ Math.round((selectedRadiograph.aiResult.confidence as number) * 100) }}%</span>
                    </div>
                  </div>
                  
                  <!-- Findings -->
                  <div v-if="selectedRadiograph.aiResult.suspiciousAreas && selectedRadiograph.aiResult.suspiciousAreas.length > 0" class="mb-4">
                    <p class="text-sm font-medium text-surface-700 mb-2">Hallazgos</p>
                    <div class="space-y-2">
                      <div
                        v-for="(finding, idx) in selectedRadiograph.aiResult.suspiciousAreas"
                        :key="idx"
                        class="p-3 bg-white rounded-lg border border-surface-200"
                      >
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-medium text-sm text-surface-800">{{ finding.area }}</span>
                          <span :class="['px-2 py-0.5 rounded text-xs font-medium', getSeverityClass(finding.severity)]">
                            {{ finding.severity }}
                          </span>
                        </div>
                        <p class="text-xs text-surface-500">{{ finding.finding }}</p>
                        <p class="text-sm text-surface-600 mt-1">{{ finding.description }}</p>
                      </div>
                    </div>
                  </div>
                </template>
                
                <template v-else-if="selectedRadiograph.aiResult && selectedRadiograph.aiResult.status === 'FAILED'">
                  <div class="p-4 bg-red-50 rounded-lg">
                    <p class="text-sm text-red-700">{{ selectedRadiograph.aiResult.errorMessage || 'Error en el análisis' }}</p>
                    <button @click="retryAnalysis(selectedRadiograph.id)" class="btn-primary text-sm mt-3">
                      Reintentar análisis
                    </button>
                  </div>
                </template>
                
                <template v-else-if="selectedRadiograph.aiResult && selectedRadiograph.aiResult.status === 'PROCESSING'">
                  <div class="flex items-center gap-2 text-blue-600">
                    <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span>Analizando radiografía...</span>
                  </div>
                </template>
                
                <template v-else>
                  <p class="text-sm text-surface-500">Análisis pendiente</p>
                </template>
                
                <!-- Notes -->
                <div class="mt-6 pt-4 border-t border-surface-200">
                  <p class="text-sm font-medium text-surface-700 mb-2">Notas del profesional</p>
                  <p v-if="selectedRadiograph.notes" class="text-sm text-surface-600">{{ selectedRadiograph.notes }}</p>
                  <p v-else class="text-sm text-surface-400 italic">Sin notas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </template>

    <!-- Record Modal -->
    <Teleport to="body">
      <div v-if="showRecordModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showRecordModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ isEditingRecord ? 'Editar Registro' : 'Nuevo Registro Clínico' }}
            </h2>
            <div class="flex items-center gap-2">
              <!-- Audio Recording Button (only in create mode) -->
              <button 
                v-if="!isEditingRecord && !isTranscribing"
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
              
              <button @click="showRecordModal = false" class="text-surface-400 hover:text-surface-600">
                <XMarkIcon class="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <form @submit.prevent="saveRecord" class="p-6 space-y-4">
            <div v-if="!isEditingRecord">
              <label class="label">Tipo de registro *</label>
              <select v-model="recordForm.recordType" required class="input">
                <option v-for="type in recordTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
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
              <button type="button" @click="showRecordModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isSavingRecord" class="btn-primary flex-1">
                {{ isSavingRecord ? 'Guardando...' : (isEditingRecord ? 'Guardar Cambios' : 'Crear Registro') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Appointment Modal -->
    <Teleport to="body">
      <div v-if="showAppointmentModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showAppointmentModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">{{ isEditingAppointment ? 'Editar Cita' : 'Nueva Cita' }}</h2>
            <button @click="showAppointmentModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="saveAppointment" class="p-6 space-y-4">
            <div>
              <label class="label">Tipo de cita *</label>
              <select v-model="appointmentForm.type" required class="input">
                <option v-for="type in appointmentTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>
            
            <!-- Worker selector (dropdown with checkboxes) -->
            <div class="relative">
              <label class="label">Médicos asignados *</label>
              <div 
                class="input cursor-pointer flex items-center justify-between"
                @click="showWorkerDropdown = !showWorkerDropdown"
              >
                <span v-if="appointmentForm.workerIds.length === 0" class="text-surface-400">
                  Seleccionar médicos...
                </span>
                <span v-else class="truncate">
                  {{ appointmentForm.workerIds.length }} médico(s) seleccionado(s)
                </span>
                <svg class="w-4 h-4 text-surface-400 transition-transform" :class="{ 'rotate-180': showWorkerDropdown }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <!-- Backdrop to close on click outside -->
              <div 
                v-if="showWorkerDropdown" 
                class="fixed inset-0 z-40" 
                @click="showWorkerDropdown = false"
              ></div>
              <!-- Dropdown panel -->
              <div 
                v-if="showWorkerDropdown"
                class="absolute z-50 mt-1 w-full bg-white border border-surface-200 rounded-lg shadow-lg max-h-48 overflow-auto"
                @click.stop
              >
                <label 
                  v-for="worker in workers" 
                  :key="worker.id"
                  class="flex items-center gap-3 px-3 py-2 hover:bg-surface-50 cursor-pointer"
                >
                  <input 
                    type="checkbox" 
                    :value="worker.id"
                    v-model="appointmentForm.workerIds"
                    class="w-4 h-4 text-primary-600 rounded border-surface-300 focus:ring-primary-500"
                    @click.stop
                  />
                  <span class="text-sm">
                    {{ worker.firstName }} {{ worker.lastName }}
                    <span v-if="worker.id === authStore.user?.id" class="text-primary-600 font-medium">(yo)</span>
                  </span>
                </label>
              </div>
              <p v-if="appointmentForm.workerIds.length === 0" class="text-xs text-danger-500 mt-1">
                Selecciona al menos un médico
              </p>
            </div>
            
            <!-- Status (only when editing) -->
            <div v-if="isEditingAppointment">
              <label class="label">Estado de la cita</label>
              <select v-model="appointmentForm.status" class="input">
                <option v-for="status in appointmentStatuses" :key="status.value" :value="status.value">
                  {{ status.label }}
                </option>
              </select>
            </div>
            
            <div>
              <label class="label">Título (opcional)</label>
              <input v-model="appointmentForm.title" type="text" class="input" placeholder="Descripción breve" />
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Inicio *</label>
                <input v-model="appointmentForm.startTime" type="datetime-local" required class="input" />
              </div>
              <div>
                <label class="label">Fin *</label>
                <input v-model="appointmentForm.endTime" type="datetime-local" required class="input" />
              </div>
            </div>
            
            <div>
              <label class="label">Notas</label>
              <textarea v-model="appointmentForm.notes" rows="2" class="input" placeholder="Notas adicionales..."></textarea>
            </div>
            
            <div class="flex gap-3 pt-4">
              <button type="button" @click="showAppointmentModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isSavingAppointment" class="btn-primary flex-1">
                {{ isSavingAppointment ? 'Guardando...' : (isEditingAppointment ? 'Guardar Cambios' : 'Crear Cita') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Edit Patient Modal -->
    <Teleport to="body">
      <div v-if="showEditPatientModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showEditPatientModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 sticky top-0 bg-white">
            <h2 class="text-lg font-semibold text-surface-900">Editar Paciente</h2>
            <button @click="showEditPatientModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="savePatient" class="p-6 space-y-4">
            <div v-if="patientFormError" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
              {{ patientFormError }}
            </div>
            
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="label">Nombre *</label>
                <input v-model="patientForm.firstName" type="text" required class="input" placeholder="María" />
              </div>
              
              <div>
                <label class="label">Apellidos *</label>
                <input v-model="patientForm.lastName" type="text" required class="input" placeholder="García López" />
              </div>
              
              <div>
                <label class="label">Email</label>
                <input v-model="patientForm.email" type="email" class="input" placeholder="maria@email.com" />
              </div>
              
              <div>
                <label class="label">Teléfono</label>
                <input v-model="patientForm.phone" type="tel" class="input" placeholder="+34 612 345 678" />
              </div>
              
              <div>
                <label class="label">Fecha de nacimiento</label>
                <input v-model="patientForm.dateOfBirth" type="date" class="input" />
              </div>
              
              <div>
                <label class="label">Género</label>
                <select v-model="patientForm.gender" class="input">
                  <option value="">Seleccionar...</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              
              <div>
                <label class="label">DNI/NIE</label>
                <input v-model="patientForm.idNumber" type="text" class="input" placeholder="12345678A" />
              </div>
              
              <div>
                <label class="label">Ciudad</label>
                <input v-model="patientForm.city" type="text" class="input" placeholder="Madrid" />
              </div>
              
              <div>
                <label class="label">Código postal</label>
                <input v-model="patientForm.postalCode" type="text" class="input" placeholder="28001" />
              </div>
              
              <div class="md:col-span-2">
                <label class="label">Dirección</label>
                <input v-model="patientForm.address" type="text" class="input" placeholder="Calle Mayor 10, 2ºB" />
              </div>
              
              <div class="md:col-span-2">
                <label class="label">Alergias</label>
                <textarea v-model="patientForm.allergies" class="input" rows="2" placeholder="Penicilina, látex..."></textarea>
              </div>
              
              <div class="md:col-span-2">
                <label class="label">Notas</label>
                <textarea v-model="patientForm.notes" class="input" rows="2" placeholder="Notas adicionales..."></textarea>
              </div>
            </div>
            
            <div class="flex gap-3 pt-4">
              <button type="button" @click="showEditPatientModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isSavingPatient" class="btn-primary flex-1">
                {{ isSavingPatient ? 'Guardando...' : 'Guardar Cambios' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
