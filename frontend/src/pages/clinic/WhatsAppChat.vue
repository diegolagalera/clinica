<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { api } from '@/services/api'
import { useToast } from '@/composables/useToast'
import { onSocketEvent } from '@/services/websocket'
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  Cog6ToothIcon,
  BookOpenIcon,
  UserGroupIcon,
  SparklesIcon,
  HandRaisedIcon,
  PauseIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  PencilSquareIcon,
  PhoneIcon,
  PaperClipIcon,
  DocumentIcon,
  ClockIcon,
} from '@heroicons/vue/24/outline'
import {
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightSolidIcon,
} from '@heroicons/vue/24/solid'

const toast = useToast()

// State
const conversations = ref<any[]>([])
const selectedConversation = ref<any>(null)
const messages = ref<any[]>([])
const newMessage = ref('')
const searchQuery = ref('')
const filterStatus = ref('')
const filterMode = ref('')
const loadingMessages = ref(false)
const sendingMessage = ref(false)
const switchingMode = ref(false)
const showNotes = ref(false)
const notes = ref<any[]>([])
const newNote = ref('')
const quickReplies = ref<any[]>([])
const showQuickReplies = ref(false)
const showMobileChat = ref(false)
const messagesContainer = ref<HTMLDivElement>()
const fileInput = ref<HTMLInputElement>()
const sendingMedia = ref(false)
const mediaPreviewUrl = ref('')
const showMediaPreview = ref(false)

// Computed
const filteredConversations = computed(() => {
  let result = conversations.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(c =>
      (c.waContactName || '').toLowerCase().includes(q) ||
      (c.waContactPhone || '').includes(q)
    )
  }
  return result
})

const conversationCounts = computed(() => {
  const all = conversations.value
  return {
    all: all.length,
    ai: all.filter(c => c.controlMode === 'AI').length,
    human: all.filter(c => c.controlMode === 'HUMAN').length,
  }
})

// Methods
const fetchConversations = async () => {
  try {
    const params: any = {}
    if (filterStatus.value) params.controlMode = filterStatus.value

    const res = await api.get<any>('/chatbot/conversations', { params })
    conversations.value = res.data || []
  } catch (err: any) {
    console.error('Failed to load conversations', err)
  }
}

const selectConversation = async (conv: any) => {
  selectedConversation.value = conv
  showMobileChat.value = true
  loadingMessages.value = true

  try {
    const res = await api.get<any>(`/chatbot/conversations/${conv.id}/messages`)
    messages.value = (res.data || []).reverse()

    // Mark as read
    await api.put(`/chatbot/conversations/${conv.id}/read`)
    conv.unreadCount = 0
  } catch (err: any) {
    toast.error('Error cargando mensajes')
  } finally {
    loadingMessages.value = false
    // Scroll AFTER loading completes and DOM renders messages
    await nextTick()
    await nextTick()
    scrollToBottom()
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedConversation.value) return

  sendingMessage.value = true
  const text = newMessage.value.trim()
  newMessage.value = ''

  // Optimistic update
  const tempMsg = {
    id: 'temp-' + Date.now(),
    direction: 'OUTBOUND',
    content: text,
    isFromAi: false,
    status: 'SENDING',
    createdAt: new Date().toISOString(),
  }
  messages.value.push(tempMsg)
  await nextTick()
  scrollToBottom()

  try {
    const res = await api.post<any>(`/chatbot/conversations/${selectedConversation.value.id}/messages`, { text })
    // Replace temp message
    const idx = messages.value.findIndex(m => m.id === tempMsg.id)
    if (idx !== -1) messages.value.splice(idx, 1, res.data)

    // Update sidebar preview
    updateConversationPreview(selectedConversation.value.id, text, 'OUTBOUND')
  } catch (err: any) {
    tempMsg.status = 'FAILED'
    toast.error('Error enviando mensaje')
  } finally {
    sendingMessage.value = false
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !selectedConversation.value) return
  target.value = '' // reset so same file can be re-selected

  sendingMedia.value = true
  const isImage = file.type.startsWith('image/')

  // Optimistic: show temp message
  const tempMsg = {
    id: 'temp-media-' + Date.now(),
    direction: 'OUTBOUND',
    content: `📎 ${file.name}`,
    messageType: isImage ? 'image' : 'document',
    mediaUrl: isImage ? URL.createObjectURL(file) : null,
    isFromAi: false,
    status: 'SENDING',
    createdAt: new Date().toISOString(),
    metadata: { originalFilename: file.name, mimeType: file.type },
  }
  messages.value.push(tempMsg)
  await nextTick()
  scrollToBottom()

  try {
    const formData = new FormData()
    formData.append('file', file)

    const res = await api.postFormData<any>(
      `/chatbot/conversations/${selectedConversation.value.id}/messages/media`,
      formData
    )
    // Replace temp message
    const idx = messages.value.findIndex(m => m.id === tempMsg.id)
    if (idx !== -1) messages.value.splice(idx, 1, res.data)

    updateConversationPreview(selectedConversation.value.id, `📎 ${file.name}`, 'OUTBOUND')
  } catch (err: any) {
    tempMsg.status = 'FAILED'
    toast.error('Error enviando archivo')
  } finally {
    sendingMedia.value = false
  }
}

