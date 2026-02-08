import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/services/api'
import { toast } from '@/composables/useToast'

export interface ActiveAppointment {
    id: string
    clinicId: string
    patientId: string
    title: string | null
    description: string | null
    startTime: string
    endTime: string
    duration: number
    realStartTime: string | null
    realEndTime: string | null
    pausedDuration: number | null
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
    notes: string | null
    patient: {
        id: string
        firstName: string
        lastName: string
    }
    appointmentWorkers: Array<{
        userId: string
        isPrimary: boolean
        user: {
            id: string
            firstName: string
            lastName: string
        }
    }>
}

interface ApiResult<T> {
    success: boolean
    data?: T
    message?: string
}

export const useActiveAppointmentsStore = defineStore('activeAppointments', () => {
    // State
    const appointments = ref<ActiveAppointment[]>([])
    const isLoading = ref(false)
    const selectedAppointmentId = ref<string | null>(null)
    const isPanelOpen = ref(false)

    // Computed
    const activeCount = computed(() => appointments.value.length)

    const selectedAppointment = computed(() =>
        appointments.value.find(a => a.id === selectedAppointmentId.value)
    )

    // Helper to check if appointment is paused (has pause marker in notes)
    const isPaused = (appointment: ActiveAppointment): boolean => {
        return appointment.notes?.includes('[PAUSED:') ?? false
    }

    // Calculate elapsed time in minutes for an active appointment
    const getElapsedMinutes = (appointment: ActiveAppointment): number => {
        if (!appointment.realStartTime) return 0

        const startTime = new Date(appointment.realStartTime).getTime()
        const now = Date.now()
        const elapsedMs = now - startTime
        const elapsedMinutes = Math.floor(elapsedMs / 60000)

        // Subtract paused duration
        const pausedMinutes = appointment.pausedDuration ?? 0
        return Math.max(0, elapsedMinutes - pausedMinutes)
    }

    // Format elapsed time as HH:MM:SS
    const formatElapsedTime = (appointment: ActiveAppointment): string => {
        const totalMinutes = getElapsedMinutes(appointment)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        const seconds = Math.floor((Date.now() - new Date(appointment.realStartTime!).getTime()) / 1000) % 60

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }

    // Check if appointment exceeds planned duration
    const isOvertime = (appointment: ActiveAppointment): boolean => {
        const elapsedMinutes = getElapsedMinutes(appointment)
        return elapsedMinutes > appointment.duration
    }

    // Actions
    async function loadActiveAppointments() {
        isLoading.value = true
        try {
            const result = await api.get<ApiResult<ActiveAppointment[]>>('/appointments/active')
            if (result?.success && result.data) {
                appointments.value = result.data
            }
        } catch (error) {
            console.error('Failed to load active appointments:', error)
        } finally {
            isLoading.value = false
        }
    }

    async function startAppointment(appointmentId: string) {
        try {
            const result = await api.post<ApiResult<ActiveAppointment>>(`/appointments/${appointmentId}/start`)
            if (result?.success && result.data) {
                // Add to active list (check for duplicates to avoid double-add from WS event)
                const exists = appointments.value.find(a => a.id === result.data!.id)
                if (!exists) {
                    appointments.value.push(result.data)
                }
                toast.success('Cita iniciada')
                return result.data
            }
        } catch (error) {
            console.error('Failed to start appointment:', error)
            throw error
        }
    }

    async function pauseAppointment(appointmentId: string) {
        try {
            const result = await api.post<ApiResult<ActiveAppointment>>(`/appointments/${appointmentId}/pause`)
            if (result?.success && result.data) {
                // Update in list
                const index = appointments.value.findIndex(a => a.id === appointmentId)
                if (index !== -1) {
                    appointments.value[index] = result.data
                }
                toast.info('Cita pausada')
                return result.data
            }
        } catch (error) {
            console.error('Failed to pause appointment:', error)
            throw error
        }
    }

    async function resumeAppointment(appointmentId: string) {
        try {
            const result = await api.post<ApiResult<ActiveAppointment>>(`/appointments/${appointmentId}/resume`)
            if (result?.success && result.data) {
                // Update in list
                const index = appointments.value.findIndex(a => a.id === appointmentId)
                if (index !== -1) {
                    appointments.value[index] = result.data
                }
                toast.info('Cita reanudada')
                return result.data
            }
        } catch (error) {
            console.error('Failed to resume appointment:', error)
            throw error
        }
    }

    async function completeAppointment(appointmentId: string) {
        try {
            const result = await api.post<ApiResult<ActiveAppointment>>(`/appointments/${appointmentId}/complete`)
            if (result?.success) {
                // Remove from active list
                appointments.value = appointments.value.filter(a => a.id !== appointmentId)
                if (selectedAppointmentId.value === appointmentId) {
                    selectedAppointmentId.value = null
                    isPanelOpen.value = false
                }
                toast.success('Cita completada')
                return result.data
            }
        } catch (error) {
            console.error('Failed to complete appointment:', error)
            throw error
        }
    }

    async function cancelActiveAppointment(appointmentId: string) {
        try {
            const result = await api.post<ApiResult<ActiveAppointment>>(`/appointments/${appointmentId}/cancel-active`)
            if (result?.success) {
                // Remove from active list
                appointments.value = appointments.value.filter(a => a.id !== appointmentId)
                if (selectedAppointmentId.value === appointmentId) {
                    selectedAppointmentId.value = null
                    isPanelOpen.value = false
                }
                toast.warning('Cita cancelada')
                return result.data
            }
        } catch (error) {
            console.error('Failed to cancel active appointment:', error)
            throw error
        }
    }

    function selectAppointment(appointmentId: string) {
        selectedAppointmentId.value = appointmentId
        isPanelOpen.value = true
    }

    function closePanel() {
        isPanelOpen.value = false
        selectedAppointmentId.value = null
    }

    // ========================================================================
    // WEBSOCKET-BASED REAL-TIME SYNC (with polling fallback)
    // ========================================================================

    const FALLBACK_POLLING_INTERVAL = 30000 // 30 seconds fallback
    let pollingIntervalId: number | null = null
    const isPolling = ref(false)
    const useWebSocketSync = ref(true)
    let unsubscribeFns: Array<() => void> = []

    /**
     * Setup WebSocket listeners for real-time updates
     */
    function setupWebSocketListeners() {
        // Dynamic import to avoid circular dependencies
        import('@/services/websocket').then(({ onSocketEvent, useWebSocket }) => {
            const { isConnected } = useWebSocket()

            // Always setup the listeners (they'll receive events when connected)
            console.log('🔌 Setting up WebSocket listeners for appointments')

            // Listen for appointment:started
            const unsubStart = onSocketEvent('appointment:started', (data: unknown) => {
                const { appointment } = data as { appointment: ActiveAppointment }
                if (appointment) {
                    // Add to list if not exists
                    const exists = appointments.value.find(a => a.id === appointment.id)
                    if (!exists) {
                        appointments.value.push(appointment)
                        console.log('🔌 Appointment started (via WS):', appointment.id)
                    }
                }
            })
            unsubscribeFns.push(unsubStart)

            // Listen for appointment:completed
            const unsubComplete = onSocketEvent('appointment:completed', (data: unknown) => {
                const { appointmentId } = data as { appointmentId: string }
                if (appointmentId) {
                    appointments.value = appointments.value.filter(a => a.id !== appointmentId)
                    console.log('🔌 Appointment completed (via WS):', appointmentId)

                    // Close panel if viewing this appointment
                    if (selectedAppointmentId.value === appointmentId) {
                        closePanel()
                    }
                }
            })
            unsubscribeFns.push(unsubComplete)

            // Listen for appointment:updated (pause/resume)
            const unsubUpdate = onSocketEvent('appointment:updated', (data: unknown) => {
                const { appointment } = data as { appointment: ActiveAppointment }
                if (appointment) {
                    const index = appointments.value.findIndex(a => a.id === appointment.id)
                    if (index >= 0) {
                        appointments.value[index] = appointment
                        console.log('🔌 Appointment updated (via WS):', appointment.id)
                    }
                }
            })
            unsubscribeFns.push(unsubUpdate)

            // Watch connection status and toggle polling fallback
            import('vue').then(({ watch: vueWatch }) => {
                const unsubWatch = vueWatch(isConnected, (connected) => {
                    if (connected) {
                        console.log('🔌 WebSocket connected - stopping polling fallback')
                        useWebSocketSync.value = true
                        stopPollingFallback()
                    } else {
                        console.log('🔌 WebSocket disconnected - starting polling fallback')
                        useWebSocketSync.value = false
                        startPollingFallback()
                    }
                }, { immediate: true })
                unsubscribeFns.push(unsubWatch)
            })

        }).catch(err => {
            console.error('Failed to setup WebSocket listeners:', err)
            useWebSocketSync.value = false
            startPollingFallback()
        })
    }

    /**
     * Start polling as fallback when WebSocket unavailable
     */
    function startPollingFallback() {
        if (pollingIntervalId !== null) return

        isPolling.value = true
        pollingIntervalId = window.setInterval(() => {
            loadActiveAppointments()
        }, FALLBACK_POLLING_INTERVAL)

        console.log('🔄 Using polling fallback (every 30s)')
    }

    /**
     * Stop polling fallback
     */
    function stopPollingFallback() {
        if (pollingIntervalId !== null) {
            clearInterval(pollingIntervalId)
            pollingIntervalId = null
            isPolling.value = false
        }
    }

    /**
     * Start real-time sync (WebSocket primary, polling fallback)
     */
    function startPolling() {
        // Initial load
        loadActiveAppointments()

        // Try WebSocket first
        setupWebSocketListeners()
    }

    /**
     * Stop all sync mechanisms
     */
    function stopPolling() {
        // Cleanup WebSocket listeners
        unsubscribeFns.forEach(unsub => unsub())
        unsubscribeFns = []

        // Stop polling fallback
        stopPollingFallback()

        console.log('⏹️ Active appointments sync stopped')
    }

    return {
        // State
        appointments,
        isLoading,
        selectedAppointmentId,
        isPanelOpen,
        isPolling,

        // Computed
        activeCount,
        selectedAppointment,

        // Helpers
        isPaused,
        getElapsedMinutes,
        formatElapsedTime,
        isOvertime,

        // Actions
        loadActiveAppointments,
        startAppointment,
        pauseAppointment,
        resumeAppointment,
        completeAppointment,
        cancelActiveAppointment,
        selectAppointment,
        closePanel,

        // Polling (now hybrid: WebSocket + polling fallback)
        startPolling,
        stopPolling,
    }
})
