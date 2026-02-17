<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useActiveAppointmentsStore } from '@/stores/activeAppointments'
import { toast } from '@/composables/useToast'
import { api } from '@/services/api'
import { getTenantSlug } from '@/utils/tenant'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'
import { onSocketEvent, joinAppointmentRoom, leaveAppointmentRoom } from '@/services/websocket'
import type { Patient, Appointment, ApiResponse, User, Radiograph } from '@/types'
import OdontogramComponent from '@/components/odontogram/Odontogram.vue'
import PrescriptionTab from '@/pages/clinic/components/PrescriptionTab.vue'
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
  CubeIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
  CheckIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
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
const activeAppointmentsStore = useActiveAppointmentsStore()
const patientId = computed(() => route.params.id as string)

// Build image URL with tenant context for <img> tags (can't send auth headers)
const _tenantSlug = getTenantSlug()
const _API_BASE = import.meta.env.VITE_API_URL || '/api/v1'
const stockImageUrl = (itemId: string) =>
  `${_API_BASE}/stock/items/${itemId}/image${_tenantSlug ? `?tenant=${_tenantSlug}` : ''}`

// Check if current user is admin
const isAdmin = computed(() => {
  const role = authStore.user?.role
  return role === 'ADMIN' || role === 'SUPERADMIN'
})

// Get active appointment for this patient (if any)
const activeAppointmentForPatient = computed(() => {
  return activeAppointmentsStore.appointments.find(a => a.patientId === patientId.value)
})

// Check if appointment can be edited
const canEditAppointment = (apt: Appointment) => {
  if (isAdmin.value) return true
  return apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED'
}

// Check if appointment can be deleted/cancelled (never allow for completed - protects stock and clinical data)
const canDeleteAppointment = (apt: Appointment) => {
  // Never allow deleting completed appointments - they have stock and clinical data
  if (apt.status === 'COMPLETED') return false
  // Cancel already cancelled makes no sense
  if (apt.status === 'CANCELLED') return false
  // Otherwise, same rules as edit
  return canEditAppointment(apt)
}

// Timer tick for real-time updates
const timerTick = ref(0)
let timerInterval: number | null = null