const isImageMessage = (msg: any) => {
  return msg.messageType === 'image' || (msg.mediaUrl && /\.(jpg|jpeg|png|webp|gif)$/i.test(msg.mediaUrl))
}

const getBackendUrl = (relativePath: string) => {
  if (!relativePath) return ''
  if (relativePath.startsWith('http') || relativePath.startsWith('blob:')) return relativePath
  // Relative path from backend → prepend API base origin
  const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'
  const base = apiUrl.replace('/api/v1', '')
  return `${base}${relativePath}`
}

const openMediaPreview = (url: string) => {
  mediaPreviewUrl.value = getBackendUrl(url)
  showMediaPreview.value = true
}

const switchMode = async (mode: string) => {
  if (!selectedConversation.value || switchingMode.value) return
  if (selectedConversation.value.controlMode === mode) return // Already in this mode

  switchingMode.value = true
  const previousMode = selectedConversation.value.controlMode

  // Optimistic update on BOTH the selected conversation AND the conversations list
  selectedConversation.value.controlMode = mode
  const listConv = conversations.value.find(c => c.id === selectedConversation.value.id)
  if (listConv) listConv.controlMode = mode

  try {
    await api.put<any>(`/chatbot/conversations/${selectedConversation.value.id}/control`, { mode })
    toast.success(`Modo cambiado a ${mode === 'AI' ? 'IA' : mode === 'HUMAN' ? 'Humano' : 'Pausado'}`)
  } catch (err: any) {
    // Rollback on failure
    selectedConversation.value.controlMode = previousMode
    if (listConv) listConv.controlMode = previousMode
    toast.error('Error cambiando modo')
  } finally {
    switchingMode.value = false
  }
}



const fetchNotes = async () => {
  if (!selectedConversation.value) return
  try {
    const res = await api.get<any>(`/chatbot/conversations/${selectedConversation.value.id}/notes`)
    notes.value = res.data || []
  } catch (err: any) {
    console.error('Failed to load notes', err)
  }
}

const addNote = async () => {
  if (!newNote.value.trim() || !selectedConversation.value) return
  try {
    const res = await api.post<any>(`/chatbot/conversations/${selectedConversation.value.id}/notes`, { content: newNote.value.trim() })
    notes.value.unshift(res.data)
    newNote.value = ''
  } catch (err: any) {
    toast.error('Error añadiendo nota')
  }
}

const loadQuickReplies = async () => {
  try {
    const res = await api.get<any>('/chatbot/quick-replies')
    quickReplies.value = res.data || []
  } catch (err: any) {
    console.error('Failed to load quick replies', err)
  }
}

const useQuickReply = (qr: any) => {
  newMessage.value = qr.content
  showQuickReplies.value = false
}

