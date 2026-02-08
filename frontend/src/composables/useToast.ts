import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
    id: number
    type: ToastType
    message: string
    duration: number
}

const toasts = ref<Toast[]>([])
let idCounter = 0

// Core toast functions - can be used anywhere
const show = (message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = ++idCounter
    const toast: Toast = { id, type, message, duration }
    toasts.value.push(toast)

    if (duration > 0) {
        setTimeout(() => {
            remove(id)
        }, duration)
    }

    return id
}

const remove = (id: number) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
        toasts.value.splice(index, 1)
    }
}

// Global toast functions - can be imported and used anywhere
export const toast = {
    show,
    remove,
    success: (message: string, duration?: number) => show(message, 'success', duration),
    error: (message: string, duration?: number) => show(message, 'error', duration ?? 6000),
    warning: (message: string, duration?: number) => show(message, 'warning', duration),
    info: (message: string, duration?: number) => show(message, 'info', duration),
}

// Composable for Vue components (provides reactive toasts ref)
export function useToast() {
    return {
        toasts,
        ...toast,
    }
}
