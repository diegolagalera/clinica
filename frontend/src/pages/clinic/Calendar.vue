<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
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

const authStore = useAuthStore()

// State
const appointments = ref<Appointment[]>([])
const isLoading = ref(true)
const error = ref('')

// Calendar state
const currentDate = ref(new Date())
const calendarRef = ref<HTMLElement | null>(null)
const viewMode = ref<'day' | 'week' | 'month'>('week')

// Workers state
const workers = ref<User[]>([])
const selectedWorkerIds = ref<Set<string>>(new Set())
const showWorkerPanel = ref(true)

// Worker color palette
const WORKER_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100' },
  { bg: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-100' },
  { bg: 'bg-purple-500', text: 'text-purple-500', light: 'bg-purple-100' },
  { bg: 'bg-orange-500', text: 'text-orange-500', light: 'bg-orange-100' },
  { bg: 'bg-pink-500', text: 'text-pink-500', light: 'bg-pink-100' },
  { bg: 'bg-cyan-500', text: 'text-cyan-500', light: 'bg-cyan-100' },
  { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-100' },
  { bg: 'bg-indigo-500', text: 'text-indigo-500', light: 'bg-indigo-100' },
  { bg: 'bg-rose-500', text: 'text-rose-500', light: 'bg-rose-100' },
  { bg: 'bg-teal-500', text: 'text-teal-500', light: 'bg-teal-100' },
]

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

// Get worker color by index
const getWorkerColor = (workerId: string) => {
  const index = workers.value.findIndex(w => w.id === workerId)
  return WORKER_COLORS[index % WORKER_COLORS.length] || WORKER_COLORS[0]
}

// Check if current user is admin
const isAdmin = computed(() => {
  const role = authStore.user?.role
  return role === 'ADMIN' || role === 'SUPERADMIN'
})

// Check if appointment can be edited (dragged/resized)
const canEditAppointment = (apt: Appointment) => {
  // Admins can always edit
  if (isAdmin.value) return true
  // Workers can only edit non-closed appointments
  return apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED'
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
    return { start: today.toISOString().split('T')[0], end: tomorrow.toISOString().split('T')[0] }
  }
  const start = days[0]!
  const end = new Date(days[days.length - 1]!)
  // Add 1 day to end to include it in the query (API uses exclusive end)
  end.setDate(end.getDate() + 1)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
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

// Group appointments by day with overlap detection
const appointmentsByDay = computed(() => {
  const map = new Map<string, Array<Appointment & { column: number; totalColumns: number }>>()
  
  visibleDays.value.forEach(day => {
    const key = day.toISOString().split('T')[0]
    const dayApts = filteredAppointments.value
      .filter(apt => new Date(apt.startTime).toISOString().split('T')[0] === key)
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
const loadAppointments = async () => {
  isLoading.value = true
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
    isLoading.value = false
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

// Search patients
const searchPatients = async () => {
  if (patientSearch.value.length < 2) {
    searchResults.value = []
    return
  }
  
  isSearching.value = true
  try {
    const response = await api.get<ApiResponse<{ data: Patient[] }>>('/patients', {
      params: { search: patientSearch.value, limit: 5 },
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
    if (isEditing.value && selectedAppointment.value) {
      await api.put(`/appointments/${selectedAppointment.value.id}`, {
        type: formData.value.type,
        title: formData.value.title || undefined,
        startTime: formData.value.startTime,
        endTime: formData.value.endTime,
        notes: formData.value.notes || undefined,
        status: formData.value.status,
        workerIds: formData.value.workerIds.length > 0 ? formData.value.workerIds : undefined,
      })
    } else {
      await api.post('/appointments', formData.value)
    }
    showModal.value = false
    resetForm()
    await loadAppointments()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error saving appointment'
  } finally {
    isSaving.value = false
  }
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
  if (!canEditAppointment(apt)) return
  e.preventDefault()
  
  isDragging.value = true
  hasMoved.value = false
  draggedAppointment.value = apt
  dragStartY.value = e.clientY
  dragStartX.value = e.clientX
  
  const start = new Date(apt.startTime)
  const end = new Date(apt.endTime)
  originalStart.value = start
  originalEnd.value = end
  
  const dayKey = start.toISOString().split('T')[0]
  originalDayIndex.value = weekDays.value.findIndex(d => d.toISOString().split('T')[0] === dayKey)
  
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  
  previewTop.value = minutesToY(startMinutes)
  previewHeight.value = minutesToY(endMinutes) - minutesToY(startMinutes)
  previewDayIndex.value = originalDayIndex.value
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
}

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value || !draggedAppointment.value || !calendarRef.value) return
  
  const dx = e.clientX - dragStartX.value
  const dy = e.clientY - dragStartY.value
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  if (distance < DRAG_THRESHOLD) return
  
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
  
  if (!isDragging.value || !draggedAppointment.value) {
    isDragging.value = false
    hasMoved.value = false
    return
  }
  
  const apt = draggedAppointment.value
  
  if (!hasMoved.value) {
    isDragging.value = false
    hasMoved.value = false
    draggedAppointment.value = null
    originalStart.value = null
    originalEnd.value = null
    openEditAppointment(apt)
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
      await loadAppointments()
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
  
  const dayKey = start.toISOString().split('T')[0]
  originalDayIndex.value = weekDays.value.findIndex(d => d.toISOString().split('T')[0] === dayKey)
  
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
      await loadAppointments()
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

// Month view helpers
const getMonthDayAppointments = (day: Date) => {
  const key = day.toISOString().split('T')[0]
  return filteredAppointments.value.filter(apt => 
    new Date(apt.startTime).toISOString().split('T')[0] === key
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
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', endResize)
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
          v-for="(worker, index) in workers" 
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
            :class="[
              selectedWorkerIds.has(worker.id) 
                ? WORKER_COLORS[index % WORKER_COLORS.length]?.bg + ' border-transparent' 
                : 'border-surface-300'
            ]"
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

                <!-- Appointments -->
                <div 
                  v-for="apt in appointmentsByDay.get(day.toISOString().split('T')[0])" 
                  :key="apt.id"
                  :style="getAppointmentStyle(apt)"
                  class="absolute rounded-lg px-2 py-1 text-white text-xs overflow-hidden select-none"
                  :class="[
                    getWorkerColor(apt.workerId || '').bg,
                    canEditAppointment(apt) ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-60'
                  ]"
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
                  }"
                  class="absolute rounded-lg px-2 py-1 text-white text-xs overflow-hidden pointer-events-none border-2 border-white/50"
                  :class="getWorkerColor(draggedAppointment.workerId || '').bg"
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
                    :class="getWorkerColor(apt.workerId || '').bg"
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
        <div class="absolute inset-0 bg-surface-900/50" @click="showModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">{{ isEditing ? 'Editar Cita' : 'Nueva Cita' }}</h2>
            <button @click="showModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="saveAppointment" class="p-6 space-y-4">
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
                <input v-model="formData.startTime" type="datetime-local" required class="input" />
              </div>
              <div>
                <label class="label">Fin *</label>
                <input v-model="formData.endTime" type="datetime-local" required class="input" />
              </div>
            </div>
            
            <div>
              <label class="label">Notas</label>
              <textarea v-model="formData.notes" class="input" rows="2"></textarea>
            </div>
            
            <div class="flex gap-3 pt-4">
              <button type="button" @click="showModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isSaving || !formData.patientId" class="btn-primary flex-1">
                {{ isSaving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Cita') }}
              </button>
            </div>
          </form>
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