// Helper: update conversation preview in sidebar without re-fetching
const updateConversationPreview = (conversationId: string, text: string, direction: string, isFromAi = false) => {
  const conv = conversations.value.find(c => c.id === conversationId)
  if (conv) {
    conv.lastMessage = {
      content: text?.substring(0, 100) || '',
      direction,
      isFromAi,
      createdAt: new Date().toISOString(),
    }
    conv.lastMessageAt = new Date().toISOString()

    // Move to top of list
    const idx = conversations.value.indexOf(conv)
    if (idx > 0) {
      conversations.value.splice(idx, 1)
      conversations.value.unshift(conv)
    }
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const formatTime = (date: string) => {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

const getContactInitials = (conv: any) => {
  const name = conv.waContactName || conv.waContactPhone || '?'
  return name.substring(0, 2).toUpperCase()
}

const getModeColor = (mode: string) => {
  switch (mode) {
    case 'AI': return 'bg-violet-100 text-violet-700'
    case 'HUMAN': return 'bg-blue-100 text-blue-700'
    case 'PAUSED': return 'bg-amber-100 text-amber-700'
    default: return 'bg-surface-100 text-surface-600'
  }
}

const getModeLabel = (mode: string) => {
  switch (mode) {
    case 'AI': return 'IA'
    case 'HUMAN': return 'Humano'
    case 'PAUSED': return 'Pausado'
    default: return mode
  }
}

// ============================================================================
// WebSocket Handlers (real-time, no polling)
// ============================================================================

/** New inbound message → append to chat + update sidebar */
const handleNewMessage = async (data: any) => {
  const { conversationId, message: msgData } = data

  // Update sidebar preview
  if (conversationId && msgData) {
    updateConversationPreview(conversationId, msgData.content, msgData.direction, msgData.isFromAi)

    // Increment unread count only for inbound messages when not viewing this conversation
    const conv = conversations.value.find(c => c.id === conversationId)
    if (conv && selectedConversation.value?.id !== conversationId && msgData.direction === 'INBOUND') {
      conv.unreadCount = (conv.unreadCount || 0) + 1
    }
  }

  // If we're viewing this conversation, append the message directly
  if (selectedConversation.value?.id === conversationId && msgData) {
    // Avoid duplicate (the optimistic message from sendMessage)
    const exists = messages.value.some(m => m.id === msgData.id)
    if (!exists) {
      messages.value.push(msgData)
      await nextTick()
      scrollToBottom()

      // Mark as read immediately
      api.put(`/chatbot/conversations/${conversationId}/read`).catch(() => {})
    }
  }

  // If conversation is new (not in our list), fetch conversations to pick it up
  if (conversationId && !conversations.value.find(c => c.id === conversationId)) {
    fetchConversations()
  }
}

/** Conversation metadata changed (mode switch, close, etc.) */
const handleConversationUpdated = (data: any) => {
  const { conversationId, controlMode, status } = data

  // Update in conversations list
  const conv = conversations.value.find(c => c.id === conversationId)
  if (conv) {
    if (controlMode) conv.controlMode = controlMode
    if (status) conv.status = status
  }

  // Update selected conversation if it matches
  if (selectedConversation.value?.id === conversationId) {
    if (controlMode) selectedConversation.value.controlMode = controlMode
    if (status) selectedConversation.value.status = status
  }
}

/** Resync conversations when tab becomes visible (instead of polling) */
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    fetchConversations()
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

let unsubNewMessage: (() => void) | null = null
let unsubConversationUpdated: (() => void) | null = null

onMounted(() => {
  fetchConversations()
  loadQuickReplies()

  // WebSocket listeners (no polling)
  unsubNewMessage = onSocketEvent('chatbot:new-message', handleNewMessage as (data: unknown) => void)
  unsubConversationUpdated = onSocketEvent('chatbot:conversation-updated', handleConversationUpdated as (data: unknown) => void)

  // Resync on tab focus
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  if (unsubNewMessage) unsubNewMessage()
  if (unsubConversationUpdated) unsubConversationUpdated()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

watch(filterStatus, () => fetchConversations())
watch(filterMode, () => fetchConversations())
</script>

<template>
  <div class="whatsapp-chat-container">
    <!-- Header -->
    <div class="chat-header">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
          <ChatBubbleLeftRightSolidIcon class="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-surface-900">WhatsApp</h1>
          <p class="text-xs text-surface-500">{{ conversationCounts.all }} conversaciones</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="hidden lg:flex items-center gap-1 text-xs text-surface-400 bg-surface-100 px-2.5 py-1 rounded-full" title="Los mensajes con más de 2 meses se eliminan automáticamente, conservando los últimos 100 por conversación">
          <ClockIcon class="w-3.5 h-3.5" />
          Retención: 2 meses
        </span>
        <router-link to="/clinic/whatsapp/knowledge" class="btn-ghost text-surface-600 text-sm gap-1.5">
          <BookOpenIcon class="w-4 h-4" />
          <span class="hidden sm:inline">Base de Conocimiento</span>
        </router-link>
        <router-link to="/clinic/whatsapp/leads" class="btn-ghost text-surface-600 text-sm gap-1.5">
          <UserGroupIcon class="w-4 h-4" />
          <span class="hidden sm:inline">Leads</span>
        </router-link>
        <router-link to="/clinic/whatsapp/settings" class="btn-ghost text-surface-600 text-sm gap-1.5">
          <Cog6ToothIcon class="w-4 h-4" />
          <span class="hidden sm:inline">Config</span>
        </router-link>
      </div>
    </div>

    <div class="chat-layout">
      <!-- LEFT: Conversation List -->
      <div :class="['conversation-sidebar', showMobileChat ? 'hidden lg:flex' : 'flex']">
        <!-- Filters -->
        <div class="p-3 border-b border-surface-200 space-y-2">
          <div class="relative">
            <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar conversación..."
              class="input w-full pl-9 text-sm h-9"
            />
          </div>
          <div class="flex gap-1.5 flex-wrap">
            <button
              v-for="s in [
                { value: '', label: 'Todas', count: conversationCounts.all },
                { value: 'AI', label: 'IA', count: conversationCounts.ai },
                { value: 'HUMAN', label: 'Humano', count: conversationCounts.human },
              ]"
              :key="s.value"
              @click="filterStatus = s.value"
              :class="[
                'px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
                filterStatus === s.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              ]"
            >
              {{ s.label }}
              <span class="ml-1 opacity-70">{{ s.count }}</span>
            </button>
          </div>
        </div>

        <!-- Conversation List -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="filteredConversations.length === 0" class="p-6 text-center">
            <ChatBubbleLeftRightIcon class="w-12 h-12 mx-auto text-surface-300 mb-3" />
            <p class="text-sm text-surface-500">No hay conversaciones</p>
            <p class="text-xs text-surface-400 mt-1">Las conversaciones aparecerán aquí cuando los pacientes envíen mensajes por WhatsApp.</p>
          </div>
          <button
            v-for="conv in filteredConversations"
            :key="conv.id"
            @click="selectConversation(conv)"
            :class="[
              'w-full p-3 flex gap-3 border-b border-surface-100 hover:bg-surface-50 transition-colors text-left',
              selectedConversation?.id === conv.id ? 'bg-primary-50 border-l-3 border-l-primary-500' : ''
            ]"
          >
            <!-- Avatar -->
            <div class="relative flex-shrink-0">
              <div class="w-11 h-11 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
                {{ getContactInitials(conv) }}
              </div>
              <span v-if="conv.patientId" class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                <CheckIcon class="w-2.5 h-2.5 text-white" />
              </span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="font-medium text-sm text-surface-900 truncate">
                  {{ conv.waContactName || conv.waContactPhone }}
                </span>
                <span class="text-[10px] text-surface-400 ml-2 flex-shrink-0">
                  {{ formatTime(conv.lastMessageAt) }}
                </span>
              </div>
              <div class="flex items-center justify-between mt-0.5">
                <p class="text-xs text-surface-500 truncate">
                  {{ conv.lastMessage?.content || 'Sin mensajes' }}
                </p>
                <div class="flex items-center gap-1 ml-2 flex-shrink-0">
                  <span :class="['text-[9px] px-1.5 py-0.5 rounded-full font-medium', getModeColor(conv.controlMode)]">
                    {{ getModeLabel(conv.controlMode) }}
                  </span>
                  <span v-if="conv.unreadCount > 0" class="w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {{ conv.unreadCount > 9 ? '9+' : conv.unreadCount }}
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- RIGHT: Chat Area -->
      <div :class="['chat-area', !showMobileChat ? 'hidden lg:flex' : 'flex']">
        <!-- No conversation selected -->
        <div v-if="!selectedConversation" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center mb-4">
              <ChatBubbleLeftRightIcon class="w-10 h-10 text-green-400" />
            </div>
            <h3 class="text-lg font-semibold text-surface-700">Selecciona una conversación</h3>
            <p class="text-sm text-surface-400 mt-1">Elige una conversación del panel izquierdo para comenzar</p>
          </div>
        </div>

        <!-- Active Chat -->
        <template v-else>
          <!-- Chat Header -->
          <div class="chat-area-header">
            <div class="flex items-center gap-3">
              <button @click="showMobileChat = false; selectedConversation = null" class="lg:hidden p-1">
                <XMarkIcon class="w-5 h-5 text-surface-500" />
              </button>
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
                {{ getContactInitials(selectedConversation) }}
              </div>
              <div>
                <h3 class="font-semibold text-sm text-surface-900">
                  {{ selectedConversation.waContactName || selectedConversation.waContactPhone }}
                </h3>
                <div class="flex items-center gap-2 text-xs text-surface-500">
                  <PhoneIcon class="w-3 h-3" />
                  {{ selectedConversation.waContactPhone }}
                  <span v-if="selectedConversation.patientId" class="text-blue-600 font-medium">• Paciente</span>
                  <span v-else class="text-amber-600 font-medium">• Lead</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <!-- Mode controls -->
              <button
                @click="switchMode('AI')"
                :class="['mode-btn', selectedConversation.controlMode === 'AI' ? 'mode-btn-active-ai' : '']"
                title="Modo IA"
              >
                <SparklesIcon class="w-4 h-4" />
                <span class="hidden sm:inline text-xs">IA</span>
              </button>
              <button
                @click="switchMode('HUMAN')"
                :class="['mode-btn', selectedConversation.controlMode === 'HUMAN' ? 'mode-btn-active-human' : '']"
                title="Modo Humano"
              >
                <HandRaisedIcon class="w-4 h-4" />
                <span class="hidden sm:inline text-xs">Humano</span>
              </button>
              <button
                @click="switchMode('PAUSED')"
                :class="['mode-btn', selectedConversation.controlMode === 'PAUSED' ? 'mode-btn-active-paused' : '']"
                title="Pausar"
              >
                <PauseIcon class="w-4 h-4" />
              </button>
              <div class="w-px h-6 bg-surface-200 mx-1"></div>
              <button @click="showNotes = !showNotes; if(showNotes) fetchNotes()" class="mode-btn" title="Notas">
                <PencilSquareIcon class="w-4 h-4" />
              </button>

            </div>
          </div>

          <!-- Messages -->
          <div ref="messagesContainer" class="chat-messages">
            <div v-if="loadingMessages" class="flex items-center justify-center py-8">
              <ArrowPathIcon class="w-6 h-6 text-surface-400 animate-spin" />
            </div>
            <template v-else>
              <div v-if="messages.length === 0" class="text-center py-8">
                <p class="text-sm text-surface-400">No hay mensajes aún</p>
              </div>
              <div
                v-for="msg in messages"
                :key="msg.id"
                :class="['message-row', msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start']"
              >
                <div :class="[
                  'message-bubble',
                  msg.direction === 'OUTBOUND'
                    ? msg.isFromAi ? 'msg-ai' : 'msg-outbound'
                    : 'msg-inbound'
                ]">
                  <div v-if="msg.isFromAi" class="flex items-center gap-1 mb-1">
                    <SparklesIcon class="w-3 h-3 text-violet-500" />
                    <span class="text-[10px] font-medium text-violet-500">Respuesta IA</span>
                  </div>

                  <!-- Media: Image -->
                  <div v-if="isImageMessage(msg) && msg.mediaUrl" class="mb-1">
                    <img
                      :src="getBackendUrl(msg.mediaUrl)"
                      alt="Imagen"
                      class="rounded-lg max-w-[240px] max-h-[240px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      @click="openMediaPreview(msg.mediaUrl)"
                    />
                  </div>

                  <!-- Media: Document -->
                  <div v-else-if="msg.messageType === 'document' && msg.mediaUrl" class="mb-1">
                    <a
                      :href="getBackendUrl(msg.mediaUrl)"
                      target="_blank"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <DocumentIcon class="w-5 h-5 flex-shrink-0" />
                      <span class="text-sm truncate">{{ msg.metadata?.originalFilename || 'Documento' }}</span>
                    </a>
                  </div>

                  <!-- Media: Audio / Voice note -->
                  <div v-else-if="(msg.messageType === 'audio' || msg.messageType === 'voice') && msg.mediaUrl" class="mb-1">
                    <audio
                      controls
                      preload="metadata"
                      class="max-w-[260px] h-10"
                    >
                      <source :src="getBackendUrl(msg.mediaUrl)" />
                      Tu navegador no soporta audio.
                    </audio>
                  </div>

                  <!-- Media: Video -->
                  <div v-else-if="msg.messageType === 'video' && msg.mediaUrl" class="mb-1">
                    <video
                      controls
                      preload="metadata"
                      class="rounded-lg max-w-[260px] max-h-[260px]"
                    >
                      <source :src="getBackendUrl(msg.mediaUrl)" />
                      Tu navegador no soporta vídeo.
                    </video>
                  </div>

                  <p v-if="msg.content && !(isImageMessage(msg) && !msg.metadata?.caption && msg.mediaUrl)" class="text-sm whitespace-pre-wrap">{{ msg.content }}</p>
                  <div class="flex items-center justify-end gap-1 mt-1">
                    <span class="text-[10px] opacity-60">{{ formatTime(msg.createdAt) }}</span>
                    <template v-if="msg.direction === 'OUTBOUND'">
                      <CheckIcon v-if="msg.status === 'SENT'" class="w-3 h-3 opacity-50" />
                      <span v-if="msg.status === 'DELIVERED'" class="text-[10px] opacity-50">✓✓</span>
                      <span v-if="msg.status === 'READ'" class="text-[10px] text-blue-400">✓✓</span>
                      <span v-if="msg.status === 'FAILED'" class="text-[10px] text-danger-500">✗</span>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Notes Sidebar -->
          <div v-if="showNotes" class="notes-sidebar">
            <div class="p-3 border-b border-surface-200 flex items-center justify-between">
              <h4 class="font-semibold text-sm text-surface-800">Notas internas</h4>
              <button @click="showNotes = false" class="p-1 hover:bg-surface-100 rounded">
                <XMarkIcon class="w-4 h-4 text-surface-400" />
              </button>
            </div>
            <div class="p-3">
              <div class="flex gap-2 mb-3">
                <input v-model="newNote" class="input flex-1 text-sm h-9" placeholder="Añadir nota..." @keyup.enter="addNote" />
                <button @click="addNote" class="btn-primary text-sm py-2 px-3">Añadir</button>
              </div>
              <div v-for="note in notes" :key="note.id" class="p-2 bg-amber-50 rounded-lg text-sm mb-2">
                <p class="text-surface-700 whitespace-pre-wrap">{{ note.content }}</p>
                <p class="text-[10px] text-surface-400 mt-1">{{ formatTime(note.createdAt) }}</p>
              </div>
            </div>
          </div>

          <!-- Input area -->
          <div class="chat-input-area">
            <!-- Quick replies toggle -->
            <div v-if="showQuickReplies && quickReplies.length > 0" class="px-4 py-2 border-b border-surface-100 bg-surface-50">
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="qr in quickReplies"
                  :key="qr.id"
                  @click="useQuickReply(qr)"
                  class="text-xs px-2.5 py-1 bg-white border border-surface-200 rounded-full hover:bg-primary-50 hover:border-primary-300 transition-colors"
                >
                  {{ qr.title }}
                </button>
              </div>
            </div>
            <!-- Hidden file input -->
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.docx,.xlsx,.doc,.xls"
              class="hidden"
              @change="handleFileSelect"
            />
            <div class="flex items-end gap-2 p-3">
              <button
                @click="showQuickReplies = !showQuickReplies"
                class="p-2 hover:bg-surface-100 rounded-lg transition-colors flex-shrink-0"
                title="Respuestas rápidas"
              >
                <EllipsisVerticalIcon class="w-5 h-5 text-surface-400" />
              </button>
              <button
                @click="triggerFileInput"
                :disabled="sendingMedia"
                class="p-2 hover:bg-surface-100 rounded-lg transition-colors flex-shrink-0"
                title="Adjuntar archivo"
              >
                <PaperClipIcon class="w-5 h-5 text-surface-400" />
              </button>
              <div class="flex-1 relative">
                <textarea
                  v-model="newMessage"
                  @keydown.enter.exact="sendMessage"
                  placeholder="Escribe un mensaje..."
                  rows="1"
                  class="input w-full resize-none text-sm pr-10"
                  :disabled="sendingMessage || sendingMedia"
                  style="min-height: 40px; max-height: 120px;"
                ></textarea>
              </div>
              <button
                @click="sendMessage"
                :disabled="!newMessage.trim() || sendingMessage || sendingMedia"
                class="p-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <PaperAirplaneIcon class="w-5 h-5" />
              </button>
            </div>
          </div>

        </template>
      </div>
    </div>

    <!-- Image Preview Modal -->
    <Teleport to="body">
      <div v-if="showMediaPreview" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click.self="showMediaPreview = false">
        <button @click="showMediaPreview = false" class="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors">
          <XMarkIcon class="w-6 h-6" />
        </button>
        <img :src="mediaPreviewUrl" alt="Preview" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.whatsapp-chat-container {
  @apply -m-6 -mt-8 h-[calc(100vh-0px)] lg:h-[calc(100vh-0px)] flex flex-col bg-white;
}

.chat-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-surface-200 bg-white z-10 flex-shrink-0;
}

