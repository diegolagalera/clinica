<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  XMarkIcon 
} from '@heroicons/vue/24/outline'

const { toasts, remove } = useToast()

const getIcon = (type: string) => {
  switch (type) {
    case 'success': return CheckCircleIcon
    case 'error': return ExclamationCircleIcon
    case 'warning': return ExclamationTriangleIcon
    default: return InformationCircleIcon
  }
}

const getStyles = (type: string) => {
  switch (type) {
    case 'success': 
      return 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-500/25'
    case 'error': 
      return 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-rose-500/25'
    case 'warning': 
      return 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-amber-500/25'
    default: 
      return 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sky-500/25'
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="translate-x-full opacity-0 scale-95"
        enter-to-class="translate-x-0 opacity-100 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="translate-x-0 opacity-100 scale-100"
        leave-to-class="translate-x-full opacity-0 scale-95"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[280px] max-w-[400px]',
            getStyles(toast.type)
          ]"
        >
          <component 
            :is="getIcon(toast.type)" 
            class="w-5 h-5 flex-shrink-0" 
          />
          <span class="flex-1 text-sm font-medium">{{ toast.message }}</span>
          <button 
            @click="remove(toast.id)"
            class="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
          >
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
