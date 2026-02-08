<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon } from '@heroicons/vue/24/outline'
import { api } from '@/services/api'

// Props
defineProps<{
  collapsed?: boolean
}>()

// State
const isOpen = ref(false)
const message = ref('')
const isLoading = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const messages = ref<Message[]>([])

// Toggle chat panel
const toggleChat = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value && messages.value.length === 0) {
    // Add welcome message
    messages.value.push({
      role: 'assistant',
      content: '¡Hola! 👋 Soy el asistente de CUSPIA. Puedo ayudarte con preguntas sobre cómo usar la aplicación.\n\nPor ejemplo:\n• ¿Cómo creo un paciente?\n• ¿Cómo agendo una cita?\n• ¿Cómo uso el odontograma?\n\n¿En qué puedo ayudarte?'
    })
  }
}

// Send message
const sendMessage = async () => {
  const trimmedMessage = message.value.trim()
  if (!trimmedMessage || isLoading.value) return

  // Add user message
  messages.value.push({
    role: 'user',
    content: trimmedMessage
  })
  message.value = ''
  isLoading.value = true

  // Scroll to bottom
  await nextTick()
  scrollToBottom()

  try {
    // Prepare history (exclude welcome message for API)
    const history = messages.value
      .slice(1, -1) // Exclude welcome and current message
      .map(m => ({ role: m.role, content: m.content }))

    // api.post() returns response.data directly, not the full AxiosResponse
    const data = await api.post<{ success: boolean; message?: string; error?: string }>('/assistant/chat', {
      message: trimmedMessage,
      history
    })
    
    if (data.success && data.message) {
      messages.value.push({
        role: 'assistant',
        content: data.message
      })
    } else {
      messages.value.push({
        role: 'assistant',
        content: data.error || 'Lo siento, hubo un error. Intenta de nuevo.'
      })
    }
  } catch (error: any) {
    console.error('Assistant error:', error)
    
    let errorMessage = 'Lo siento, hubo un error de conexión. Intenta de nuevo.'
    if (error.response?.status === 401) {
      errorMessage = 'Tu sesión ha expirado. Por favor, recarga la página.'
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error
    }
    
    messages.value.push({
      role: 'assistant',
      content: errorMessage
    })
  } finally {
    isLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

// Scroll chat to bottom
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Handle Enter key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// Watch for new messages and scroll
watch(messages, () => {
  nextTick(() => scrollToBottom())
}, { deep: true })
</script>

<template>
  <!-- Floating Button -->
  <button
    @click="toggleChat"
    :class="[
      'flex items-center gap-2 rounded-xl transition-all duration-200',
      collapsed 
        ? 'w-10 h-10 justify-center mx-auto' 
        : 'w-full px-3 py-2',
      isOpen 
        ? 'bg-primary-600 text-white shadow-lg' 
        : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
    ]"
    :title="collapsed ? 'Asistente de ayuda' : undefined"
  >
    <SparklesIcon class="w-5 h-5 flex-shrink-0" />
    <span v-if="!collapsed" class="font-medium text-sm">Asistente IA</span>
  </button>

  <!-- Chat Panel (Fixed position overlay) -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div v-if="isOpen" class="fixed bottom-4 left-4 lg:left-72 z-50 w-96 max-w-[calc(100vw-2rem)]">
        <div class="bg-white rounded-2xl shadow-2xl border border-surface-200 flex flex-col overflow-hidden" style="height: 500px;">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <SparklesIcon class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-semibold text-sm">Asistente CUSPIA</h3>
                <p class="text-xs text-primary-100">Ayuda sobre la aplicación</p>
              </div>
            </div>
            <button 
              @click="isOpen = false"
              class="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <!-- Messages -->
          <div 
            ref="messagesContainer"
            class="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-50"
          >
            <div 
              v-for="(msg, index) in messages" 
              :key="index"
              :class="[
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              ]"
            >
              <div
                :class="[
                  'max-w-[85%] px-4 py-2.5 rounded-2xl text-sm',
                  msg.role === 'user' 
                    ? 'bg-primary-600 text-white rounded-br-md' 
                    : 'bg-white text-surface-700 shadow-sm border border-surface-100 rounded-bl-md'
                ]"
              >
                <!-- Render message with line breaks -->
                <div class="whitespace-pre-wrap">{{ msg.content }}</div>
              </div>
            </div>

            <!-- Loading indicator -->
            <div v-if="isLoading" class="flex justify-start">
              <div class="bg-white text-surface-500 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-surface-100">
                <div class="flex items-center gap-2">
                  <div class="flex gap-1">
                    <span class="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                    <span class="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                    <span class="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                  </div>
                  <span class="text-xs">Escribiendo...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Input -->
          <div class="p-3 border-t border-surface-200 bg-white">
            <div class="flex items-end gap-2">
              <textarea
                v-model="message"
                @keydown="handleKeydown"
                placeholder="Escribe tu pregunta..."
                rows="1"
                class="flex-1 resize-none rounded-xl border border-surface-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                :disabled="isLoading"
              />
              <button
                @click="sendMessage"
                :disabled="!message.trim() || isLoading"
                :class="[
                  'p-2.5 rounded-xl transition-all',
                  message.trim() && !isLoading
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-surface-100 text-surface-400 cursor-not-allowed'
                ]"
              >
                <PaperAirplaneIcon class="w-5 h-5" />
              </button>
            </div>
            <p class="text-[10px] text-surface-400 mt-2 text-center">
              Solo puedo ayudar con preguntas sobre la aplicación
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
