<script setup lang="ts">
import { ref, computed } from 'vue'
import { XMarkIcon, BugAntIcon, PaperAirplaneIcon } from '@heroicons/vue/24/outline'
import { api } from '@/services/api'

const props = defineProps<{
  collapsed?: boolean
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const isSuccess = ref(false)

// Form data
const title = ref('')
const description = ref('')
const category = ref('OTHER')

const categories = [
  { value: 'UI', label: '🎨 Interfaz de Usuario' },
  { value: 'FUNCTIONALITY', label: '⚙️ Funcionalidad' },
  { value: 'DATA', label: '💾 Datos' },
  { value: 'PERFORMANCE', label: '🚀 Rendimiento' },
  { value: 'OTHER', label: '📋 Otro' },
]

const canSubmit = computed(() => title.value.trim() && description.value.trim() && !isLoading.value)

const toggleModal = () => {
  if (isOpen.value) {
    closeModal()
  } else {
    isOpen.value = true
    isSuccess.value = false
  }
}

const closeModal = () => {
  isOpen.value = false
  resetForm()
}

const resetForm = () => {
  title.value = ''
  description.value = ''
  category.value = 'OTHER'
  isSuccess.value = false
}

const submitReport = async () => {
  if (!canSubmit.value) return

  isLoading.value = true
  
  try {
    await api.post('/feedback/report-bug', {
      title: title.value.trim(),
      description: description.value.trim(),
      category: category.value,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
    })

    isSuccess.value = true
    
    // Auto close after 3 seconds
    setTimeout(() => {
      closeModal()
    }, 3000)
  } catch (error: any) {
    console.error('Error submitting bug report:', error)
    alert(error.response?.data?.error || 'Error al enviar el reporte. Por favor, intenta de nuevo.')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <!-- Trigger Button -->
  <button
    @click="toggleModal"
    :class="[
      'flex items-center gap-2 rounded-xl transition-all duration-200',
      props.collapsed
        ? 'w-10 h-10 justify-center mx-auto'
        : 'w-full px-3 py-2',
      isOpen
        ? 'bg-red-600 text-white shadow-lg'
        : 'bg-red-50 text-red-600 hover:bg-red-100'
    ]"
    :title="props.collapsed ? 'Reportar error' : undefined"
  >
    <BugAntIcon class="w-5 h-5 flex-shrink-0" />
    <span v-if="!props.collapsed" class="font-medium text-sm">Reportar Error</span>
  </button>

  <!-- Modal -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="closeModal">
        <div 
          class="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-gradient-to-r from-red-500 to-red-600 rounded-t-2xl">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <BugAntIcon class="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 class="font-semibold text-white">Reportar Error</h3>
                <p class="text-xs text-white/80">Ayúdanos a mejorar</p>
              </div>
            </div>
            <button 
              @click="closeModal" 
              class="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <XMarkIcon class="w-5 h-5 text-white" />
            </button>
          </div>

          <!-- Success State -->
          <div v-if="isSuccess" class="p-8 text-center">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 class="text-lg font-semibold text-surface-900 mb-2">¡Gracias por tu reporte!</h4>
            <p class="text-surface-600">Hemos recibido tu feedback y lo revisaremos pronto.</p>
          </div>

          <!-- Form -->
          <form v-else @submit.prevent="submitReport" class="p-6 space-y-4">
            <!-- Category -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Categoría</label>
              <select 
                v-model="category"
                class="input w-full"
              >
                <option v-for="cat in categories" :key="cat.value" :value="cat.value">
                  {{ cat.label }}
                </option>
              </select>
            </div>

            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Título del problema *</label>
              <input 
                v-model="title"
                type="text"
                class="input w-full"
                placeholder="Ej: Error al guardar paciente"
                maxlength="200"
                required
              />
              <p class="text-xs text-surface-500 mt-1">{{ title.length }}/200 caracteres</p>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Descripción detallada *</label>
              <textarea 
                v-model="description"
                class="input w-full h-32 resize-none"
                placeholder="Describe qué ocurrió, qué esperabas que pasara y los pasos para reproducir el error..."
                required
              ></textarea>
            </div>

            <!-- Info Note -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p class="text-sm text-blue-800">
                <strong>ℹ️ Información automática:</strong> Se incluirá automáticamente tu usuario, clínica, la URL actual y navegador para ayudarnos a diagnosticar el problema.
              </p>
            </div>

            <!-- Submit Button -->
            <div class="flex gap-3 pt-2">
              <button 
                type="button"
                @click="closeModal"
                class="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                :disabled="!canSubmit"
                class="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <template v-if="isLoading">
                  <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enviando...
                </template>
                <template v-else>
                  <PaperAirplaneIcon class="w-5 h-5" />
                  Enviar Reporte
                </template>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