.chat-layout {
  @apply flex-1 flex overflow-hidden;
}

.conversation-sidebar {
  @apply w-full lg:w-80 xl:w-96 flex-col border-r border-surface-200 bg-white flex-shrink-0;
}

.chat-area {
  @apply flex-1 flex-col bg-surface-50 min-w-0;
}

.chat-area-header {
  @apply flex items-center justify-between px-4 py-2.5 bg-white border-b border-surface-200 flex-shrink-0;
}

.chat-messages {
  @apply flex-1 overflow-y-auto p-4 space-y-2;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.chat-input-area {
  @apply bg-white border-t border-surface-200 flex-shrink-0;
}

.message-row {
  @apply flex;
}

.message-bubble {
  @apply max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm;
}

.msg-inbound {
  @apply bg-white text-surface-800 rounded-bl-md;
}

.msg-outbound {
  @apply bg-green-500 text-white rounded-br-md;
}

.msg-ai {
  @apply bg-violet-50 text-surface-800 border border-violet-200 rounded-br-md;
}

.mode-btn {
  @apply flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-surface-600 hover:bg-surface-100 transition-colors;
}

.mode-btn-active-ai {
  @apply bg-violet-100 text-violet-700 hover:bg-violet-200;
}

.mode-btn-active-human {
  @apply bg-blue-100 text-blue-700 hover:bg-blue-200;
}

.mode-btn-active-paused {
  @apply bg-amber-100 text-amber-700 hover:bg-amber-200;
}

.notes-sidebar {
  @apply w-72 border-l border-surface-200 bg-white flex-shrink-0 overflow-y-auto hidden lg:block;
}
</style>