// Computed for live elapsed time display
const liveElapsedTime = computed(() => {
  // Force reactivity with tick
  // eslint-disable-next-line @typescript-eslint/no-unused-vars  
  const _ = timerTick.value
  
  const apt = activeAppointmentForPatient.value
  if (!apt?.realStartTime) return '--:--:--'
  
  const startTime = new Date(apt.realStartTime).getTime()
  const now = Date.now()
  const elapsedMs = now - startTime
  const pausedMs = (apt.pausedDuration ?? 0) * 60000
  const activeMs = elapsedMs - pausedMs
  
  const totalSeconds = Math.floor(activeMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

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
const showSignConfirmModal = ref(false)
const recordToSign = ref<ClinicalRecord | null>(null)

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
const isReadOnlyAppointment = ref(false)
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

// Real time editing (admin only)
const realTimeEditing = ref(false)
const showResetConfirm = ref(false)
const isResettingTime = ref(false)
const realTimeForm = ref({
  realStartTime: '',
  realEndTime: '',
  pausedDuration: 0
})

// Rating requests tracking
const ratingRequestsSent = ref<Record<string, boolean>>({})
const sendingRatingFor = ref<string | null>(null)
const sendingWaNotifyFor = ref<string | null>(null)
const showRatingConfirmModal = ref(false)
const pendingRatingAppointmentId = ref<string | null>(null)
const showCancelConfirmModal = ref(false)
const pendingCancelAppointment = ref<Appointment | null>(null)
const isEmailEnabled = ref(true) // Will be checked on load

// Workers list
const workers = ref<User[]>([])
const showWorkerDropdown = ref(false)

// Stock management for appointments
interface StockItem {
  id: string
  name: string
  sku: string | null
  unit: string
  currentStock: number
  category: string | null
  imageUrl: string | null
}

interface StockPack {
  id: string
  name: string
  category: string | null
  itemCount: number
}

interface AppointmentStockUsage {
  id: string
  itemId: string
  quantity: number
  item: {
    id: string
    name: string
    unit: string
    imageUrl: string | null
  }
}

const stockItems = ref<StockItem[]>([])
const stockPacks = ref<StockPack[]>([])
const appointmentStock = ref<AppointmentStockUsage[]>([])
const stockItemSearch = ref('')
const showStockItemDropdown = ref(false)
const isLoadingStock = ref(false)
const stockQuantity = ref(1)
const stockImageLightbox = ref<string | null>(null)
const selectedStockItem = ref<StockItem | null>(null)  // Selected item before adding

// Pending stock changes (not persisted until save)
interface PendingStockAddition {
  tempId: string  // temporary ID for local tracking
  itemId: string
  quantity: number
  item: StockItem  // full item data for display
}
const pendingStockAdditions = ref<PendingStockAddition[]>([])
const pendingStockRemovals = ref<string[]>([])  // IDs of existing stock usage to remove
const isSavingStock = ref(false)
const stockSaveError = ref('')

// Active appointment stock banner
const bannerStockSearch = ref('')
const showBannerStockDropdown = ref(false)
const bannerStockQuantity = ref(1)
const selectedBannerStockItem = ref<StockItem | null>(null)
const bannerStockItems = ref<AppointmentStockUsage[]>([])
const bannerPendingStock = ref<PendingStockAddition[]>([])
const isLoadingBannerStock = ref(false)
const showNoStockConfirmModal = ref(false)
const showCancelActiveModal = ref(false)
const showCompleteConfirmModal = ref(false)
const cancelConfirmText = ref('')

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
  acceptsMarketing: true,
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
    acceptsMarketing: patient.value.acceptsMarketing ?? true,
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

// Sign record - open confirmation modal
const signRecord = (record: ClinicalRecord) => {
  recordToSign.value = record
  showSignConfirmModal.value = true
}

// Confirm sign record
const confirmSignRecord = async () => {
  if (!recordToSign.value) return
  try {
    await api.post(`/clinical-records/${recordToSign.value.id}/sign`)
    await loadRecords()
    showSignConfirmModal.value = false
    recordToSign.value = null
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
    
    const response = await api.postFormData<any>('/clinical-records/transcribe-audio', formData, { _silentError: true } as any)
    
    if (response.success && response.data) {
      recordForm.value.title = response.data.title || ''
      recordForm.value.content = response.data.content || ''
      recordForm.value.diagnosis = response.data.diagnosis || ''
      recordForm.value.treatment = response.data.treatment || ''
    } else {
      error.value = response.message || 'Error al procesar el audio'
    }
  } catch (err: any) {
    const message = err.response?.data?.message || err.message || ''
    
    if (message.includes('no está habilitada') || message.includes('not enabled')) {
      toast.warning('La IA no está habilitada para esta clínica. Contacte con el administrador para activarla.')
    } else if (message.includes('límite mensual') || message.includes('token limit')) {
      toast.warning('Se ha superado el límite mensual de tokens de IA. Contacte con el administrador para ampliar el límite.')
    } else {
      toast.error('Error al transcribir el audio. Intente de nuevo más tarde.')
    }
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
  isReadOnlyAppointment.value = false
  showAppointmentModal.value = true
}

const openEditAppointmentModal = (apt: Appointment) => {
  isEditingAppointment.value = true
  selectedAppointment.value = apt
  // Read-only mode for workers viewing completed appointments
  isReadOnlyAppointment.value = apt.status === 'COMPLETED' && !isAdmin.value
  
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
  
  // Load stock usage if editing existing appointment
  loadAppointmentStock(apt.id)
}

const saveAppointment = async () => {
  isSavingAppointment.value = true
  stockSaveError.value = ''
  try {
    let appointmentId = selectedAppointment.value?.id
    
    if (isEditingAppointment.value && selectedAppointment.value) {
      // Update existing appointment
      await api.put(`/appointments/${selectedAppointment.value.id}`, {
        type: appointmentForm.value.type,
        title: appointmentForm.value.title || undefined,
        startTime: appointmentForm.value.startTime,
        endTime: appointmentForm.value.endTime,
        notes: appointmentForm.value.notes || undefined,
        status: appointmentForm.value.status,
        workerIds: appointmentForm.value.workerIds.length > 0 ? appointmentForm.value.workerIds : undefined,
      })
      
      // Persist pending stock changes if any
      if (hasPendingStockChanges.value && appointmentId) {
        await persistPendingStockChanges(appointmentId)
      }
    } else {
      // Create new appointment
      const response = await api.post<ApiResponse<Appointment>>('/appointments', {
        patientId: patientId.value,
        type: appointmentForm.value.type,
        title: appointmentForm.value.title || undefined,
        startTime: appointmentForm.value.startTime,
        endTime: appointmentForm.value.endTime,
        notes: appointmentForm.value.notes || undefined,
        workerIds: appointmentForm.value.workerIds.length > 0 ? appointmentForm.value.workerIds : undefined,
      })
      // Note: New appointments won't have stock changes since we only show stock section for editing
      appointmentId = response.data?.id
    }
    
    // Reset pending stock on successful save
    resetPendingStockChanges()
    
    showAppointmentModal.value = false
    isEditingAppointment.value = false
    selectedAppointment.value = null
    await loadAppointments()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error saving appointment'
    // Don't close modal if there's an error
  } finally {
    isSavingAppointment.value = false
  }
}

// Close appointment modal and reset pending stock changes
const closeAppointmentModal = () => {
  // Reset pending stock changes (discard any unsaved changes)
  resetPendingStockChanges()
  // Reset stock selection
  selectedStockItem.value = null
  stockItemSearch.value = ''
  stockQuantity.value = 1
  // Reset real time editing state
  realTimeEditing.value = false
  showResetConfirm.value = false
  // Close modal
  showAppointmentModal.value = false
  isEditingAppointment.value = false
  selectedAppointment.value = null
}

const cancelAppointment = (apt: Appointment) => {
  pendingCancelAppointment.value = apt
  showCancelConfirmModal.value = true
}

const closeCancelConfirmModal = () => {
  showCancelConfirmModal.value = false
  pendingCancelAppointment.value = null
}

const confirmCancelAppointment = async () => {
  if (!pendingCancelAppointment.value) return
  try {
    await api.delete(`/appointments/${pendingCancelAppointment.value.id}`)
    await loadAppointments()
    toast.success('Cita cancelada correctamente')
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error cancelling appointment'
  } finally {
    closeCancelConfirmModal()
  }
}

// Real time management (admin only)
const initRealTimeForm = () => {
  if (!selectedAppointment.value) return
  const apt = selectedAppointment.value
  realTimeForm.value = {
    realStartTime: apt.realStartTime ? new Date(apt.realStartTime).toISOString().slice(0, 16) : '',
    realEndTime: apt.realEndTime ? new Date(apt.realEndTime).toISOString().slice(0, 16) : '',
    pausedDuration: apt.pausedDuration || 0
  }
  realTimeEditing.value = true
}

const formatRealDuration = (apt: Appointment) => {
  if (!apt.realStartTime || !apt.realEndTime) return null
  const start = new Date(apt.realStartTime)
  const end = new Date(apt.realEndTime)
  let diffMs = end.getTime() - start.getTime()
  if (apt.pausedDuration) {
    diffMs -= apt.pausedDuration * 60 * 1000
  }
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

const handleUpdateRealTime = async () => {
  if (!selectedAppointment.value) return
  try {
    await api.put(`/appointments/${selectedAppointment.value.id}/real-time`, {
      realStartTime: realTimeForm.value.realStartTime ? new Date(realTimeForm.value.realStartTime).toISOString() : null,
      realEndTime: realTimeForm.value.realEndTime ? new Date(realTimeForm.value.realEndTime).toISOString() : null,
      pausedDuration: realTimeForm.value.pausedDuration || 0
    })
    await loadAppointments()
    realTimeEditing.value = false
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error updating real time'
  }
}

const handleResetRealTime = async () => {
  if (!selectedAppointment.value) return
  isResettingTime.value = true
  try {
    await api.post(`/appointments/${selectedAppointment.value.id}/reset-time`)
    await loadAppointments()
    showResetConfirm.value = false
    showAppointmentModal.value = false
    selectedAppointment.value = null
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error resetting time'
  } finally {
    isResettingTime.value = false
  }
}


// Open rating confirmation modal instead of using confirm()
const openRatingConfirmModal = (appointmentId: string) => {
  pendingRatingAppointmentId.value = appointmentId
  showRatingConfirmModal.value = true
}

// Close rating modal
const closeRatingConfirmModal = () => {
  showRatingConfirmModal.value = false
  pendingRatingAppointmentId.value = null
}

// Rating result state 
const ratingSuccess = ref<string | null>(null)
const ratingError = ref<string | null>(null)

// Send rating request email for completed appointment
const confirmSendRatingRequest = async () => {
  if (!pendingRatingAppointmentId.value) return
  
  const appointmentId = pendingRatingAppointmentId.value
  showRatingConfirmModal.value = false
  sendingRatingFor.value = appointmentId
  ratingSuccess.value = null
  ratingError.value = null
  
  try {
    const response = await api.post<{ success: boolean; error?: string; ratingUrl?: string; alreadySent?: boolean }>(
      `/ratings/test/${appointmentId}`
    )
    if (response.success) {
      ratingRequestsSent.value[appointmentId] = true
      ratingSuccess.value = 'Email de valoración enviado correctamente'
      setTimeout(() => { ratingSuccess.value = null }, 3000)
    } else if (response.alreadySent) {
      ratingRequestsSent.value[appointmentId] = true
      ratingSuccess.value = 'El email de valoración ya fue enviado anteriormente'
      setTimeout(() => { ratingSuccess.value = null }, 3000)
    } else {
      ratingError.value = response.error || 'Error al enviar el email'
      setTimeout(() => { ratingError.value = null }, 5000)
    }
  } catch (err: any) {
    console.error('Error sending rating request:', err)
    ratingError.value = err.message || 'Error al enviar el email de valoración'
    setTimeout(() => { ratingError.value = null }, 5000)
  } finally {
    sendingRatingFor.value = null
    pendingRatingAppointmentId.value = null
  }
}

// Send WhatsApp notification for an appointment
const sendWaNotify = async (apt: any) => {
  sendingWaNotifyFor.value = apt.id
  try {
    await api.post(`/appointments/${apt.id}/wa-notify`, {
      eventType: 'CREATED',
    })
    apt.waNotificationSentAt = new Date().toISOString()
    toast.success('Notificación WhatsApp enviada')
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Error al enviar notificación WhatsApp')
  } finally {
    sendingWaNotifyFor.value = null
  }
}

// Stock management functions
const filteredStockItems = computed(() => {
  if (!stockItemSearch.value) return stockItems.value.slice(0, 8)
  const search = stockItemSearch.value.toLowerCase()
  return stockItems.value
    .filter(item => 
      item.name.toLowerCase().includes(search) || 
      item.sku?.toLowerCase().includes(search)
    )
    .slice(0, 8)
})

const loadStockItems = async () => {
  try {
    const response = await api.get<ApiResponse<{ data: StockItem[], total: number }>>('/stock/items?limit=500&active=true')
    if (response.success && response.data?.data) {
      stockItems.value = response.data.data
    }
  } catch (err) {
    console.warn('Could not load stock items', err)
  }
}

const loadStockPacks = async () => {
  try {
    const response = await api.get<ApiResponse<{ data: StockPack[], total: number }>>('/stock/packs?limit=100')
    if (response.success && response.data?.data) {
      stockPacks.value = response.data.data
    }
  } catch (err) {
    console.warn('Could not load stock packs', err)
  }
}

const loadAppointmentStock = async (appointmentId: string) => {
  isLoadingStock.value = true
  try {
    const response = await api.get<ApiResponse<{ items: AppointmentStockUsage[], totalItems: number, totalCost: string }>>(`/appointments/${appointmentId}/stock`)
    if (response.success && response.data?.items) {
      appointmentStock.value = response.data.items
    } else {
      appointmentStock.value = []
    }
  } catch (err) {
    console.warn('Could not load appointment stock', err)
    appointmentStock.value = []
  } finally {
    isLoadingStock.value = false
  }
}

// Computed: Combined view of stock (existing + pending added - pending removed)
const visibleStockItems = computed(() => {
  // Filter out items marked for removal and add isPending flag
  const existingFiltered = appointmentStock.value
    .filter(usage => !pendingStockRemovals.value.includes(usage.id))
    .map(usage => ({
      ...usage,
      isPending: false,
    }))
  
  // Convert pending additions to display format
  const pendingAsUsage = pendingStockAdditions.value.map(pending => ({
    id: pending.tempId,
    itemId: pending.itemId,
    quantity: pending.quantity,
    isPending: true, // flag to show different styling
    item: {
      id: pending.item.id,
      name: pending.item.name,
      unit: pending.item.unit,
      imageUrl: pending.item.imageUrl,
    }
  }))
  
  return [...existingFiltered, ...pendingAsUsage]
})

// Check if there are any pending changes
const hasPendingStockChanges = computed(() => {
  return pendingStockAdditions.value.length > 0 || pendingStockRemovals.value.length > 0
})

// Select stock item from dropdown (doesn't add yet)
const selectStockItem = (item: StockItem) => {
  selectedStockItem.value = item
  stockItemSearch.value = item.name
  showStockItemDropdown.value = false
}

// Clear selected stock item
const clearSelectedStockItem = () => {
  selectedStockItem.value = null
  stockItemSearch.value = ''
  stockQuantity.value = 1
}

// Add selected stock item to pending list
const addSelectedStockToAppointment = () => {
  if (!selectedAppointment.value || !selectedStockItem.value) return
  
  const item = selectedStockItem.value
  const quantity = stockQuantity.value
  
  if (quantity < 1) {
    stockSaveError.value = 'La cantidad debe ser al menos 1'
    return
  }
  
  // Check if already in pending (merge quantities)
  const existingPending = pendingStockAdditions.value.find(p => p.itemId === item.id)
  if (existingPending) {
    existingPending.quantity += quantity
  } else {
    // Also check if it's in the existing stock (should update quantity)
    const existingStock = appointmentStock.value.find(s => s.itemId === item.id)
    if (existingStock && !pendingStockRemovals.value.includes(existingStock.id)) {
      // Add to pending as new entry (will create separate usage record)
      pendingStockAdditions.value.push({
        tempId: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        itemId: item.id,
        quantity,
        item,
      })
    } else {
      // Add to pending
      pendingStockAdditions.value.push({
        tempId: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        itemId: item.id,
        quantity,
        item,
      })
    }
  }
  
  // Reset selection
  clearSelectedStockItem()
  stockSaveError.value = ''
}

// Apply pack - adds all pack items to pending
const applyPackToAppointment = async (packId: string) => {
  if (!selectedAppointment.value) return
  try {
    // Get pack items from API
    const response = await api.get<ApiResponse<{ items: Array<{ itemId: string, quantity: number, item: StockItem }> }>>(`/stock/packs/${packId}`)
    if (response.success && response.data?.items) {
      // Add each pack item to pending
      for (const packItem of response.data.items) {
        const existingPending = pendingStockAdditions.value.find(p => p.itemId === packItem.itemId)
        if (existingPending) {
          existingPending.quantity += packItem.quantity
        } else {
          pendingStockAdditions.value.push({
            tempId: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            itemId: packItem.itemId,
            quantity: packItem.quantity,
            item: packItem.item,
          })
        }
      }
    }
  } catch (err: any) {
    stockSaveError.value = err.response?.data?.message || 'Error al cargar pack'
  }
}

// Remove stock - either remove from pending or mark existing for removal
const removeStockFromAppointment = (usageId: string) => {
  // Check if it's a pending addition
  const pendingIndex = pendingStockAdditions.value.findIndex(p => p.tempId === usageId)
  if (pendingIndex >= 0) {
    // Remove from pending additions
    pendingStockAdditions.value.splice(pendingIndex, 1)
  } else {
    // It's an existing item - mark for removal
    if (!pendingStockRemovals.value.includes(usageId)) {
      pendingStockRemovals.value.push(usageId)
    }
  }
}

// Persist all pending stock changes to backend
const persistPendingStockChanges = async (appointmentId: string) => {
  isSavingStock.value = true
  stockSaveError.value = ''
  
  try {
    // 1. Remove items marked for removal
    for (const usageId of pendingStockRemovals.value) {
      await api.delete(`/appointments/${appointmentId}/stock/${usageId}`)
    }
    
    // 2. Add pending additions
    for (const pending of pendingStockAdditions.value) {
      await api.post(`/appointments/${appointmentId}/stock`, {
        itemId: pending.itemId,
        quantity: pending.quantity,
      })
    }
    
    // 3. Clear pending state
    resetPendingStockChanges()
    
    // 4. Reload actual stock from server
    await loadAppointmentStock(appointmentId)
    await loadStockItems()
    
  } catch (err: any) {
    stockSaveError.value = err.response?.data?.message || 'Error al guardar stock'
    throw err // Re-throw so saveAppointment knows there was an error
  } finally {
    isSavingStock.value = false
  }
}

// Reset pending changes (on cancel or after successful save)
const resetPendingStockChanges = () => {
  pendingStockAdditions.value = []
  pendingStockRemovals.value = []
  stockSaveError.value = ''
}

// ==========================================
// Banner Stock Functions (for active appointment)
// ==========================================

// Computed: filtered stock items for banner search
const filteredBannerStockItems = computed(() => {
  if (!bannerStockSearch.value) return stockItems.value.slice(0, 8)
  const search = bannerStockSearch.value.toLowerCase()
  return stockItems.value
    .filter(item => 
      item.name.toLowerCase().includes(search) || 
      item.sku?.toLowerCase().includes(search)
    )
    .slice(0, 8)
})

// Computed: combined visible banner stock (existing + pending)
const visibleBannerStockItems = computed(() => {
  // Ensure arrays exist
  const existingItems = bannerStockItems.value || []
  const pendingItems = bannerPendingStock.value || []
  
  // Pending additions as usage-like objects
  const pendingAsUsage = pendingItems.map(pending => ({
    id: pending.tempId,
    itemId: pending.itemId,
    quantity: pending.quantity,
    isPending: true,
    item: {
      id: pending.item.id,
      name: pending.item.name,
      unit: pending.item.unit,
      imageUrl: pending.item.imageUrl,
    }
  }))
  
  return [...existingItems.map(s => ({ ...s, isPending: false })), ...pendingAsUsage]
})

// Load stock for the active appointment (called when banner mounts)
const loadBannerStock = async () => {
  const apt = activeAppointmentForPatient.value
  if (!apt) {
    if (bannerStockItems.value.length > 0) {
      bannerStockItems.value = []
    }
    isLoadingBannerStock.value = false
    return
  }
  
  // Only show loading on first load, not on polling updates
  const isFirstLoad = bannerStockItems.value.length === 0
  if (isFirstLoad) {
    isLoadingBannerStock.value = true
  }
  
  try {
    const response = await api.get<ApiResponse<{ items: AppointmentStockUsage[], totalItems: number }>>(`/appointments/${apt.id}/stock`)
    if (response.success && response.data?.items && Array.isArray(response.data.items)) {
      // Only update if data actually changed (prevents flickering)
      const newData = JSON.stringify(response.data.items)
      const currentData = JSON.stringify(bannerStockItems.value)
      if (newData !== currentData) {
        bannerStockItems.value = response.data.items
      }
    } else if (bannerStockItems.value.length > 0) {
      bannerStockItems.value = []
    }
  } catch (err) {
    console.warn('Could not load banner stock', err)
    // Don't clear on error during polling
    if (isFirstLoad) {
      bannerStockItems.value = []
    }
  } finally {
    isLoadingBannerStock.value = false
  }
}

// Select banner stock item from dropdown
const selectBannerStockItem = (item: StockItem) => {
  selectedBannerStockItem.value = item
  bannerStockSearch.value = item.name
  showBannerStockDropdown.value = false
}

// Clear selected banner stock item
const clearBannerStockItem = () => {
  selectedBannerStockItem.value = null
  bannerStockSearch.value = ''
  bannerStockQuantity.value = 1
}

// Add stock item to banner (immediately persists to backend)
const addBannerStockItem = async () => {
  const apt = activeAppointmentForPatient.value
  if (!apt || !selectedBannerStockItem.value) return
  
  const item = selectedBannerStockItem.value
  const quantity = bannerStockQuantity.value
  
  if (quantity < 1) return
  
  try {
    await api.post(`/appointments/${apt.id}/stock`, {
      itemId: item.id,
      quantity: quantity,
    })
    
    // Reload stock list
    await loadBannerStock()
    await loadStockItems() // Update available stock counts
    
    // Clear selection
    clearBannerStockItem()
  } catch (err: any) {
    console.error('Error adding stock to appointment', err)
  }
}

// Remove stock from banner (persists immediately)
const removeBannerStockItem = async (usageId: string) => {
  const apt = activeAppointmentForPatient.value
  if (!apt) return
  
  try {
    await api.delete(`/appointments/${apt.id}/stock/${usageId}`)
    await loadBannerStock()
    await loadStockItems()
  } catch (err) {
    console.error('Error removing stock', err)
  }
}

// Apply pack to banner
const applyBannerPack = async (packId: string) => {
  const apt = activeAppointmentForPatient.value
  if (!apt || !packId) return
  
  try {
    const response = await api.get<ApiResponse<{ items: { itemId: string; quantity: number; item: StockItem }[] }>>(`/stock/packs/${packId}`)
    if (response.success && response.data?.items) {
      for (const packItem of response.data.items) {
        await api.post(`/appointments/${apt.id}/stock`, {
          itemId: packItem.itemId,
          quantity: packItem.quantity,
        })
      }
      await loadBannerStock()
      await loadStockItems()
    }
  } catch (err) {
    console.error('Error applying pack', err)
  }
}

// Complete appointment with validation
const handleCompleteWithValidation = async () => {
  const apt = activeAppointmentForPatient.value
  if (!apt) return
  
  // Check if there's any stock assigned (both existing and pending)
  const hasStock = visibleBannerStockItems.value.length > 0
  
  if (!hasStock) {
    showNoStockConfirmModal.value = true
    return
  }
  
  // Stock exists, show confirmation modal
  showCompleteConfirmModal.value = true
}

// Confirm complete appointment
const confirmCompleteAppointment = async () => {
  const apt = activeAppointmentForPatient.value
  if (!apt) return
  
  showCompleteConfirmModal.value = false
  await completeAppointmentWithStock(apt.id)
}

// Confirm complete without stock
const confirmCompleteWithoutStock = async () => {
  const apt = activeAppointmentForPatient.value
  if (!apt) return
  
  showNoStockConfirmModal.value = false
  await activeAppointmentsStore.completeAppointment(apt.id)
}

// Confirm cancel active appointment
const confirmCancelActiveAppointment = async () => {
  const apt = activeAppointmentForPatient.value
  if (!apt) return
  
  showCancelActiveModal.value = false
  cancelConfirmText.value = ''
  await activeAppointmentsStore.cancelActiveAppointment(apt.id)
  // Clear banner state
  bannerStockItems.value = []
  bannerPendingStock.value = []
}

// Complete appointment with stock confirmation
const completeAppointmentWithStock = async (appointmentId: string) => {
  try {
    // First, confirm all pending stock (this deducts from inventory)
    await api.post(`/appointments/${appointmentId}/stock/confirm`)
    
    // Then complete the appointment
    await activeAppointmentsStore.completeAppointment(appointmentId)
    
    // Clear banner state
    bannerStockItems.value = []
    bannerPendingStock.value = []
  } catch (err) {
    console.error('Error completing appointment with stock', err)
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
const showDeleteRadiographModal = ref(false)
const radiographToDelete = ref<Radiograph | null>(null)
const isDeletingRadiograph = ref(false)
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

    const response = await fetch(`${API_BASE}/radiographs/patient/${patientId.value}`, {
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
    const response = await api.post<ApiResponse<unknown>>(`/radiographs/${radiographId}/retry-analysis`, {}, { _silentError: true } as any)
    if (response.success) {
      toast.success('Análisis de IA iniciado')
      await loadRadiographs()
    }
  } catch (err: any) {
    console.error('Error retrying analysis:', err)
    const message = err.response?.data?.message || err.message || ''
    
    // Check for specific AI-related errors
    if (message.includes('no está habilitada') || message.includes('not enabled')) {
      toast.warning('La IA no está habilitada para esta clínica. Contacte con el administrador para activarla.')
    } else if (message.includes('límite mensual') || message.includes('token limit')) {
      toast.warning('Se ha superado el límite mensual de tokens de IA. Contacte con el administrador para ampliar el límite.')
    } else {
      toast.error('Error al analizar la radiografía. Intente de nuevo más tarde.')
    }
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

    const response = await fetch(`${API_BASE}/radiographs/${radiographId}/image`, {
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

// Delete radiograph
const confirmDeleteRadiograph = (radiograph: Radiograph) => {
  radiographToDelete.value = radiograph
  showDeleteRadiographModal.value = true
}

const deleteRadiograph = async () => {
  if (!radiographToDelete.value) return
  isDeletingRadiograph.value = true
  const deletingId = radiographToDelete.value.id
  try {
    await api.delete(`/radiographs/${deletingId}`)
    // Close detail modal if the deleted radiograph was being viewed
    if (selectedRadiograph.value?.id === deletingId) {
      selectedRadiograph.value = null
    }
    showDeleteRadiographModal.value = false
    radiographToDelete.value = null
    await loadRadiographs()
  } catch (err: any) {
    radiographError.value = err.response?.data?.message || 'Error al eliminar la radiografía'
  } finally {
    isDeletingRadiograph.value = false
  }
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

// Reload banner stock when active appointment changes (by ID)
// Also join/leave WebSocket appointment rooms for real-time updates
watch(
  () => activeAppointmentForPatient.value?.id,
  (newId, oldId) => {
    // Leave old room if previously in one
    if (oldId) {
      leaveAppointmentRoom(oldId)
    }
    
    if (newId && newId !== oldId) {
      // Join new appointment room for real-time stock updates
      joinAppointmentRoom(newId)
      // Only load stock via HTTP on initial mount or when switching appointments
      // WebSocket listener will handle real-time updates
      loadBannerStock()
    } else if (!newId) {
      bannerStockItems.value = []
    }
  },
  { immediate: true } // Join room if already active on mount
)

// Load notification status (email enabled check)
const loadNotificationStatus = async () => {
  try {
    const response = await api.get<ApiResponse<{ emailEnabled: boolean; smsEnabled: boolean }>>('/notifications/status')
    if (response.success && response.data) {
      isEmailEnabled.value = response.data.emailEnabled
    }
  } catch (err) {
    // If endpoint fails, assume email is not enabled
    isEmailEnabled.value = false
  }
}

// Watch for patient ID changes (e.g., clicking different patient in Notch)
// This is needed because Vue Router doesn't remount the component when only params change
watch(patientId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    console.log('🔄 Patient changed, reloading data for:', newId)
    // Reset state
    patient.value = null
    bannerStockItems.value = []
    selectedRadiograph.value = null
    
    // Leave old appointment room
    if (oldId) {
      leaveAppointmentRoom()
    }
    
    // Reload all data for new patient
    loadPatient()
    loadBannerStock()
    loadNotificationStatus()
  }
})

// WebSocket listener cleanup function
let unsubscribeStockUpdates: (() => void) | null = null

onMounted(() => {
  loadPatient()
  loadWorkers()
  loadStockItems()
  loadStockPacks()
  loadNotificationStatus()
  loadBannerStock() // Load stock for active appointment banner
  
  // Subscribe to stock:updated WebSocket events for real-time sync
  unsubscribeStockUpdates = onSocketEvent('stock:updated', (data: unknown) => {
    const { appointmentId, items } = data as { appointmentId: string; items: AppointmentStockUsage[] }
    const apt = activeAppointmentForPatient.value
    
    // Only update if this is for our current appointment
    if (apt && apt.id === appointmentId && items) {
      console.log('🔌 Stock updated (via WS):', items.length, 'items')
      bannerStockItems.value = items
    }
  })
  
  // Start timer for active appointment display
  timerInterval = window.setInterval(() => {
    timerTick.value++
  }, 1000)
})

// Cleanup polling on unmount
onUnmounted(() => {
  stopPolling()
  if (timerInterval) {
    clearInterval(timerInterval)
  }
  // Leave appointment room if in one
  leaveAppointmentRoom()
  // Cleanup WebSocket listener
  if (unsubscribeStockUpdates) {
    unsubscribeStockUpdates()
  }
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
              <router-link
                v-if="authStore.hasPermission('whatsapp')"
                :to="`/clinic/whatsapp?phone=${encodeURIComponent(patient.phone)}`"
                class="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors text-xs font-medium"
                title="Ver conversación de WhatsApp"
              >
                <ChatBubbleLeftRightIcon class="w-3.5 h-3.5" />
                WhatsApp
              </router-link>
            </span>
          </div>
        </div>
        
        <!-- Action buttons -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <!-- Edit patient button -->
          <button @click="openEditPatientModal" class="btn-secondary">
            <PencilIcon class="w-4 h-4" />
            <span class="hidden sm:inline">Editar</span>
          </button>
        </div>
      </div>

      <!-- Active Appointment Stock Banner -->
      <div 
        v-if="activeAppointmentForPatient" 
        class="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 shadow-sm"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <span class="w-3 h-3 rounded-full bg-white animate-pulse" />
            </div>
            <div>
              <h3 class="font-semibold text-emerald-900">Cita en Curso</h3>
              <p class="text-sm text-emerald-700">
                {{ activeAppointmentForPatient?.title || 'Cita activa' }}
                <span class="mx-1">•</span>
                <span class="font-mono">{{ liveElapsedTime }}</span>
              </p>
            </div>
          </div>
          
          <!-- Action buttons -->
          <div class="flex items-center gap-2">
            <!-- Pause/Resume -->
            <button 
              v-if="activeAppointmentsStore.isPaused(activeAppointmentForPatient)"
              @click="activeAppointmentsStore.resumeAppointment(activeAppointmentForPatient.id)"
              class="btn-secondary !bg-white !border-emerald-300 hover:!bg-emerald-50"
              title="Reanudar"
            >
              <PlayIcon class="w-4 h-4 text-emerald-600" />
              <span class="hidden sm:inline">Reanudar</span>
            </button>
            <button 
              v-else
              @click="activeAppointmentsStore.pauseAppointment(activeAppointmentForPatient.id)"
              class="btn-secondary !bg-white !border-amber-300 hover:!bg-amber-50"
              title="Pausar"
            >
              <PauseIcon class="w-4 h-4 text-amber-600" />
              <span class="hidden sm:inline">Pausar</span>
            </button>
            
            <!-- Complete -->
            <button 
              @click="handleCompleteWithValidation"
              class="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
              title="Finalizar cita"
            >
              <CheckIcon class="w-4 h-4" />
              <span class="hidden sm:inline">Finalizar</span>
            </button>
            
            <!-- Divider -->
            <div class="w-px h-6 bg-surface-300 mx-1"></div>
            
            <!-- Cancel (separated as destructive action) -->
            <button 
              @click="showCancelActiveModal = true"
              class="btn-secondary !bg-white !border-red-300 hover:!bg-red-50"
              title="Cancelar cita"
            >
              <XMarkIcon class="w-4 h-4 text-red-600" />
              <span class="hidden sm:inline">Cancelar</span>
            </button>
          </div>
        </div>
        
        <!-- Stock Section -->
        <div class="bg-white/70 backdrop-blur rounded-xl p-4 border border-emerald-100">
          <label class="label flex items-center gap-2 mb-3 text-emerald-800">
            <CubeIcon class="w-4 h-4" />
            Stock Utilizado
          </label>
          
          <!-- Pack Selector + Search Row -->
          <div class="flex flex-col sm:flex-row gap-2 mb-3">
            <!-- Pack selector -->
            <select 
              v-if="stockPacks.length > 0"
              class="input flex-shrink-0 text-sm sm:w-48"
              @change="(e: Event) => { const target = e.target as HTMLSelectElement; if (target.value) { applyBannerPack(target.value); target.value = ''; } }"
            >
              <option value="">+ Pack rápido...</option>
              <option v-for="pack in stockPacks" :key="pack.id" :value="pack.id">
                {{ pack.name }} ({{ pack.itemCount || 0 }})
              </option>
            </select>
            
            <!-- Search + Quantity + Add -->
            <div class="flex gap-2 flex-1">
              <div class="relative flex-1">
                <MagnifyingGlassIcon class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input 
                  v-model="bannerStockSearch"
                  type="text"
                  :placeholder="selectedBannerStockItem ? '' : 'Buscar item...'"
                  class="input pl-8 text-sm w-full"
                  :class="{ 'pr-8 bg-primary-50 border-primary-300': selectedBannerStockItem }"
                  @focus="!selectedBannerStockItem && (showBannerStockDropdown = true)"
                  :readonly="!!selectedBannerStockItem"
                />
                <!-- Clear selection -->
                <button
                  v-if="selectedBannerStockItem"
                  type="button"
                  @click="clearBannerStockItem"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  <XMarkIcon class="w-4 h-4" />
                </button>
              </div>
              <input 
                v-model.number="bannerStockQuantity" 
                type="number" 
                min="1" 
                class="input w-16 text-sm text-center"
                placeholder="Qty"
              />
              <button
                v-if="selectedBannerStockItem"
                type="button"
                @click="addBannerStockItem"
                class="btn-primary btn-sm px-3"
                title="Añadir"
              >
                <PlusIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <!-- Dropdown Backdrop -->
          <div 
            v-if="showBannerStockDropdown" 
            class="fixed inset-0 z-40" 
            @click="showBannerStockDropdown = false"
          />
          
          <!-- Dropdown -->
          <div 
            v-if="showBannerStockDropdown && filteredBannerStockItems.length > 0 && !selectedBannerStockItem" 
            class="relative z-50 -mt-2 mb-2"
          >
            <div class="bg-white border border-surface-200 rounded-lg shadow-lg max-h-48 overflow-auto">
              <button
                v-for="item in filteredBannerStockItems"
                :key="item.id"
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-surface-50 flex items-center gap-3"
                @click="selectBannerStockItem(item)"
              >
                <div class="w-8 h-8 rounded bg-surface-100 overflow-hidden flex-shrink-0">
                  <img 
                    v-if="item.imageUrl" 
                    :src="stockImageUrl(item.id)"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-surface-400">
                    <CubeIcon class="w-4 h-4" />
                  </div>
                </div>
                <span class="flex-1 truncate">{{ item.name }}</span>
                <span class="text-xs text-surface-400 flex-shrink-0">{{ item.currentStock }} {{ item.unit }}</span>
              </button>
            </div>
          </div>
          
          <!-- Stock Items List -->
          <div v-if="isLoadingBannerStock" class="text-center py-3">
            <div class="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          </div>
          <div v-else-if="visibleBannerStockItems.length > 0" class="flex flex-wrap gap-2">
            <div 
              v-for="usage in visibleBannerStockItems" 
              :key="usage.id"
              class="inline-flex items-center gap-2 py-1.5 px-3 rounded-full text-sm bg-white border border-surface-200"
            >
              <span class="truncate max-w-[120px]">{{ usage.item.name }}</span>
              <span class="text-surface-500">×{{ usage.quantity }}</span>
              <button 
                type="button"
                @click="removeBannerStockItem(usage.id)"
                class="text-red-400 hover:text-red-600 -mr-1"
                title="Quitar"
              >
                <XMarkIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
          <p v-else class="text-sm text-surface-400 text-center py-2">
            No hay stock registrado aún
          </p>
        </div>
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
          <button
            @click="activeTab = 'prescriptions'"
            :class="['px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px', 
              activeTab === 'prescriptions' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700']"
          >
            Recetas
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
            class="card flex items-center gap-4 p-4 !overflow-visible"
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
              <!-- WhatsApp notification status -->
              <template v-if="authStore.hasPermission('whatsapp')">
                <!-- Already sent -->
                <div v-if="apt.waNotificationSentAt" class="relative group">
                  <span class="p-2 text-green-500 inline-flex">
                    <ChatBubbleLeftRightIcon class="w-4 h-4" />
                  </span>
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-800 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none whitespace-nowrap">
                    WA enviada: {{ new Date(apt.waNotificationSentAt).toLocaleString('es-ES') }}
                    <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
                  </div>
                </div>
                <!-- Not sent — send button (only for SCHEDULED appointments) -->
                <div v-else-if="apt.status === 'SCHEDULED'" class="relative group">
                  <button
                    @click="sendWaNotify(apt)"
                    :disabled="sendingWaNotifyFor === apt.id"
                    class="p-2 text-surface-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <ChatBubbleLeftRightIcon v-if="sendingWaNotifyFor !== apt.id" class="w-4 h-4" />
                    <div v-else class="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                  </button>
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-800 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none whitespace-nowrap">
                    Enviar notificación WhatsApp
                    <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
                  </div>
                </div>
              </template>
              <!-- Send rating button for completed appointments -->
              <!-- Disabled when email not enabled - with visible tooltip -->
              <div 
                v-if="apt.status === 'COMPLETED' && isAdmin && !ratingRequestsSent[apt.id] && !isEmailEnabled"
                class="relative group"
              >
                <button 
                  disabled
                  class="p-2 text-gray-300 cursor-not-allowed rounded-lg"
                >
                  <StarIcon class="w-4 h-4" />
                </button>
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-800 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none whitespace-nowrap">
                  Email no configurado
                  <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
                </div>
              </div>
              <!-- Active button when email is enabled -->
              <div 
                v-else-if="apt.status === 'COMPLETED' && isAdmin && !ratingRequestsSent[apt.id]"
                class="relative group"
              >
                <button 
                  @click="openRatingConfirmModal(apt.id)"
                  :disabled="sendingRatingFor === apt.id"
                  class="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                >
                  <StarIcon v-if="sendingRatingFor !== apt.id" class="w-4 h-4" />
                  <div v-else class="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </button>
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-800 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none whitespace-nowrap">
                  Enviar email de valoración
                  <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
                </div>
              </div>
              <div 
                v-else-if="apt.status === 'COMPLETED' && ratingRequestsSent[apt.id]"
                class="relative group"
              >
                <span class="p-2 text-green-500 inline-flex">
                  <StarIcon class="w-4 h-4" />
                </span>
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-800 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none whitespace-nowrap">
                  Valoración enviada ✓
                  <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
                </div>
              </div>
              <!-- View details button for completed appointments (available to all) -->
              <div v-if="apt.status === 'COMPLETED' && !isAdmin" class="relative group">
                <button 
                  @click="openEditAppointmentModal(apt)" 
                  class="p-2 text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                >
                  <EyeIcon class="w-4 h-4" />
                </button>
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-800 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none whitespace-nowrap">
                  Ver detalles
                  <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
                </div>
              </div>
              <!-- Edit button (only for admin on completed, or anyone on non-completed) -->
              <div v-if="canEditAppointment(apt)" class="relative group">
                <button 
                  @click="openEditAppointmentModal(apt)" 
                  class="p-2 text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                >
                  <PencilIcon class="w-4 h-4" />
                </button>
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-800 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none whitespace-nowrap">
                  Editar cita
                  <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
                </div>
              </div>
              <div v-if="canDeleteAppointment(apt)" class="relative group">
                <button 
                  @click="cancelAppointment(apt)" 
                  class="p-2 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                >
                  <XMarkIcon class="w-4 h-4" />
                </button>
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-800 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none whitespace-nowrap">
                  Cancelar cita
                  <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
                </div>
              </div>
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
            class="card overflow-hidden hover:shadow-lg transition-shadow group"
          >
            <!-- Image -->
            <div class="aspect-video bg-surface-100 relative cursor-pointer" @click="viewRadiograph(radiograph)">
              <img
                :src="getRadiographImageUrl(radiograph)"
                :alt="radiograph.originalFilename"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <!-- Delete button -->
              <button
                @click.stop="confirmDeleteRadiograph(radiograph)"
                class="absolute top-2 left-2 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Eliminar radiografía"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
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
                
                <!-- Mini disclaimer -->
                <p class="text-xs text-amber-600 italic">⚠️ Segunda opinión IA - No es diagnóstico definitivo</p>
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

              <!-- Pending state -->
              <div v-else-if="radiograph.aiResult && radiograph.aiResult.status === 'PENDING'" class="flex items-center gap-2 text-yellow-600">
                <div class="animate-spin w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                <span class="text-sm">En cola de análisis...</span>
              </div>

              <!-- No AI analysis yet - show analyze button -->
              <div v-else-if="!radiograph.aiResult" class="space-y-2">
                <p class="text-sm text-surface-500">Sin análisis de IA</p>
                <button @click="retryAnalysis(radiograph.id)" class="btn-primary text-sm">
                  <SparklesIcon class="w-4 h-4" />
                  Analizar con IA
                </button>
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

        <!-- Delete Radiograph Confirmation Modal -->
        <Teleport to="body">
          <div v-if="showDeleteRadiographModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-surface-900/50" @click="showDeleteRadiographModal = false"></div>
            <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
              <div class="p-6 text-center">
                <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <TrashIcon class="w-7 h-7 text-red-600" />
                </div>
                <h3 class="text-lg font-semibold text-surface-900 mb-2">Eliminar radiografía</h3>
                <p class="text-sm text-surface-600 mb-1">
                  ¿Estás seguro de que deseas eliminar esta radiografía?
                </p>
                <p v-if="radiographToDelete" class="text-xs text-surface-400 mb-4 truncate">
                  {{ radiographToDelete.originalFilename }}
                </p>
                <p class="text-xs text-red-500 mb-6">Esta acción no se puede deshacer.</p>
                <div class="flex gap-3">
                  <button
                    type="button"
                    @click="showDeleteRadiographModal = false"
                    class="btn-secondary flex-1"
                    :disabled="isDeletingRadiograph"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    @click="deleteRadiograph"
                    :disabled="isDeletingRadiograph"
                    class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    {{ isDeletingRadiograph ? 'Eliminando...' : 'Eliminar' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Teleport>
      </div>

      <!-- Tab: Odontogram -->
      <div v-if="activeTab === 'odontogram'" class="space-y-6">
        <OdontogramComponent :patientId="patientId" />
      </div>

      <!-- Tab: Prescriptions -->
      <div v-if="activeTab === 'prescriptions'" class="space-y-6">
        <PrescriptionTab :patientId="patientId" />
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
                <span class="inline-block animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full"></span>
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
          <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden animate-scale-in">
            <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
              <h2 class="text-lg font-semibold text-surface-900">{{ selectedRadiograph.originalFilename }}</h2>
              <button @click="closeRadiographDetail" class="text-surface-400 hover:text-surface-600">
                <XMarkIcon class="w-6 h-6" />
              </button>
            </div>
            <div class="flex flex-col lg:flex-row max-h-[calc(95vh-80px)] overflow-hidden">
              <!-- Image -->
              <div class="lg:w-3/4 bg-surface-900 flex items-center justify-center p-4">
                <img
                  :src="getRadiographImageUrl(selectedRadiograph)"
                  :alt="selectedRadiograph.originalFilename"
                  class="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              </div>
              <!-- Analysis Panel -->
              <div class="lg:w-1/4 p-6 overflow-y-auto bg-surface-50">
                <h3 class="font-semibold text-surface-900 mb-4">Análisis IA</h3>
                
                <template v-if="selectedRadiograph.aiResult && selectedRadiograph.aiResult.status === 'COMPLETED'">
                  <!-- AI Disclaimer -->
                  <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <p class="text-xs text-amber-800">
                      <strong>⚠️ Aviso:</strong> Este análisis es una herramienta de apoyo generada por IA. 
                      No constituye un diagnóstico médico definitivo. Se requiere la evaluación de un profesional cualificado.
                    </p>
                  </div>
                  
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
        <div class="absolute inset-0 bg-surface-900/50" @click="closeAppointmentModal"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in">
          <!-- Header (sticky) -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 flex-shrink-0">
            <h2 class="text-lg font-semibold text-surface-900">{{ isReadOnlyAppointment ? 'Detalles de la Cita' : (isEditingAppointment ? 'Editar Cita' : 'Nueva Cita') }}</h2>
            <button @click="closeAppointmentModal" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <!-- Content (scrollable) -->
          <form @submit.prevent="saveAppointment" class="flex flex-col flex-1 min-h-0">
            <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label class="label">Tipo de cita *</label>
              <select v-model="appointmentForm.type" required class="input" :disabled="isReadOnlyAppointment">
                <option v-for="type in appointmentTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>
            
            <!-- Worker selector (dropdown with checkboxes) -->
            <div class="relative">
              <label class="label">Médicos asignados *</label>
              <div 
                class="input flex items-center justify-between"
                :class="{ 'cursor-pointer': !isReadOnlyAppointment, 'bg-surface-50': isReadOnlyAppointment }"
                @click="!isReadOnlyAppointment && (showWorkerDropdown = !showWorkerDropdown)"
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
                    :disabled="isReadOnlyAppointment"
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
              <select v-model="appointmentForm.status" class="input" :disabled="isReadOnlyAppointment">
                <option v-for="status in appointmentStatuses" :key="status.value" :value="status.value">
                  {{ status.label }}
                </option>
              </select>
            </div>
            
            <div>
              <label class="label">Título (opcional)</label>
              <input v-model="appointmentForm.title" type="text" class="input" :disabled="isReadOnlyAppointment" placeholder="Descripción breve" />
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Inicio *</label>
                <input v-model="appointmentForm.startTime" type="datetime-local" required class="input" :disabled="isReadOnlyAppointment" />
              </div>
              <div>
                <label class="label">Fin *</label>
                <input v-model="appointmentForm.endTime" type="datetime-local" required class="input" :disabled="isReadOnlyAppointment" />
              </div>
            </div>
            
            <!-- Real Time Section (Admin only, for IN_PROGRESS or COMPLETED appointments) -->
            <div 
              v-if="isEditingAppointment && isAdmin && selectedAppointment && (selectedAppointment.status === 'IN_PROGRESS' || selectedAppointment.status === 'COMPLETED') && selectedAppointment.realStartTime"
              class="p-4 rounded-lg bg-surface-50 border border-surface-200"
            >
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-medium text-surface-900 flex items-center gap-2">
                  <ClockIcon class="w-4 h-4 text-primary-500" />
                  Tiempo Real
                </h4>
                <div class="flex gap-2">
                  <button
                    v-if="!realTimeEditing"
                    type="button"
                    @click="initRealTimeForm"
                    class="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Editar
                  </button>
                  <button
                    v-if="!realTimeEditing"
                    type="button"
                    @click="showResetConfirm = true"
                    class="text-xs text-danger-600 hover:text-danger-700"
                  >
                    Resetear
                  </button>
                </div>
              </div>
              
              <!-- View mode -->
              <div v-if="!realTimeEditing" class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-surface-500">Inicio real:</span>
                  <span class="font-medium">{{ new Date(selectedAppointment.realStartTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }}</span>
                </div>
                <div v-if="selectedAppointment.realEndTime" class="flex justify-between">
                  <span class="text-surface-500">Fin real:</span>
                  <span class="font-medium">{{ new Date(selectedAppointment.realEndTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }}</span>
                </div>
                <div v-if="selectedAppointment.pausedDuration" class="flex justify-between">
                  <span class="text-surface-500">Tiempo pausado:</span>
                  <span class="font-medium">{{ selectedAppointment.pausedDuration }} min</span>
                </div>
                <div v-if="formatRealDuration(selectedAppointment)" class="flex justify-between pt-2 border-t border-surface-200">
                  <span class="text-surface-700 font-medium">Tiempo trabajado:</span>
                  <span class="font-bold text-primary-600">{{ formatRealDuration(selectedAppointment) }}</span>
                </div>
              </div>
              
              <!-- Edit mode -->
              <div v-else class="space-y-3">
                <div>
                  <label class="label text-xs">Inicio real</label>
                  <input 
                    v-model="realTimeForm.realStartTime" 
                    type="datetime-local" 
                    class="input text-sm"
                  />
                </div>
                <div>
                  <label class="label text-xs">Fin real</label>
                  <input 
                    v-model="realTimeForm.realEndTime" 
                    type="datetime-local" 
                    class="input text-sm"
                  />
                </div>
                <div>
                  <label class="label text-xs">Tiempo pausado (minutos)</label>
                  <input 
                    v-model.number="realTimeForm.pausedDuration" 
                    type="number" 
                    min="0"
                    class="input text-sm"
                  />
                </div>
                <div class="flex gap-2 pt-2">
                  <button
                    type="button"
                    @click="realTimeEditing = false"
                    class="btn-secondary btn-sm flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    @click="handleUpdateRealTime"
                    class="btn-primary btn-sm flex-1"
                  >
                    Guardar
                  </button>
                </div>
              </div>
              
              <!-- Reset Confirmation -->
              <div v-if="showResetConfirm" class="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <p class="text-sm text-red-700 mb-2">
                  ¿Resetear tiempos? La cita volverá a estado SCHEDULED.
                </p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    @click="showResetConfirm = false"
                    class="btn-secondary btn-sm flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    @click="handleResetRealTime"
                    :disabled="isResettingTime"
                    class="bg-danger-500 hover:bg-danger-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1"
                  >
                    {{ isResettingTime ? 'Reseteando...' : 'Sí, resetear' }}
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <label class="label">Notas</label>
              <textarea v-model="appointmentForm.notes" rows="2" class="input" :disabled="isReadOnlyAppointment" placeholder="Notas adicionales..."></textarea>
            </div>
            
            <!-- Stock Usage Section (only when editing) -->
            <div v-if="isEditingAppointment" class="border-t border-surface-200 pt-4">
              <div class="flex items-center justify-between mb-3">
                <label class="label flex items-center gap-2 mb-0">
                  <CubeIcon class="w-4 h-4" />
                  Stock Utilizado
                </label>
              </div>

              <!-- Quick Pack Selector (hide in read-only) -->
              <div v-if="stockPacks.length > 0 && !isReadOnlyAppointment" class="mb-3">
                <select 
                  class="input text-sm" 
                  @change="(e: Event) => { const target = e.target as HTMLSelectElement; if (target.value) { applyPackToAppointment(target.value); target.value = ''; } }"
                >
                  <option value="">+ Aplicar pack rápido...</option>
                  <option v-for="pack in stockPacks" :key="pack.id" :value="pack.id">
                    {{ pack.name }} ({{ pack.itemCount || 0 }} items)
                  </option>
                </select>
              </div>

              <!-- Add Item Search (hide in read-only) -->
              <div v-if="!isReadOnlyAppointment" class="relative mb-3">
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <MagnifyingGlassIcon class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input 
                      v-model="stockItemSearch"
                      type="text"
                      :placeholder="selectedStockItem ? '' : 'Buscar item...'"
                      class="input pl-8 text-sm w-full"
                      :class="{ 'pr-8 bg-primary-50 border-primary-300': selectedStockItem }"
                      @focus="!selectedStockItem && (showStockItemDropdown = true)"
                      :readonly="!!selectedStockItem"
                    />
                    <!-- Clear selection button -->
                    <button
                      v-if="selectedStockItem"
                      type="button"
                      @click="clearSelectedStockItem"
                      class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                    >
                      <XMarkIcon class="w-4 h-4" />
                    </button>
                  </div>
                  <input 
                    v-model.number="stockQuantity" 
                    type="number" 
                    min="1" 
                    class="input w-16 text-sm text-center"
                    placeholder="Qty"
                  />
                  <!-- Add button (only visible when item is selected) -->
                  <button
                    v-if="selectedStockItem"
                    type="button"
                    @click="addSelectedStockToAppointment"
                    class="btn-primary btn-sm px-3"
                    title="Añadir stock"
                  >
                    <PlusIcon class="w-4 h-4" />
                  </button>
                </div>
                
                <!-- Backdrop -->
                <div 
                  v-if="showStockItemDropdown" 
                  class="fixed inset-0 z-40" 
                  @click="showStockItemDropdown = false"
                ></div>
                
                <!-- Dropdown (opens upwards to avoid being cut off) -->
                <div 
                  v-if="showStockItemDropdown && filteredStockItems.length > 0 && !selectedStockItem" 
                  class="absolute z-50 bottom-full mb-1 w-full bg-white border border-surface-200 rounded-lg shadow-lg max-h-48 overflow-auto"
                  @click.stop
                >
                  <button
                    v-for="item in filteredStockItems"
                    :key="item.id"
                    type="button"
                    class="w-full px-3 py-2 text-left text-sm hover:bg-surface-50 flex items-center gap-3"
                    @click="selectStockItem(item)"
                  >
                    <div class="w-8 h-8 rounded bg-surface-100 overflow-hidden flex-shrink-0">
                      <img 
                        v-if="item.imageUrl" 
                        :src="stockImageUrl(item.id)"
                        class="w-full h-full object-cover"
                      />
                      <div v-else class="w-full h-full flex items-center justify-center text-surface-400">
                        <CubeIcon class="w-4 h-4" />
                      </div>
                    </div>
                    <span class="flex-1 truncate">{{ item.name }}</span>
                    <span class="text-xs text-surface-400 flex-shrink-0">{{ item.currentStock }} {{ item.unit }}</span>
                  </button>
                </div>
              </div>

              <!-- Used Items List -->
              <div v-if="isLoadingStock" class="text-center py-2">
                <div class="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
              <div v-else-if="visibleStockItems.length > 0" class="space-y-1 max-h-64 overflow-y-auto">
                <div 
                  v-for="usage in visibleStockItems" 
                  :key="usage.id"
                  class="flex items-center gap-2 py-1.5 px-2 rounded text-sm"
                  :class="usage.isPending ? 'bg-primary-50 border border-dashed border-primary-300' : 'bg-surface-50'"
                >
                  <div 
                    class="w-8 h-8 rounded bg-surface-200 overflow-hidden flex-shrink-0"
                    :class="{ 'cursor-pointer hover:ring-2 hover:ring-primary-300': usage.item.imageUrl }"
                    @click="usage.item.imageUrl ? stockImageLightbox = stockImageUrl(usage.item.id) : null"
                  >
                    <img 
                      v-if="usage.item.imageUrl" 
                      :src="stockImageUrl(usage.item.id)"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-surface-400">
                      <CubeIcon class="w-4 h-4" />
                    </div>
                  </div>
                  <span class="flex-1 truncate">
                    {{ usage.item.name }}
                    <span v-if="usage.isPending" class="text-xs text-primary-600 ml-1">(pendiente)</span>
                  </span>
                  <span class="text-surface-500 mr-2 flex-shrink-0">{{ usage.quantity }} {{ usage.item.unit }}</span>
                  <button 
                    v-if="!isReadOnlyAppointment"
                    type="button"
                    @click="removeStockFromAppointment(usage.id)"
                    class="text-red-500 hover:bg-red-50 p-1 rounded flex-shrink-0"
                    title="Quitar"
                  >
                    <XMarkIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p v-else class="text-xs text-surface-400 text-center py-2">
                No hay stock registrado para esta cita
              </p>
              
              <!-- Stock save error -->
              <p v-if="stockSaveError" class="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                {{ stockSaveError }}
              </p>
              
              <!-- Pending changes indicator -->
              <p v-if="hasPendingStockChanges" class="text-xs text-primary-600 mt-2">
                ⚠️ Hay cambios de stock pendientes. Guarda para confirmarlos.
              </p>
            </div>
            
            </div>
            <!-- Footer (sticky) -->
            <div class="flex gap-3 px-6 py-4 border-t border-surface-100 flex-shrink-0 bg-white rounded-b-2xl">
              <button type="button" @click="closeAppointmentModal" class="btn-secondary flex-1">
                {{ isReadOnlyAppointment ? 'Cerrar' : 'Cancelar' }}
              </button>
              <button 
                v-if="!isReadOnlyAppointment" 
                type="submit" 
                :disabled="isSavingAppointment || isSavingStock" 
                class="btn-primary flex-1"
              >
                {{ isSavingAppointment || isSavingStock ? 'Guardando...' : (isEditingAppointment ? 'Guardar Cambios' : 'Crear Cita') }}
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
              
              <!-- Marketing Preferences -->
              <div class="md:col-span-2 pt-4 border-t border-surface-200">
                <div class="flex items-center justify-between">
                  <div>
                    <label class="label mb-0">📧 Acepta emails de marketing</label>
                    <p class="text-xs text-surface-400">Incluye emails de cumpleaños, promociones y newsletters</p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      v-model="patientForm.acceptsMarketing" 
                      class="sr-only peer"
                    />
                    <div class="w-11 h-6 bg-surface-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
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
    
    <!-- Stock Image Lightbox -->
    <Teleport to="body">
      <div 
        v-if="stockImageLightbox" 
        class="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
        @click="stockImageLightbox = null"
      >
        <div class="relative max-w-2xl max-h-[80vh]">
          <img :src="stockImageLightbox" class="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
          <button 
            @click="stockImageLightbox = null" 
            class="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-surface-100"
          >
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
    </Teleport>
    
    <!-- Rating Confirmation Modal -->
    <Teleport to="body">
      <div 
        v-if="showRatingConfirmModal" 
        class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
        @click.self="closeRatingConfirmModal"
      >
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div class="text-center">
            <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <StarIcon class="w-6 h-6 text-amber-500" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">Enviar solicitud de valoración</h3>
            <p class="text-surface-600 mb-6">
              Se enviará un email al paciente solicitando que valore su experiencia en la clínica.
            </p>
            <div class="flex gap-3">
              <button 
                @click="closeRatingConfirmModal" 
                class="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button 
                @click="confirmSendRatingRequest" 
                class="btn-primary flex-1"
              >
                Enviar Email
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Cancel Appointment Confirmation Modal -->
    <Teleport to="body">
      <div 
        v-if="showCancelConfirmModal" 
        class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
        @click.self="closeCancelConfirmModal"
      >
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div class="text-center">
            <div class="w-12 h-12 bg-danger-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <XMarkIcon class="w-6 h-6 text-danger-500" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">Cancelar cita</h3>
            <p class="text-surface-600 mb-1">
              ¿Estás seguro de que quieres cancelar esta cita?
            </p>
            <p v-if="pendingCancelAppointment" class="text-sm text-surface-500 mb-6">
              {{ pendingCancelAppointment.title || pendingCancelAppointment.type }} — 
              {{ new Date(pendingCancelAppointment.startTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }}
              a las {{ new Date(pendingCancelAppointment.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }}
            </p>
            <div class="flex gap-3">
              <button 
                @click="closeCancelConfirmModal" 
                class="btn-secondary flex-1"
              >
                Volver
              </button>
              <button 
                @click="confirmCancelAppointment" 
                class="btn-danger flex-1"
              >
                Cancelar cita
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- No Stock Confirmation Modal -->
    <Teleport to="body">
      <div 
        v-if="showNoStockConfirmModal" 
        class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
        @click.self="showNoStockConfirmModal = false"
      >
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div class="text-center">
            <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CubeIcon class="w-6 h-6 text-amber-500" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">Finalizar sin stock</h3>
            <p class="text-surface-600 mb-6">
              No hay stock registrado para esta cita. ¿Estás seguro de que quieres finalizar sin asignar ningún material?
            </p>
            <div class="flex gap-3">
              <button 
                @click="showNoStockConfirmModal = false" 
                class="btn-secondary flex-1"
              >
                Añadir Stock
              </button>
              <button 
                @click="confirmCompleteWithoutStock" 
                class="btn-primary !bg-amber-600 hover:!bg-amber-700 flex-1"
              >
                Finalizar Igualmente
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- Complete Appointment Confirmation Modal -->
    <Teleport to="body">
      <div 
        v-if="showCompleteConfirmModal" 
        class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
        @click.self="showCompleteConfirmModal = false"
      >
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div class="text-center">
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon class="w-6 h-6 text-green-600" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">Finalizar cita</h3>
            <p class="text-surface-600 mb-6">
              ¿Estás seguro de que quieres finalizar esta cita? Se guardará el stock utilizado y se cerrará la sesión.
            </p>
            <div class="flex gap-3">
              <button 
                @click="showCompleteConfirmModal = false" 
                class="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button 
                @click="confirmCompleteAppointment" 
                class="btn-primary !bg-green-600 hover:!bg-green-700 flex-1"
              >
                Finalizar Cita
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- Sign Record Confirmation Modal -->
    <Teleport to="body">
      <div 
        v-if="showSignConfirmModal" 
        class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
        @click.self="showSignConfirmModal = false; recordToSign = null"
      >
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div class="text-center">
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckBadgeIcon class="w-6 h-6 text-green-600" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">Firmar registro clínico</h3>
            <p class="text-surface-600 mb-6">
              Una vez firmado, el registro quedará <strong>bloqueado permanentemente</strong> y no podrá ser editado ni eliminado.
            </p>
            <div class="flex gap-3">
              <button 
                @click="showSignConfirmModal = false; recordToSign = null" 
                class="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button 
                @click="confirmSignRecord" 
                class="btn-primary !bg-green-600 hover:!bg-green-700 flex-1"
              >
                Firmar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- Cancel Active Appointment Confirmation Modal -->
    <Teleport to="body">
      <div 
        v-if="showCancelActiveModal" 
        class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
        @click.self="showCancelActiveModal = false; cancelConfirmText = ''"
      >
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div class="text-center">
            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XMarkIcon class="w-6 h-6 text-red-500" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">Cancelar cita en curso</h3>
            <p class="text-surface-600 mb-4">
              ¿Estás seguro de que quieres cancelar esta cita? Se borrará el tiempo registrado y la cita quedará como cancelada.
            </p>
            
            <!-- Confirmation input -->
            <div class="mb-6">
              <label class="text-sm text-surface-500 mb-2 block">
                Escribe <span class="font-bold text-red-600">cancelar</span> para confirmar
              </label>
              <input 
                v-model="cancelConfirmText"
                type="text"
                class="input w-full text-center"
                placeholder="cancelar"
                autocomplete="off"
              />
            </div>
            
            <div class="flex gap-3">
              <button 
                @click="showCancelActiveModal = false; cancelConfirmText = ''" 
                class="btn-secondary flex-1"
              >
                Volver
              </button>
              <button 
                @click="confirmCancelActiveAppointment" 
                class="btn-primary !bg-red-600 hover:!bg-red-700 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="cancelConfirmText.toLowerCase() !== 'cancelar'"
              >
                Cancelar Cita
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- Rating Success Toast -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-300"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-2 opacity-0"
      >
        <div 
          v-if="ratingSuccess" 
          class="fixed bottom-4 right-4 z-[110] bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
        >
          <CheckCircleIcon class="w-5 h-5" />
          <span>{{ ratingSuccess }}</span>
        </div>
      </Transition>
    </Teleport>
    
    <!-- Rating Error Toast -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-300"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-2 opacity-0"
      >
        <div 
          v-if="ratingError" 
          class="fixed bottom-4 right-4 z-[110] bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
        >
          <ExclamationCircleIcon class="w-5 h-5" />
          <span>{{ ratingError }}</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
