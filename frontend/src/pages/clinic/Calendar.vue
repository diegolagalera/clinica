<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useActiveAppointmentsStore } from '@/stores/activeAppointments'
import { api } from '@/services/api'
import { useToast } from '@/composables/useToast'
import type { Appointment, Patient, User, ApiResponse } from '@/types'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  XMarkIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  CalendarIcon,
  CalendarDaysIcon,
  Squares2X2Icon,
} from '@heroicons/vue/24/outline'
import { PlayIcon } from '@heroicons/vue/24/solid'

const authStore = useAuthStore()
const activeAppointmentsStore = useActiveAppointmentsStore()
const toast = useToast()

// State
const appointments = ref<Appointment[]>([])
const isLoading = ref(true)
const error = ref('')

// Calendar state
const currentDate = ref(new Date())
const calendarRef = ref<HTMLElement | null>(null)
const viewMode = ref<'day' | 'week' | 'month'>('week')

// Current time indicator
const now = ref(new Date())
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null

// Workers state
const workers = ref<User[]>([])
const selectedWorkerIds = ref<Set<string>>(new Set())
const showWorkerPanel = ref(true)

// Hash-based worker color generation (unique per worker ID)
const hashStringToHue = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash) % 360
}

const getWorkerHsl = (workerId: string, saturation = 65, lightness = 50) => {
  const hue = hashStringToHue(workerId)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

// Modal state
const showModal = ref(false)
const selectedAppointment = ref<Appointment | null>(null)
const isEditing = ref(false)
const formData = ref({
  patientId: '',
  workerIds: [] as string[],  // Multi-worker support
  type: 'VISIT',
  title: '',
  startTime: '',
  endTime: '',
  notes: '',
  status: 'SCHEDULED',
})
const isSaving = ref(false)
const formError = ref('')
const patientSearch = ref('')
const searchResults = ref<Patient[]>([])
const isSearching = ref(false)
const showWorkerDropdown = ref(false)

// WhatsApp notification modal state
const showWaModal = ref(false)
const waModalAppointmentId = ref('')
const waModalEventType = ref<'CREATED' | 'MODIFIED' | 'CANCELLED'>('CREATED')
const waModalPatientName = ref('')
const waModalTemplateName = ref('')
const waModalTemplates = ref<Array<{ name: string; status: string; language: string }>>([]) 
const waModalDefaultTemplate = ref('')
const waModalSending = ref(false)
const waModalSent = ref(false)
const waNotifyEnabled = ref(false)

// Real time management (Admin only)
const realTimeEditing = ref(false)
const isResettingTime = ref(false)
const realTimeForm = ref({
  realStartTime: '',
  realEndTime: '',
  pausedDuration: 0,
})
const showResetConfirm = ref(false)

// Format real duration for display (realEnd - realStart - pausedDuration)
const formatRealDuration = (apt: Appointment) => {
  if (!apt.realStartTime || !apt.realEndTime) return null
  const start = new Date(apt.realStartTime).getTime()
  const end = new Date(apt.realEndTime).getTime()
  const pausedMs = (apt.pausedDuration || 0) * 60000
  const durationMs = end - start - pausedMs
  const minutes = Math.floor(durationMs / 60000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return remainingMins > 0 ? `${hours}h ${remainingMins}min` : `${hours}h`
}

// Update real time (Admin only)
const handleUpdateRealTime = async () => {
  if (!selectedAppointment.value) return
  
  try {
    isSaving.value = true
    await api.put(`/appointments/${selectedAppointment.value.id}/real-time`, {
      realStartTime: realTimeForm.value.realStartTime || undefined,
      realEndTime: realTimeForm.value.realEndTime || undefined,
      pausedDuration: realTimeForm.value.pausedDuration,
    })
    realTimeEditing.value = false
    await loadAppointments()
    showModal.value = false
    resetForm()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error al actualizar tiempo real'
  } finally {
    isSaving.value = false
  }
}

// Reset real time (Admin only)
const handleResetRealTime = async () => {
  if (!selectedAppointment.value) return
  
  try {
    isResettingTime.value = true
    await api.post(`/appointments/${selectedAppointment.value.id}/reset-time`)
    showResetConfirm.value = false
    await loadAppointments()
    showModal.value = false
    resetForm()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error al resetear tiempo'
  } finally {
    isResettingTime.value = false
  }
}

// Initialize real time form when editing
const initRealTimeForm = () => {
  if (!selectedAppointment.value) return
  const apt = selectedAppointment.value
  realTimeForm.value = {
    realStartTime: apt.realStartTime ? toLocalDateTimeString(new Date(apt.realStartTime)) : '',
    realEndTime: apt.realEndTime ? toLocalDateTimeString(new Date(apt.realEndTime)) : '',
    pausedDuration: apt.pausedDuration || 0,
  }
  realTimeEditing.value = true
}

// Drag & Drop state
const isDragging = ref(false)
const isResizing = ref(false)
const hasMoved = ref(false)
const draggedAppointment = ref<Appointment | null>(null)
const dragStartY = ref(0)
const dragStartX = ref(0)
const originalStart = ref<Date | null>(null)
const originalEnd = ref<Date | null>(null)
const originalDayIndex = ref(0)
const previewTop = ref(0)
const previewHeight = ref(0)
const previewDayIndex = ref(0)

// Constants
const HOUR_HEIGHT = 64
const SNAP_MINUTES = 15
const DRAG_THRESHOLD = 5
const START_HOUR = 8
const END_HOUR = 22
const MIN_HOUR = 8  // Minimum allowed hour for appointments
const MAX_HOUR = 22 // Maximum allowed hour for appointments

// Get worker color styles (inline styles for dynamic HSL)
const getWorkerColorStyle = (workerId: string) => ({
  backgroundColor: getWorkerHsl(workerId),
})

// Check if current user is admin
const isAdmin = computed(() => {
  const role = authStore.user?.role
  return role === 'ADMIN' || role === 'SUPERADMIN'
})

// Check if current user is assigned to the selected appointment
const isCurrentUserAssignedToAppointment = computed(() => {
  if (!selectedAppointment.value || !authStore.user?.id) return false
  
  const apt = selectedAppointment.value
  
  // Check appointmentWorkers array (multi-worker system)
  if (apt.appointmentWorkers && apt.appointmentWorkers.length > 0) {
    return apt.appointmentWorkers.some(aw => aw.userId === authStore.user?.id)
  }
  
  // Fallback to legacy workerId
  return apt.workerId === authStore.user?.id
})

// Check if modal should be read-only (worker viewing appointment they're not assigned to)
const isReadOnlyModal = computed(() => {
  // Not editing? Never read-only (it's a new appointment)
  if (!isEditing.value) return false
  // Admins can always edit
  if (isAdmin.value) return false
  // Workers can only edit if assigned
  return !isCurrentUserAssignedToAppointment.value
})

// Check if appointment can be edited (dragged/resized) in calendar
const canEditAppointment = (apt: Appointment) => {
  // Nobody can drag/resize completed or cancelled appointments in calendar
  // (Admins can still edit them from patient's appointment list)
  if (apt.status === 'CANCELLED' || apt.status === 'COMPLETED') return false
  // Admins can always edit all appointments
  if (isAdmin.value) return true
  // Workers can only edit appointments they are assigned to
  const userId = authStore.user?.id
  if (!userId) return false
  // Check if current user is assigned to this appointment
  if (apt.appointmentWorkers && apt.appointmentWorkers.length > 0) {
    return apt.appointmentWorkers.some(aw => aw.userId === userId)
  }
  // Fallback to legacy workerId
  return apt.workerId === userId
}

// Helper: get YYYY-MM-DD string in LOCAL timezone (avoids UTC off-by-one after midnight)
const toLocalDateKey = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Computed - Days visible based on view mode
const weekDays = computed(() => {
  const days = []
  const start = new Date(currentDate.value)
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  // We want Monday as the first day of the week
  const dayOfWeek = start.getDay()
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  start.setDate(start.getDate() - daysToSubtract)
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(day)
  }
  return days
})

// Days to display based on view mode
const visibleDays = computed(() => {
  if (viewMode.value === 'day') {
    return [new Date(currentDate.value)]
  } else if (viewMode.value === 'week') {
    return weekDays.value
  } else {
    // Month view - return all days of the month grid (including padding from prev/next months)
    const days: Date[] = []
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth()
    
    // First day of the month
    const firstDay = new Date(year, month, 1)
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0)
    
    // Start from Monday of the week containing the first day
    const start = new Date(firstDay)
    const dayOfWeek = start.getDay()
    start.setDate(start.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    
    // End on Sunday of the week containing the last day
    const end = new Date(lastDay)
    const endDayOfWeek = end.getDay()
    end.setDate(end.getDate() + (endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek))
    
    // Generate all days in the range
    const current = new Date(start)
    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    
    return days
  }
})

// Month calendar weeks (for month grid layout)
const monthWeeks = computed(() => {
  if (viewMode.value !== 'month') return []
  const weeks: Date[][] = []
  const days = visibleDays.value
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
})


const hours = computed(() => {
  const h = []
  for (let i = START_HOUR; i <= END_HOUR; i++) {
    h.push(i)
  }
  return h
})

// Date range for API queries
// Note: API treats end date as exclusive, so we add 1 day to include the last visible day
const dateRange = computed(() => {
  const days = visibleDays.value
  if (days.length === 0) {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return { start: toLocalDateKey(today), end: toLocalDateKey(tomorrow) }
  }
  const start = days[0]!
  const end = new Date(days[days.length - 1]!)
  // Add 1 day to end to include it in the query (API uses exclusive end)
  end.setDate(end.getDate() + 1)
  return {
    start: toLocalDateKey(start),
    end: toLocalDateKey(end),
  }
})

// Formatted date display based on view mode  
const formattedDateRange = computed(() => {
  if (viewMode.value === 'day') {
    return currentDate.value.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
  } else if (viewMode.value === 'week') {
    const start = weekDays.value[0]!
    const end = weekDays.value[6]!
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)}, ${end.getFullYear()}`
  } else {
    return currentDate.value.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }
})

// Filter appointments by selected workers (now supports multi-worker appointments)
const filteredAppointments = computed(() => {
  // If no workers loaded yet or none selected, show all appointments
  if (workers.value.length === 0 || selectedWorkerIds.value.size === 0) {
    return appointments.value
  }
  return appointments.value.filter(apt => {
    // Check appointmentWorkers array first (new multi-worker system)
    if (apt.appointmentWorkers && apt.appointmentWorkers.length > 0) {
      return apt.appointmentWorkers.some(aw => selectedWorkerIds.value.has(aw.userId))
    }
    // Fallback to legacy workerId
    return apt.workerId && selectedWorkerIds.value.has(apt.workerId)
  })
})

// Validate appointment time is within allowed hours (8:00 - 22:00)
const timeValidation = computed(() => {
  const errors: string[] = []
  
  if (formData.value.startTime) {
    const startDate = new Date(formData.value.startTime)
    const startHour = startDate.getHours()
    
    if (startHour < MIN_HOUR) {
      errors.push(`La hora de inicio no puede ser antes de las ${MIN_HOUR}:00`)
    }
    if (startHour >= MAX_HOUR) {
      errors.push(`La hora de inicio no puede ser después de las ${MAX_HOUR - 1}:59`)
    }
  }
  
  if (formData.value.endTime) {
    const endDate = new Date(formData.value.endTime)
    const endHour = endDate.getHours()
    const endMinutes = endDate.getMinutes()
    
    if (endHour < MIN_HOUR) {
      errors.push(`La hora de fin no puede ser antes de las ${MIN_HOUR}:00`)
    }
    if (endHour > MAX_HOUR || (endHour === MAX_HOUR && endMinutes > 0)) {
      errors.push(`La hora de fin no puede ser después de las ${MAX_HOUR}:00`)
    }
  }
  
  if (formData.value.startTime && formData.value.endTime) {
    const startDate = new Date(formData.value.startTime)
    const endDate = new Date(formData.value.endTime)
    if (endDate <= startDate) {
      errors.push('La hora de fin debe ser posterior a la hora de inicio')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
})

// Check if form can be submitted
const canSubmitForm = computed(() => {
  return formData.value.patientId && 
         formData.value.workerIds.length > 0 && 
         timeValidation.value.isValid &&
         !isSaving.value
})

// Group appointments by day with overlap detection
const appointmentsByDay = computed(() => {
  const map = new Map<string, Array<Appointment & { column: number; totalColumns: number }>>()
  
  visibleDays.value.forEach(day => {
    const key = toLocalDateKey(day)
    const dayApts = filteredAppointments.value
      .filter(apt => toLocalDateKey(new Date(apt.startTime)) === key)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    
    // Calculate overlap columns
    const withLayout = calculateOverlapLayout(dayApts)
    map.set(key, withLayout)
  })
  
  return map
})

// Calculate overlapping appointment layout
const calculateOverlapLayout = (apts: Appointment[]) => {
  if (apts.length === 0) return []
  
  const result: Array<Appointment & { column: number; totalColumns: number }> = []
  const columns: Array<{ end: number; items: typeof result }> = []
  
  for (const apt of apts) {
    const start = new Date(apt.startTime).getTime()
    const end = new Date(apt.endTime).getTime()
    
    // Find a column where this appointment can fit
    let columnIndex = -1
    for (let i = 0; i < columns.length; i++) {
      if (columns[i]!.end <= start) {
        columnIndex = i
        break
      }
    }
    
    if (columnIndex === -1) {
      // Need a new column
      columnIndex = columns.length
      columns.push({ end: 0, items: [] })
    }
    
    columns[columnIndex]!.end = end
    const aptWithLayout = { ...apt, column: columnIndex, totalColumns: 1 }
    columns[columnIndex]!.items.push(aptWithLayout)
    result.push(aptWithLayout)
  }
  
  // Update totalColumns for all overlapping appointments
  for (const apt of result) {
    const start = new Date(apt.startTime).getTime()
    const end = new Date(apt.endTime).getTime()
    
    // Count how many columns are active during this appointment's time
    let maxCols = 1
    for (const other of result) {
      if (other.id === apt.id) continue
      const otherStart = new Date(other.startTime).getTime()
      const otherEnd = new Date(other.endTime).getTime()
      
      // Check if they overlap
      if (start < otherEnd && end > otherStart) {
        maxCols = Math.max(maxCols, other.column + 1, apt.column + 1)
      }
    }
    apt.totalColumns = maxCols
  }
  
  // Second pass to ensure all overlapping events have same totalColumns
  for (const apt of result) {
    const start = new Date(apt.startTime).getTime()
    const end = new Date(apt.endTime).getTime()
    
    for (const other of result) {
      const otherStart = new Date(other.startTime).getTime()
      const otherEnd = new Date(other.endTime).getTime()
      
      if (start < otherEnd && end > otherStart) {
        const maxCols = Math.max(apt.totalColumns, other.totalColumns)
        apt.totalColumns = maxCols
        other.totalColumns = maxCols
      }
    }
  }
  
  return result
}

// Load appointments
const loadAppointments = async (silent = false) => {
  if (!silent) {
    isLoading.value = true
  }
  error.value = ''
  
  try {
    const response = await api.get<ApiResponse<Appointment[]>>('/appointments', {
      params: {
        start: dateRange.value.start,
        end: dateRange.value.end,
      },
    })
    
    if (response.success && response.data) {
      appointments.value = response.data
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error loading appointments'
  } finally {
    if (!silent) {
      isLoading.value = false
    }
  }
}

// Load workers for the clinic
const loadWorkers = async () => {
  try {
    // /staff returns the array directly in response.data (not response.data.data)
    const response = await api.get<ApiResponse<User[]>>('/staff')
    if (response.success && response.data && Array.isArray(response.data)) {
      workers.value = response.data
      
      // By default, select current user only if they're in the workers list
      if (authStore.user?.id) {
        const currentUserInList = workers.value.some(w => w.id === authStore.user?.id)
        if (currentUserInList) {
          selectedWorkerIds.value = new Set([authStore.user.id])
        } else {
          // Current user not in workers list, select all
          selectedWorkerIds.value = new Set(workers.value.map(w => w.id))
        }
      } else {
        // No current user, select all workers
        selectedWorkerIds.value = new Set(workers.value.map(w => w.id))
      }
    }
  } catch (err) {
    // If staff endpoint fails, workers stays empty and we show all appointments
    console.warn('Could not load workers list', err)
  }
}

// Toggle worker selection
const toggleWorker = (workerId: string) => {
  const newSet = new Set(selectedWorkerIds.value)
  if (newSet.has(workerId)) {
    newSet.delete(workerId)
  } else {
    newSet.add(workerId)
  }
  selectedWorkerIds.value = newSet
}

// Select all workers
const selectAllWorkers = () => {
  selectedWorkerIds.value = new Set(workers.value.map(w => w.id))
}

// Select only me
const selectOnlyMe = () => {
  if (authStore.user?.id) {
    selectedWorkerIds.value = new Set([authStore.user.id])
  }
}

// Search patients (only active ones)
const searchPatients = async () => {
  if (patientSearch.value.length < 2) {
    searchResults.value = []
    return
  }
  
  isSearching.value = true
  try {
    const response = await api.get<ApiResponse<{ data: Patient[] }>>('/patients', {
      params: { search: patientSearch.value, limit: 5, isActive: 'true' },
    })
    if (response.success && response.data) {
      searchResults.value = response.data.data
    }
  } catch {
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

// Select patient from search
const selectPatient = (patient: Patient) => {
  formData.value.patientId = patient.id
  patientSearch.value = `${patient.firstName} ${patient.lastName}`
  searchResults.value = []
}

// Save appointment (create or update)
const saveAppointment = async () => {
  formError.value = ''
  isSaving.value = true
  
  try {
    let savedAppointmentId = ''
    let eventType: 'CREATED' | 'MODIFIED' | 'CANCELLED' = 'CREATED'
    
    if (isEditing.value && selectedAppointment.value) {
      await api.put(`/appointments/${selectedAppointment.value.id}`, {
        type: formData.value.type,
        title: formData.value.title || undefined,
        startTime: new Date(formData.value.startTime).toISOString(),
        endTime: new Date(formData.value.endTime).toISOString(),
        notes: formData.value.notes || undefined,
        status: formData.value.status,
        workerIds: formData.value.workerIds.length > 0 ? formData.value.workerIds : undefined,
      })
      savedAppointmentId = selectedAppointment.value.id
      eventType = formData.value.status === 'CANCELLED' ? 'CANCELLED' : 'MODIFIED'
      toast.success('Cita actualizada')
    } else {
      const payload = {
        ...formData.value,
        startTime: new Date(formData.value.startTime).toISOString(),
        endTime: new Date(formData.value.endTime).toISOString(),
      }
      const resp = await api.post<ApiResponse<Appointment>>('/appointments', payload)
      savedAppointmentId = resp?.data?.id || ''
      eventType = 'CREATED'
      toast.success('Cita creada')
    }
    
    // Capture patient name before resetting
    const pName = patientSearch.value
    
    showModal.value = false
    resetForm()
    await loadAppointments(true) // Silent reload to avoid scroll jump
    
    // Show WhatsApp notification modal if configured
    if (savedAppointmentId) {
      showWaNotificationModal(savedAppointmentId, eventType, pName)
    }
  } catch {
    // Error toast is shown automatically by API interceptor
  } finally {
    isSaving.value = false
  }
}

// Show WA notification modal
const showWaNotificationModal = async (appointmentId: string, eventType: 'CREATED' | 'MODIFIED' | 'CANCELLED', patientName: string) => {
  try {
    // Check if WA notifications are enabled
    const settingsResp = await api.get<ApiResponse<any>>('/chatbot/settings/wa-notifications')
    const settings = settingsResp?.data
    
    if (!settings?.waNotifyEnabled) return // WA notifications not enabled
    
    waNotifyEnabled.value = true
    waModalAppointmentId.value = appointmentId
    waModalEventType.value = eventType
    waModalPatientName.value = patientName
    waModalSent.value = false
    waModalSending.value = false

    // Resolve default template for this event
    const templateMap: Record<string, string> = {
      CREATED: settings.waTemplateCreated || '',
      MODIFIED: settings.waTemplateModified || '',
      CANCELLED: settings.waTemplateCancelled || '',
    }
    waModalDefaultTemplate.value = templateMap[eventType] || ''
    waModalTemplateName.value = waModalDefaultTemplate.value
    
    // Load available templates from Meta
    try {
      const templatesResp = await api.get<ApiResponse<any[]>>('/chatbot/templates')
      waModalTemplates.value = (templatesResp?.data || []).filter((t: any) => t.status === 'APPROVED')
    } catch {
      waModalTemplates.value = []
    }
    
    showWaModal.value = true
  } catch {
    // If settings fetch fails, don't show modal
  }
}

// Send WA notification
const sendWaNotification = async () => {
  if (!waModalAppointmentId.value || !waModalTemplateName.value) return
  
  waModalSending.value = true
  try {
    await api.post(`/appointments/${waModalAppointmentId.value}/wa-notify`, {
      eventType: waModalEventType.value,
      templateName: waModalTemplateName.value,
    })
    waModalSent.value = true
    toast.success('Notificación WhatsApp enviada')
    setTimeout(() => {
      showWaModal.value = false
    }, 1500)
  } catch {
    toast.error('Error al enviar notificación WhatsApp')
  } finally {
    waModalSending.value = false
  }
}

const closeWaModal = () => {
  showWaModal.value = false
}

// Navigation - adapts to current view mode
const navigate = (direction: 1 | -1) => {
  const newDate = new Date(currentDate.value)
  
  if (viewMode.value === 'day') {
    newDate.setDate(newDate.getDate() + direction)
  } else if (viewMode.value === 'week') {
    newDate.setDate(newDate.getDate() + (7 * direction))
  } else {
    newDate.setMonth(newDate.getMonth() + direction)
  }
  
  currentDate.value = newDate
}

const prevPeriod = () => navigate(-1)
const nextPeriod = () => navigate(1)

const goToToday = () => {
  currentDate.value = new Date()
}

// Jump to specific day (used when clicking on a day in month view)
const goToDay = (day: Date) => {
  currentDate.value = new Date(day)
  viewMode.value = 'day'
}

// Format date for datetime-local input (local timezone)
const toLocalDateTimeString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Modal helpers
const openNewAppointment = (day: Date, hour: number) => {
  if (isDragging.value || isResizing.value) return
  
  isEditing.value = false
  selectedAppointment.value = null
  const start = new Date(day)
  start.setHours(hour, 0, 0, 0)
  const end = new Date(start)
  end.setHours(hour + 1)
  
  formData.value.startTime = toLocalDateTimeString(start)
  formData.value.endTime = toLocalDateTimeString(end)
  formData.value.workerIds = authStore.user?.id ? [authStore.user.id] : []
  formData.value.patientId = ''
  patientSearch.value = ''
  showModal.value = true
}

const openEditAppointment = (apt: Appointment) => {
  if (isDragging.value || isResizing.value) return
  
  isEditing.value = true
  selectedAppointment.value = apt
  
  // Get workerIds from appointmentWorkers or fallback to workerId
  const workerIds = apt.appointmentWorkers?.length 
    ? apt.appointmentWorkers.map(aw => aw.userId)
    : (apt.workerId ? [apt.workerId] : [])
  
  formData.value = {
    patientId: apt.patientId,
    workerIds: workerIds,
    type: apt.type,
    title: apt.title || '',
    startTime: toLocalDateTimeString(new Date(apt.startTime)),
    endTime: toLocalDateTimeString(new Date(apt.endTime)),
    notes: apt.notes || '',
    status: apt.status || 'SCHEDULED',
  }
  patientSearch.value = apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : ''
  showModal.value = true
}

const resetForm = () => {
  formData.value = {
    patientId: '',
    workerIds: authStore.user?.id ? [authStore.user.id] : [],
    type: 'VISIT',
    title: '',
    startTime: '',
    endTime: '',
    notes: '',
    status: 'SCHEDULED',
  }
  patientSearch.value = ''
  searchResults.value = []
  formError.value = ''
  isEditing.value = false
  selectedAppointment.value = null
  // Reset real time editing state
  realTimeEditing.value = false
  showResetConfirm.value = false
}

const closeModal = () => {
  showModal.value = false
  resetForm() // Clear form data when closing
}

// Start an appointment (transition to IN_PROGRESS)
const handleStartAppointment = async () => {
  if (!selectedAppointment.value) return
  
  try {
    await activeAppointmentsStore.startAppointment(selectedAppointment.value.id)
    showModal.value = false
    resetForm()
    await loadAppointments(true) // Silent reload to avoid scroll jump
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error al iniciar la cita'
  }
}

// Snap to 15-minute intervals
const snapToGrid = (minutes: number) => {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

// Convert minutes to Y position
const minutesToY = (minutes: number) => {
  return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
}

// Get day index from X position
const getDayIndexFromX = (x: number, containerLeft: number, dayWidth: number) => {
  const relativeX = x - containerLeft - 64
  const rawIndex = Math.floor(relativeX / dayWidth)
  return Math.max(0, Math.min(6, rawIndex))
}
// Drag handlers
const startDrag = (e: MouseEvent, apt: Appointment) => {
  e.preventDefault()
  e.stopPropagation()
  
  // Always track the appointment for potential click-to-open
  draggedAppointment.value = apt
  hasMoved.value = false
  dragStartY.value = e.clientY
  dragStartX.value = e.clientX
  
  // Only enable actual dragging if appointment is editable
  if (canEditAppointment(apt)) {
    isDragging.value = true
    
    const start = new Date(apt.startTime)
    const end = new Date(apt.endTime)
    originalStart.value = start
    originalEnd.value = end
    
    const dayKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    originalDayIndex.value = weekDays.value.findIndex(d => {
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return dk === dayKey
    })
    
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()
    
    previewTop.value = minutesToY(startMinutes)
    previewHeight.value = minutesToY(endMinutes) - minutesToY(startMinutes)
    previewDayIndex.value = originalDayIndex.value
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
}

// Track if user attempted to drag a non-editable appointment
let attemptedDragNonEditable = false

const onDrag = (e: MouseEvent) => {
  if (!draggedAppointment.value || !calendarRef.value) return
  
  e.preventDefault()
  
  const dx = e.clientX - dragStartX.value
  const dy = e.clientY - dragStartY.value
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  if (distance < DRAG_THRESHOLD) return
  
  // If trying to drag but not allowed, show toast once with specific reason
  if (!isDragging.value && !attemptedDragNonEditable) {
    attemptedDragNonEditable = true
    const apt = draggedAppointment.value
    if (apt?.status === 'COMPLETED' || apt?.status === 'CANCELLED') {
      toast.warning(`No puedes mover citas ${apt.status === 'COMPLETED' ? 'completadas' : 'canceladas'}`)
    } else if (apt?.status === 'NO_SHOW') {
      toast.warning('No puedes mover citas con estado "No asistió"')
    } else {
      toast.warning('No puedes mover esta cita porque no estás asignado como trabajador')
    }
    return
  }
  
  if (!isDragging.value) return
  
  hasMoved.value = true
  
  const container = calendarRef.value.querySelector('.grid.min-w-\\[800px\\]')
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const dayWidth = (rect.width - 64) / 7
  
  const deltaY = e.clientY - dragStartY.value
  const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60
  
  const originalStartMinutes = originalStart.value!.getHours() * 60 + originalStart.value!.getMinutes()
  const duration = (originalEnd.value!.getTime() - originalStart.value!.getTime()) / 60000
  
  let newStartMinutes = snapToGrid(originalStartMinutes + deltaMinutes)
  newStartMinutes = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - duration, newStartMinutes))
  
  previewTop.value = minutesToY(newStartMinutes)
  previewDayIndex.value = getDayIndexFromX(e.clientX, rect.left, dayWidth)
}

const endDrag = async () => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  
  // Save flag before resetting - if user tried to drag non-editable, don't open modal
  const triedToMoveNonEditable = attemptedDragNonEditable
  
  // Reset drag attempt flag for next interaction
  attemptedDragNonEditable = false
  
  const apt = draggedAppointment.value
  
  // If no appointment was tracked, nothing to do
  if (!apt) {
    isDragging.value = false
    hasMoved.value = false
    return
  }
  
  // If user tried to drag a non-editable appointment, don't open modal
  if (triedToMoveNonEditable) {
    isDragging.value = false
    hasMoved.value = false
    draggedAppointment.value = null
    originalStart.value = null
    originalEnd.value = null
    return
  }
  
  // If no movement occurred, open the modal (works for both editable and non-editable)
  if (!hasMoved.value) {
    isDragging.value = false
    hasMoved.value = false
    draggedAppointment.value = null
    originalStart.value = null
    originalEnd.value = null
    openEditAppointment(apt)
    return
  }
  
  // Only process actual drag if dragging was enabled
  if (!isDragging.value) {
    draggedAppointment.value = null
    hasMoved.value = false
    return
  }
  
  const duration = (originalEnd.value!.getTime() - originalStart.value!.getTime()) / 60000
  
  const newStartMinutes = (previewTop.value / HOUR_HEIGHT) * 60 + START_HOUR * 60
  const newDay = weekDays.value[previewDayIndex.value]!
  
  const newStart = new Date(newDay)
  newStart.setHours(Math.floor(newStartMinutes / 60), Math.round(newStartMinutes % 60), 0, 0)
  
  const newEnd = new Date(newStart)
  newEnd.setMinutes(newEnd.getMinutes() + duration)
  
  if (newStart.getTime() !== originalStart.value!.getTime()) {
    try {
      await api.put(`/appointments/${apt.id}`, {
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      })
      await loadAppointments(true) // Silent reload to avoid scroll jump
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error updating appointment'
    }
  }
  
  isDragging.value = false
  hasMoved.value = false
  draggedAppointment.value = null
  originalStart.value = null
  originalEnd.value = null
}

// Resize handlers
const startResize = (e: MouseEvent, apt: Appointment) => {
  if (!canEditAppointment(apt)) return
  e.preventDefault()
  e.stopPropagation()
  
  isResizing.value = true
  draggedAppointment.value = apt
  dragStartY.value = e.clientY
  
  const start = new Date(apt.startTime)
  const end = new Date(apt.endTime)
  originalStart.value = start
  originalEnd.value = end
  
  const dayKey = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0')
  originalDayIndex.value = weekDays.value.findIndex(d => {
    const dk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    return dk === dayKey
  })
  
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  
  previewTop.value = minutesToY(startMinutes)
  previewHeight.value = minutesToY(endMinutes) - minutesToY(startMinutes)
  previewDayIndex.value = originalDayIndex.value
  
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', endResize)
}

const onResize = (e: MouseEvent) => {
  if (!isResizing.value || !draggedAppointment.value) return
  
  const deltaY = e.clientY - dragStartY.value
  const originalEndMinutes = originalEnd.value!.getHours() * 60 + originalEnd.value!.getMinutes()
  const originalStartMinutes = originalStart.value!.getHours() * 60 + originalStart.value!.getMinutes()
  
  const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60
  let newEndMinutes = snapToGrid(originalEndMinutes + deltaMinutes)
  
  newEndMinutes = Math.max(originalStartMinutes + SNAP_MINUTES, newEndMinutes)
  newEndMinutes = Math.min(END_HOUR * 60, newEndMinutes)
  
  previewHeight.value = minutesToY(newEndMinutes) - previewTop.value
}

const endResize = async () => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', endResize)
  
  if (!isResizing.value || !draggedAppointment.value) {
    isResizing.value = false
    return
  }
  
  const apt = draggedAppointment.value
  
  const newEndMinutes = ((previewTop.value + previewHeight.value) / HOUR_HEIGHT) * 60 + START_HOUR * 60
  
  const newEnd = new Date(originalStart.value!)
  newEnd.setHours(Math.floor(newEndMinutes / 60), Math.round(newEndMinutes % 60), 0, 0)
  
  if (newEnd.getTime() !== originalEnd.value!.getTime()) {
    try {
      await api.put(`/appointments/${apt.id}`, {
        endTime: newEnd.toISOString(),
      })
      await loadAppointments(true) // Silent reload to avoid scroll jump
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error updating appointment'
    }
  }
  
  isResizing.value = false
  draggedAppointment.value = null
  originalStart.value = null
  originalEnd.value = null
}

// Utility
const getAppointmentStyle = (apt: Appointment & { column?: number; totalColumns?: number }) => {
  if ((isDragging.value || isResizing.value) && draggedAppointment.value?.id === apt.id) {
    return { display: 'none' }
  }
  
  const start = new Date(apt.startTime)
  const end = new Date(apt.endTime)
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  const top = minutesToY(startMinutes)
  const height = minutesToY(endMinutes) - top
  
  // Calculate width and left position for overlapping events
  const column = apt.column || 0
  const totalColumns = apt.totalColumns || 1
  const width = `calc((100% - 8px) / ${totalColumns})`
  const left = `calc(${column} * (100% - 8px) / ${totalColumns} + 4px)`
  
  return {
    top: `${top}px`,
    height: `${Math.max(height, 32)}px`,
    width,
    left,
  }
}

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const isToday = (date: Date) => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

// Current time indicator position
const currentTimePosition = computed(() => {
  const currentHour = now.value.getHours()
  const currentMinutes = now.value.getMinutes()
  const totalMinutes = currentHour * 60 + currentMinutes
  
  // Only show if within visible hours range
  if (currentHour < START_HOUR || currentHour >= END_HOUR) {
    return null
  }
  
  // Calculate position (same formula as minutesToY)
  const top = ((totalMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
  return top
})

// Month view helpers
const getMonthDayAppointments = (day: Date) => {
  const key = toLocalDateKey(day)
  return filteredAppointments.value.filter(apt => 
    toLocalDateKey(new Date(apt.startTime)) === key
  ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
}

const getMonthDayAppointmentCount = (day: Date) => {
  return getMonthDayAppointments(day).length
}

// Watchers
watch(currentDate, () => {
  loadAppointments()
})

watch(viewMode, () => {
  loadAppointments()
})

watch(patientSearch, () => {
  searchPatients()
})

onMounted(async () => {
  await loadWorkers()
  await loadAppointments()
  
  // Start time update interval for current time indicator
  timeUpdateInterval = setInterval(() => {
    now.value = new Date()
  }, 60000) // Update every minute
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', endResize)
  
  // Clear time update interval
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval)
    timeUpdateInterval = null
  }
})

// Appointment types
const appointmentTypes = [
  { value: 'VISIT', label: 'Visita' },
  { value: 'SURGERY', label: 'Cirugía' },
  { value: 'REVIEW', label: 'Revisión' },
  { value: 'EMERGENCY', label: 'Urgencia' },
  { value: 'FOLLOWUP', label: 'Seguimiento' },
]

// Appointment statuses
const appointmentStatuses = [
  { value: 'SCHEDULED', label: 'Programada' },
  { value: 'IN_PROGRESS', label: 'En Progreso' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'CANCELLED', label: 'Cancelada' },
  { value: 'NO_SHOW', label: 'No presentado' },
]
</script>

<template>
  <div ref="calendarRef" class="flex h-full">
    <!-- Worker Sidebar -->
    <div 
      v-if="showWorkerPanel"
      class="w-56 border-r border-surface-200 bg-surface-50 p-4 flex-shrink-0"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-surface-900">Calendarios</h3>
        <button @click="showWorkerPanel = false" class="text-surface-400 hover:text-surface-600">
          <EyeSlashIcon class="w-4 h-4" />
        </button>
      </div>
      
      <div class="space-y-2 mb-4">
        <button 
          @click="selectOnlyMe"
          class="text-sm text-primary-600 hover:text-primary-700"
        >
          Solo mis citas
        </button>
        <span class="text-surface-300 mx-2">|</span>
        <button 
          @click="selectAllWorkers"
          class="text-sm text-primary-600 hover:text-primary-700"
        >
          Ver todos
        </button>
      </div>
      
      <div class="space-y-1">
        <label 
          v-for="worker in workers" 
          :key="worker.id"
          class="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-100 cursor-pointer"
        >
          <input 
            type="checkbox" 
            :checked="selectedWorkerIds.has(worker.id)"
            @change="toggleWorker(worker.id)"
            class="sr-only"
          />
          <div 
            class="w-4 h-4 rounded border-2 flex items-center justify-center"
            :class="selectedWorkerIds.has(worker.id) ? 'border-transparent' : 'border-surface-300'"
            :style="selectedWorkerIds.has(worker.id) ? getWorkerColorStyle(worker.id) : {}"
          >
            <svg v-if="selectedWorkerIds.has(worker.id)" class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </div>
          <span 
            class="text-sm truncate"
            :class="worker.id === authStore.user?.id ? 'font-medium' : ''"
          >
            {{ worker.firstName }} {{ worker.lastName }}
            <span v-if="worker.id === authStore.user?.id" class="text-surface-400">(yo)</span>
          </span>
        </label>
      </div>
    </div>
    
    <!-- Main Calendar Area -->
    <div class="flex-1 p-6 overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-4">
          <button 
            v-if="!showWorkerPanel" 
            @click="showWorkerPanel = true"
            class="btn-secondary p-2"
            title="Mostrar calendarios"
          >
            <EyeIcon class="w-5 h-5" />
          </button>
          <div>
            <h1 class="text-2xl font-bold text-surface-900">Calendario</h1>
            <p class="text-surface-500 mt-1">Gestiona las citas de la clínica</p>
          </div>
        </div>
        <button @click="openNewAppointment(weekDays[0]!, 9)" class="btn-primary">
          <PlusIcon class="w-5 h-5" />
          Nueva Cita
        </button>
      </div>

      <!-- Error alert -->
      <div v-if="error" class="mb-4 p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
        {{ error }}
        <button @click="error = ''" class="ml-2 underline">Cerrar</button>
      </div>

      <!-- Calendar navigation -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <button @click="prevPeriod" class="btn-secondary p-2">
            <ChevronLeftIcon class="w-5 h-5" />
          </button>
          <button @click="goToToday" class="btn-secondary px-4">
            Hoy
          </button>
          <button @click="nextPeriod" class="btn-secondary p-2">
            <ChevronRightIcon class="w-5 h-5" />
          </button>
        </div>
        
        <h2 class="text-lg font-semibold text-surface-900 capitalize">{{ formattedDateRange }}</h2>
        
        <div class="flex items-center gap-4">
          <!-- View mode selector -->
          <div class="flex items-center bg-surface-100 rounded-lg p-1">
            <button 
              @click="viewMode = 'day'"
              class="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors"
              :class="viewMode === 'day' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-600 hover:text-surface-900'"
            >
              <CalendarIcon class="w-4 h-4" />
              Día
            </button>
            <button 
              @click="viewMode = 'week'"
              class="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors"
              :class="viewMode === 'week' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-600 hover:text-surface-900'"
            >
              <CalendarDaysIcon class="w-4 h-4" />
              Semana
            </button>
            <button 
              @click="viewMode = 'month'"
              class="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors"
              :class="viewMode === 'month' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-600 hover:text-surface-900'"
            >
              <Squares2X2Icon class="w-4 h-4" />
              Mes
            </button>
          </div>
          
          <div class="text-sm text-surface-500">
            {{ filteredAppointments.length }} citas visibles
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>

      <!-- Calendar grid -->
      <div v-else class="card overflow-hidden flex-1 flex flex-col">
        <!-- DAY/WEEK VIEW -->
        <template v-if="viewMode === 'day' || viewMode === 'week'">
          <!-- Day headers -->
          <div 
            class="grid border-b border-surface-200 flex-shrink-0"
            :class="viewMode === 'day' ? 'grid-cols-[auto_1fr]' : 'grid-cols-[auto_repeat(7,1fr)]'"
          >
            <div class="w-16"></div>
            <div 
              v-for="day in visibleDays" 
              :key="day.toISOString()"
              class="text-center py-3 border-l border-surface-200"
              :class="isToday(day) ? 'bg-primary-50' : ''"
            >
              <p class="text-xs text-surface-500 uppercase">
                {{ day.toLocaleDateString('es-ES', { weekday: viewMode === 'day' ? 'long' : 'short' }) }}
              </p>
              <p 
                class="text-lg font-semibold mt-1"
                :class="isToday(day) ? 'text-primary-600' : 'text-surface-900'"
              >
                {{ day.getDate() }}
              </p>
            </div>
          </div>

          <!-- Time grid -->
          <div class="relative overflow-auto flex-1">
            <div 
              class="grid"
              :class="viewMode === 'day' ? 'grid-cols-[auto_1fr]' : 'grid-cols-[auto_repeat(7,1fr)] min-w-[800px]'"
            >
              <!-- Hours column -->
              <div class="w-16">
                <div v-for="hour in hours" :key="hour" class="h-16 border-b border-surface-100">
                  <span class="text-xs text-surface-400 px-2">{{ hour }}:00</span>
                </div>
              </div>

              <!-- Day columns -->
              <div 
                v-for="(day, dayIndex) in visibleDays" 
                :key="day.toISOString()"
                class="relative border-l border-surface-200"
                :class="isToday(day) ? 'bg-primary-50/30' : ''"
              >
                <!-- Hour slots with 15-min lines -->
                <div 
                  v-for="hour in hours" 
                  :key="hour"
                  @click="openNewAppointment(day, hour)"
                  class="h-16 border-b border-surface-100 cursor-pointer hover:bg-surface-50/50 transition-colors relative"
                >
                  <!-- 15-minute gridlines -->
                  <div class="absolute w-full h-px bg-surface-100/50" style="top: 25%"></div>
                  <div class="absolute w-full h-px bg-surface-100/50" style="top: 50%"></div>
                  <div class="absolute w-full h-px bg-surface-100/50" style="top: 75%"></div>
                </div>

                <!-- Current time indicator (only on today) -->
                <div 
                  v-if="isToday(day) && currentTimePosition !== null"
                  class="absolute left-0 right-0 z-20 pointer-events-none"
                  :style="{ top: currentTimePosition + 'px' }"
                >
                  <div class="relative flex items-center">
                    <!-- Red circle marker -->
                    <div class="absolute -left-1.5 w-3 h-3 bg-red-500 rounded-full shadow-sm"></div>
                    <!-- Red line -->
                    <div class="w-full h-0.5 bg-red-500"></div>
                  </div>
                </div>

                <!-- Appointments -->
                <div 
                  v-for="apt in appointmentsByDay.get(toLocalDateKey(day))" 
                  :key="apt.id"
                  class="absolute rounded-lg px-2 py-1 text-white text-xs overflow-hidden select-none"
                  :class="canEditAppointment(apt) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer opacity-75'"
                  :style="{ ...getAppointmentStyle(apt), ...getWorkerColorStyle(apt.workerId || '') }"
                  @mousedown="startDrag($event, apt)"
                >
                  <p class="font-medium truncate">
                    {{ apt.patient?.firstName }} {{ apt.patient?.lastName }}
                  </p>
                  <p class="opacity-80 text-[10px]">
                    {{ formatTime(apt.startTime) }} - {{ formatTime(apt.endTime) }}
                  </p>
                  <!-- Resize handle -->
                  <div 
                    v-if="canEditAppointment(apt)"
                    @mousedown.stop="startResize($event, apt)"
                    class="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-black/10 hover:bg-black/20 rounded-b-lg"
                  ></div>
                </div>

                <!-- Drag/Resize Preview -->
                <div 
                  v-if="(isDragging || isResizing) && draggedAppointment && previewDayIndex === dayIndex"
                  :style="{
                    top: `${previewTop}px`,
                    height: `${Math.max(previewHeight, 32)}px`,
                    left: '4px',
                    right: '4px',
                    ...getWorkerColorStyle(draggedAppointment.workerId || ''),
                  }"
                  class="absolute rounded-lg px-2 py-1 text-white text-xs overflow-hidden pointer-events-none border-2 border-white/50"
                >
                  <p class="font-medium truncate">
                    {{ draggedAppointment.patient?.firstName }} {{ draggedAppointment.patient?.lastName }}
                  </p>
                  <p class="opacity-80 text-[10px]">
                    Arrastrando...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- MONTH VIEW -->
        <template v-else-if="viewMode === 'month'">
          <!-- Weekday headers -->
          <div class="grid grid-cols-7 border-b border-surface-200 flex-shrink-0">
            <div 
              v-for="dayName in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']" 
              :key="dayName"
              class="text-center py-2 text-xs font-medium text-surface-500 uppercase border-l border-surface-200 first:border-l-0"
            >
              {{ dayName }}
            </div>
          </div>

          <!-- Month weeks -->
          <div class="flex-1 overflow-auto">
            <div 
              v-for="(week, weekIndex) in monthWeeks" 
              :key="weekIndex"
              class="grid grid-cols-7 min-h-[120px] border-b border-surface-100 last:border-b-0"
            >
              <div 
                v-for="day in week" 
                :key="day.toISOString()"
                @click="goToDay(day)"
                class="p-2 border-l border-surface-100 first:border-l-0 cursor-pointer hover:bg-surface-50 transition-colors"
                :class="[
                  isToday(day) ? 'bg-primary-50' : '',
                  day.getMonth() !== currentDate.getMonth() ? 'opacity-40' : ''
                ]"
              >
                <!-- Day number -->
                <div class="flex items-center justify-between mb-1">
                  <span 
                    class="text-sm font-medium"
                    :class="isToday(day) ? 'text-primary-600' : 'text-surface-700'"
                  >
                    {{ day.getDate() }}
                  </span>
                  <span 
                    v-if="getMonthDayAppointmentCount(day) > 0"
                    class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-600"
                  >
                    {{ getMonthDayAppointmentCount(day) }}
                  </span>
                </div>
                
                <!-- Appointments preview (max 3) -->
                <div class="space-y-0.5">
                  <div 
                    v-for="apt in getMonthDayAppointments(day).slice(0, 3)" 
                    :key="apt.id"
                    class="text-[10px] truncate rounded px-1 py-0.5 text-white"
                    :style="getWorkerColorStyle(apt.workerId || '')"
                    @click.stop="openEditAppointment(apt)"
                  >
                    {{ formatTime(apt.startTime) }} {{ apt.patient?.firstName }}
                  </div>
                  <div 
                    v-if="getMonthDayAppointmentCount(day) > 3"
                    class="text-[10px] text-surface-500 px-1"
                  >
                    +{{ getMonthDayAppointmentCount(day) - 3 }} más
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Appointment Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="closeModal"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col animate-scale-in">
          <!-- Header (sticky) -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 flex-shrink-0">
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-semibold text-surface-900">
                {{ isReadOnlyModal ? 'Ver Cita' : (isEditing ? 'Editar Cita' : 'Nueva Cita') }}
              </h2>
              <!-- Start Appointment Button in header - only visible to assigned workers -->
              <button 
                v-if="isEditing && selectedAppointment?.status === 'SCHEDULED' && isCurrentUserAssignedToAppointment && !isReadOnlyModal"
                type="button" 
                @click="handleStartAppointment"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-full transition-colors"
              >
                <PlayIcon class="w-4 h-4" />
                Iniciar
              </button>
            </div>
            <button @click="closeModal" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <!-- Scrollable content -->
          <form @submit.prevent="saveAppointment" class="flex flex-col flex-1 overflow-hidden">
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <!-- Read-only warning banner -->
              <div v-if="isReadOnlyModal" class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
                <EyeIcon class="w-5 h-5 flex-shrink-0" />
                <span>Solo visualización. No estás asignado a esta cita.</span>
              </div>
              
              <div v-if="formError" class="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                {{ formError }}
              </div>
              
              <!-- Patient search -->
              <div class="relative">
                <label class="label">Paciente *</label>
                <input 
                  v-model="patientSearch" 
                  type="text" 
                  class="input" 
                  :class="{ 'bg-surface-100': isEditing }"
                  :disabled="isEditing"
                  placeholder="Buscar paciente..."
                  @focus="searchPatients"
                />
                <div 
                  v-if="searchResults.length > 0 && !isEditing"
                  class="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-surface-200 max-h-48 overflow-auto"
                >
                  <button
                    v-for="patient in searchResults"
                    :key="patient.id"
                    type="button"
                    @click="selectPatient(patient)"
                    class="w-full px-4 py-2 text-left hover:bg-surface-50 flex items-center gap-2"
                  >
                    <UserIcon class="w-4 h-4 text-surface-400" />
                    {{ patient.firstName }} {{ patient.lastName }}
                  </button>
                </div>
              </div>
              
              <!-- Type -->
              <div>
                <label class="label">Tipo de cita *</label>
                <select v-model="formData.type" required class="input">
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
                  <span v-if="formData.workerIds.length === 0" class="text-surface-400">
                    Seleccionar médicos...
                  </span>
                  <span v-else class="truncate">
                    {{ formData.workerIds.length }} médico(s) seleccionado(s)
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
                      v-model="formData.workerIds"
                      class="w-4 h-4 text-primary-600 rounded border-surface-300 focus:ring-primary-500"
                      @click.stop
                    />
                    <span class="text-sm">
                      {{ worker.firstName }} {{ worker.lastName }}
                      <span v-if="worker.id === authStore.user?.id" class="text-primary-600 font-medium">(yo)</span>
                    </span>
                  </label>
                </div>
                <p v-if="formData.workerIds.length === 0" class="text-xs text-danger-500 mt-1">
                  Selecciona al menos un médico
                </p>
              </div>
              
              <!-- Status (only when editing) -->
              <div v-if="isEditing">
                <label class="label">Estado de la cita</label>
                <select v-model="formData.status" class="input">
                  <option v-for="status in appointmentStatuses" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </option>
                </select>
              </div>
              
              <!-- Title -->
              <div>
                <label class="label">Título (opcional)</label>
                <input v-model="formData.title" type="text" class="input" placeholder="Descripción breve" />
              </div>
              
              <!-- Times -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="label">Inicio *</label>
                  <input 
                    v-model="formData.startTime" 
                    type="datetime-local" 
                    required 
                    class="input"
                    :class="{ 'border-danger-500 focus:border-danger-500 focus:ring-danger-500': !timeValidation.isValid && formData.startTime }"
                  />
                </div>
                <div>
                  <label class="label">Fin *</label>
                  <input 
                    v-model="formData.endTime" 
                    type="datetime-local" 
                    required 
                    class="input"
                    :class="{ 'border-danger-500 focus:border-danger-500 focus:ring-danger-500': !timeValidation.isValid && formData.endTime }"
                  />
                </div>
              </div>
              
              <!-- Time validation errors -->
              <div v-if="!timeValidation.isValid" class="p-3 rounded-lg bg-danger-50 border border-danger-200">
                <p v-for="(error, index) in timeValidation.errors" :key="index" class="text-sm text-danger-600">
                  {{ error }}
                </p>
                <p class="text-xs text-danger-500 mt-1">
                  Horario permitido: {{ MIN_HOUR }}:00 - {{ MAX_HOUR }}:00
                </p>
              </div>
              
              <!-- Real Time Section (Admin only, for IN_PROGRESS or COMPLETED appointments) -->
              <div 
                v-if="isEditing && isAdmin && selectedAppointment && (selectedAppointment.status === 'IN_PROGRESS' || selectedAppointment.status === 'COMPLETED') && selectedAppointment.realStartTime"
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
                    <span class="font-medium">{{ formatTime(selectedAppointment.realStartTime!) }}</span>
                  </div>
                  <div v-if="selectedAppointment.realEndTime" class="flex justify-between">
                    <span class="text-surface-500">Fin real:</span>
                    <span class="font-medium">{{ formatTime(selectedAppointment.realEndTime) }}</span>
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
                      :disabled="isSaving"
                      class="btn-primary btn-sm flex-1"
                    >
                      {{ isSaving ? 'Guardando...' : 'Guardar' }}
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Reset Confirmation Dialog -->
              <div v-if="showResetConfirm" class="p-4 rounded-lg bg-danger-50 border border-danger-200">
                <p class="text-sm text-danger-700 mb-3">
                  ¿Seguro que deseas resetear el tiempo? La cita volverá a estado <strong>Programada</strong> y se cancelará cualquier solicitud de valoración pendiente.
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
              
              <div>
                <label class="label">Notas</label>
                <textarea v-model="formData.notes" class="input" rows="2"></textarea>
              </div>
            </div>
            
            <!-- Footer (sticky) -->
            <div class="flex gap-3 px-6 py-4 border-t border-surface-100 flex-shrink-0 bg-white rounded-b-2xl">
              <button type="button" @click="closeModal" class="btn-secondary flex-1">
                {{ isReadOnlyModal || (isEditing && (selectedAppointment?.status === 'COMPLETED' || selectedAppointment?.status === 'CANCELLED')) ? 'Cerrar' : 'Cancelar' }}
              </button>
              <!-- Only show save button for editable appointments (not read-only) -->
              <button 
                v-if="!isReadOnlyModal && (!isEditing || (selectedAppointment?.status !== 'COMPLETED' && selectedAppointment?.status !== 'CANCELLED'))"
                type="submit" 
                :disabled="!canSubmitForm" 
                class="btn-primary flex-1"
              >
                {{ isSaving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Cita') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- WhatsApp Notification Modal -->
    <Teleport to="body">
      <div v-if="showWaModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="closeWaModal"></div>
        <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg class="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Notificar por WhatsApp</h3>
                <p class="text-sm text-slate-500">{{ waModalPatientName }}</p>
              </div>
            </div>
            <button @click="closeWaModal" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              <XMarkIcon class="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-4">
            <!-- Event type badge -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-slate-600 dark:text-slate-400">Evento:</span>
              <span v-if="waModalEventType === 'CREATED'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                ✅ Cita creada
              </span>
              <span v-else-if="waModalEventType === 'MODIFIED'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                📝 Cita modificada
              </span>
              <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                ❌ Cita cancelada
              </span>
            </div>

            <!-- Template selector -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plantilla de mensaje</label>
              <select v-model="waModalTemplateName" class="input w-full">
                <option value="" disabled>Seleccionar plantilla</option>
                <option v-for="t in waModalTemplates" :key="t.name" :value="t.name">
                  {{ t.name }} ({{ t.language }})
                </option>
              </select>
              <p v-if="waModalDefaultTemplate" class="mt-1 text-xs text-slate-500">
                Plantilla predeterminada: {{ waModalDefaultTemplate }}
              </p>
            </div>

            <!-- Success state -->
            <div v-if="waModalSent" class="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-sm font-medium text-green-700 dark:text-green-400">Notificación enviada correctamente</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
            <button @click="closeWaModal" class="btn-secondary">
              {{ waModalSent ? 'Cerrar' : 'Omitir' }}
            </button>
            <button 
              v-if="!waModalSent"
              @click="sendWaNotification" 
              :disabled="!waModalTemplateName || waModalSending"
              class="btn-primary flex items-center gap-2"
            >
              <svg v-if="waModalSending" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" />
                <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" class="opacity-75" />
              </svg>
              <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {{ waModalSending ? 'Enviando...' : 'Enviar WhatsApp' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.2s ease-out;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
