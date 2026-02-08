import { io, Socket } from 'socket.io-client'
import { ref, readonly } from 'vue'
import { toast } from '@/composables/useToast'

// Connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

const socket = ref<Socket | null>(null)
const status = ref<ConnectionStatus>('disconnected')
const isConnected = ref(false)
const reconnectAttempts = ref(0)
const MAX_RECONNECT_ATTEMPTS = 5

// Event listeners registry
type EventCallback = (data: unknown) => void
const eventListeners = new Map<string, Set<EventCallback>>()

/**
 * Initialize WebSocket connection with JWT token
 */
export function connectWebSocket(token: string): void {
    // Don't reconnect if already connected
    if (socket.value?.connected) {
        return
    }

    // Disconnect existing socket if any
    if (socket.value) {
        socket.value.disconnect()
    }

    status.value = 'connecting'

    const wsUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:3000'

    socket.value = io(wsUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
    })

    // Connection established
    socket.value.on('connect', () => {
        status.value = 'connected'
        isConnected.value = true
        reconnectAttempts.value = 0

        console.log('🔌 WebSocket connected')

        // Show success toast only if reconnecting
        if (reconnectAttempts.value > 0) {
            toast.success('Conexión restablecida')
        }
    })

    // Connection lost
    socket.value.on('disconnect', (reason) => {
        status.value = 'disconnected'
        isConnected.value = false

        console.log('🔌 WebSocket disconnected:', reason)

        // Don't show warning for intentional disconnects
        if (reason !== 'io client disconnect') {
            toast.warning('Conexión perdida. Reconectando...')
        }
    })

    // Reconnection attempt
    socket.value.on('reconnect_attempt', (attempt) => {
        reconnectAttempts.value = attempt
        console.log(`🔌 WebSocket reconnecting... attempt ${attempt}`)
    })

    // Failed to reconnect after all attempts
    socket.value.on('reconnect_failed', () => {
        status.value = 'error'
        console.error('🔌 WebSocket reconnection failed')
        toast.error('No se pudo reconectar. Recarga la página.')
    })

    // Connection error
    socket.value.on('connect_error', (error) => {
        status.value = 'error'
        console.error('🔌 WebSocket connection error:', error.message)

        // Only show error on first attempt
        if (reconnectAttempts.value === 0) {
            // Don't spam user with errors, fallback to polling will handle it
            console.warn('WebSocket unavailable, falling back to polling')
        }
    })

    // Re-register all event listeners on new socket
    eventListeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
            socket.value?.on(event, callback)
        })
    })
}

/**
 * Disconnect WebSocket
 */
export function disconnectWebSocket(): void {
    if (socket.value) {
        socket.value.disconnect()
        socket.value = null
    }
    status.value = 'disconnected'
    isConnected.value = false
    reconnectAttempts.value = 0
}

/**
 * Subscribe to a WebSocket event
 * Returns unsubscribe function
 */
export function onSocketEvent(event: string, callback: EventCallback): () => void {
    // Add to registry
    if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set())
    }
    eventListeners.get(event)!.add(callback)

    // Add listener if socket exists
    if (socket.value) {
        socket.value.on(event, callback)
    }

    // Return unsubscribe function
    return () => {
        eventListeners.get(event)?.delete(callback)
        socket.value?.off(event, callback)
    }
}

/**
 * Emit event to server
 */
export function emitSocketEvent(event: string, data?: unknown): void {
    if (socket.value?.connected) {
        socket.value.emit(event, data)
    } else {
        console.warn(`Cannot emit ${event}: WebSocket not connected`)
    }
}

// Track which appointment room we're currently in
let currentAppointmentRoom: string | null = null

/**
 * Join an appointment room to receive real-time stock updates
 */
export function joinAppointmentRoom(appointmentId: string): void {
    if (!socket.value?.connected) {
        console.warn('Cannot join appointment room: WebSocket not connected')
        return
    }

    // Leave previous room if any
    if (currentAppointmentRoom && currentAppointmentRoom !== appointmentId) {
        leaveAppointmentRoom(currentAppointmentRoom)
    }

    socket.value.emit('join:appointment', { appointmentId })
    currentAppointmentRoom = appointmentId
    console.log('🔌 Joining appointment room:', appointmentId)
}

/**
 * Leave an appointment room
 */
export function leaveAppointmentRoom(appointmentId?: string): void {
    if (!socket.value?.connected) {
        return
    }

    const roomToLeave = appointmentId || currentAppointmentRoom
    if (roomToLeave) {
        socket.value.emit('leave:appointment', { appointmentId: roomToLeave })
        console.log('🔌 Leaving appointment room:', roomToLeave)
        if (roomToLeave === currentAppointmentRoom) {
            currentAppointmentRoom = null
        }
    }
}

/**
 * Get current connection status and room management functions
 */
export function useWebSocket() {
    return {
        isConnected: readonly(isConnected),
        status: readonly(status),
        reconnectAttempts: readonly(reconnectAttempts),
        connect: connectWebSocket,
        disconnect: disconnectWebSocket,
        on: onSocketEvent,
        emit: emitSocketEvent,
        joinAppointmentRoom,
        leaveAppointmentRoom,
    }
}
