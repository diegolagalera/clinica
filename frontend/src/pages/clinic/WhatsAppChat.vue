<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '@/services/api'
import { useToast } from '@/composables/useToast'
import { getTenantSlug } from '@/utils/tenant'
import { onSocketEvent, joinClinicRoom, leaveClinicRoom } from '@/services/websocket'
import { useAuthStore } from '@/stores/auth'
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
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  CheckIcon,
  EllipsisVerticalIcon,

  PhoneIcon,
  PaperClipIcon,
  DocumentIcon,
  ClockIcon,
  PlusIcon,
  ChatBubbleLeftEllipsisIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/vue/24/outline'
import {
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightSolidIcon,
} from '@heroicons/vue/24/solid'

const toast = useToast()
const router = useRouter()
const route = useRoute()

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
const quickReplies = ref<any[]>([])
const showQuickReplies = ref(false)
const showMobileChat = ref(false)
const messagesContainer = ref<HTMLDivElement>()
const fileInput = ref<HTMLInputElement>()
const sendingMedia = ref(false)
const mediaPreviewUrl = ref('')
const showMediaPreview = ref(false)
const showDeleteConfirm = ref(false)
const deletingConversation = ref(false)

// AI status banner
const aiStatus = ref<{ active: boolean; reason: string | null }>({ active: true, reason: null })

// Template modal state
const showTemplateModal = ref(false)
const templates = ref<any[]>([])
const loadingTemplates = ref(false)
const selectedTemplate = ref<any>(null)
const templatePhone = ref('')
const templateVariables = ref<string[]>([])
const sendingTemplate = ref(false)

// Computed
const filteredConversations = computed(() => {
  let result = conversations.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(c =>
      (c.patientName || '').toLowerCase().includes(q) ||
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
  return msg.messageType === 'image' || msg.messageType === 'sticker' || (msg.mediaUrl && /\.(jpg|jpeg|png|webp|gif)$/i.test(msg.mediaUrl))
}

const getBackendUrl = (mediaPath: string) => {
  if (!mediaPath) return ''
  if (mediaPath.startsWith('http') || mediaPath.startsWith('blob:')) return mediaPath
  // Legacy: /uploads/... paths (backwards compat during migration)
  if (mediaPath.startsWith('/uploads/')) {
    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'
    const base = apiUrl.replace('/api/v1', '')
    return `${base}${mediaPath}`
  }
  // S3 key → serve via /api/v1/media/{key}?t={tenantSlug}
  const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'
  const base = apiUrl.replace('/api/v1', '')
  const slug = getTenantSlug()
  const tenantParam = slug ? `?t=${slug}` : ''
  return `${base}/api/v1/media/${mediaPath}${tenantParam}`
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
  const name = conv.patientName || conv.waContactName || conv.waContactPhone || '?'
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
// Delete Conversation
// ============================================================================

async function deleteConversation() {
  if (!selectedConversation.value) return
  deletingConversation.value = true
  try {
    await api.delete(`/chatbot/conversations/${selectedConversation.value.id}`)
    toast.success('Conversación eliminada')
    showDeleteConfirm.value = false
    selectedConversation.value = null
    messages.value = []
    showMobileChat.value = false
    await fetchConversations()
  } catch (err) {
    toast.error('Error al eliminar la conversación')
  } finally {
    deletingConversation.value = false
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
// Template methods
// ============================================================================

const openTemplateModal = async () => {
  showTemplateModal.value = true
  selectedTemplate.value = null
  templatePhone.value = ''
  templateVariables.value = []
  loadingTemplates.value = true
  try {
    const res = await api.get<any>('/chatbot/templates')
    templates.value = res.data || []
  } catch (err: any) {
    toast.error('Error cargando plantillas')
    templates.value = []
  } finally {
    loadingTemplates.value = false
  }
}

const selectTemplate = (tpl: any) => {
  selectedTemplate.value = tpl
  // Count variables in BODY component
  const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY')
  const bodyText = bodyComp?.text || ''
  const matches = bodyText.match(/\{\{\d+\}\}/g) || []
  templateVariables.value = Array(matches.length).fill('')
}

const getTemplatePreview = (tpl: any) => {
  const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY')
  return bodyComp?.text || tpl.name
}

const getFilledPreview = () => {
  if (!selectedTemplate.value) return ''
  let text = getTemplatePreview(selectedTemplate.value)
  templateVariables.value.forEach((val, i) => {
    text = text.replace(`{{${i + 1}}}`, val || `{{${i + 1}}}`)
  })
  return text
}

const sendTemplateMessage = async () => {
  if (!templatePhone.value || !selectedTemplate.value) return

  sendingTemplate.value = true
  try {
    // Build components array for Meta API
    const components: any[] = []
    if (templateVariables.value.length > 0) {
      components.push({
        type: 'body',
        parameters: templateVariables.value.map(v => ({
          type: 'text',
          text: v
        }))
      })
    }

    // Clean phone number
    const phone = templatePhone.value.replace(/[^\d+]/g, '')

    await api.post<any>('/chatbot/conversations/send-template', {
      phone,
      templateName: selectedTemplate.value.name,
      languageCode: selectedTemplate.value.language || 'es',
      components,
      templateBody: getFilledPreview()
    })

    toast.success('Plantilla enviada correctamente')
    showTemplateModal.value = false

    // Refresh conversations to show the new/updated one
    await fetchConversations()
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Error enviando plantilla')
  } finally {
    sendingTemplate.value = false
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

let unsubNewMessage: (() => void) | null = null
let unsubConversationUpdated: (() => void) | null = null
let unsubAiStatus: (() => void) | null = null

const fetchAiStatus = async () => {
  try {
    const res = await api.get<any>('/chatbot/ai-status')
    if (res.data) {
      aiStatus.value = { active: res.data.active, reason: res.data.reason }
    }
  } catch { /* ignore */ }
}

onMounted(async () => {
  await fetchConversations()
  loadQuickReplies()
  fetchAiStatus()

  // Auto-select conversation matching phone query param (from PatientDetail link)
  const phoneParam = route.query.phone as string | undefined
  if (phoneParam) {
    const normalizedPhone = phoneParam.replace(/^\+/, '')
    const match = conversations.value.find(c => {
      const convPhone = (c.waContactPhone || '').replace(/^\+/, '')
      return convPhone === normalizedPhone
    })
    if (match) {
      selectConversation(match)
    } else {
      // No existing conversation — open template modal with phone pre-filled
      await openTemplateModal()
      templatePhone.value = phoneParam
    }
    // Clean up query param so it doesn't persist on refresh
    router.replace({ query: {} })
  }

  // WebSocket listeners (no polling)
  unsubNewMessage = onSocketEvent('chatbot:new-message', handleNewMessage as (data: unknown) => void)
  unsubConversationUpdated = onSocketEvent('chatbot:conversation-updated', handleConversationUpdated as (data: unknown) => void)
  unsubAiStatus = onSocketEvent('chatbot:ai-status', (data: any) => {
    aiStatus.value = { active: data.active, reason: data.reason }
  })

  // Join clinic room for real-time chatbot events
  const authStore = useAuthStore()
  if (authStore.currentClinicId) {
    joinClinicRoom(authStore.currentClinicId)
  }

  // Resync on tab focus
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  if (unsubNewMessage) unsubNewMessage()
  if (unsubConversationUpdated) unsubConversationUpdated()
  if (unsubAiStatus) unsubAiStatus()
  leaveClinicRoom()
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
        <button
          @click="openTemplateModal"
          class="btn-primary text-sm gap-1.5 px-3 py-1.5"
        >
          <PlusIcon class="w-4 h-4" />
          <span class="hidden sm:inline">Nueva conversación</span>
        </button>
        <div class="hidden lg:flex relative group">
          <span class="flex items-center gap-1 text-xs text-surface-400 bg-surface-100 px-2.5 py-1 rounded-full cursor-help">
            <ClockIcon class="w-3.5 h-3.5" />
            Retención: 2 meses
          </span>
          <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-surface-800 text-white text-xs rounded-xl px-4 py-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
            <p class="font-semibold mb-1.5">Política de retención</p>
            <p class="text-surface-300 leading-relaxed">Los mensajes con más de <span class="text-white font-medium">2 meses</span> se eliminan automáticamente, conservando los últimos <span class="text-white font-medium">100</span> por conversación.</p>
            <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
          </div>
        </div>
        <div class="hidden lg:flex relative group">
          <span class="flex items-center gap-1 text-xs bg-blue-50 text-blue-500 px-2.5 py-1 rounded-full cursor-help">
            <InformationCircleIcon class="w-3.5 h-3.5" />
            IA: 7/2min · 60/día
          </span>
          <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-surface-800 text-white text-xs rounded-xl px-4 py-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
            <p class="font-semibold mb-1.5">Límites de IA por contacto</p>
            <ul class="space-y-1 text-surface-300">
              <li>• Máx. <span class="text-white font-medium">7 respuestas</span> cada 2 minutos</li>
              <li>• Máx. <span class="text-white font-medium">60 respuestas</span> al día</li>
            </ul>
            <p class="mt-2 text-surface-400 text-[10px] leading-relaxed">Los mensajes que superen el límite no tendrán respuesta automática pero quedarán guardados para respuesta manual.</p>
            <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-800 rotate-45 rounded-sm"></div>
          </div>
        </div>
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

    <!-- AI Status Banner -->
    <div v-if="!aiStatus.active" class="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm font-medium">
      <ExclamationTriangleIcon class="w-5 h-5 text-red-500 flex-shrink-0" />
      <span>{{ aiStatus.reason || 'La IA no está disponible. Los mensajes no se responderán automáticamente.' }}</span>
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
                  {{ conv.patientName || conv.waContactName || conv.waContactPhone }}
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
                  {{ selectedConversation.patientName || selectedConversation.waContactName || selectedConversation.waContactPhone }}
                </h3>
                <div class="flex items-center gap-2 text-xs text-surface-500">
                  <PhoneIcon class="w-3 h-3" />
                  {{ selectedConversation.waContactPhone }}
                  <template v-if="selectedConversation.patientId">
                    <span class="text-blue-600 font-medium">• Paciente</span>
                    <button
                      @click="router.push(`/clinic/patients/${selectedConversation.patientId}`)"
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors font-medium"
                      title="Ver ficha del paciente"
                    >
                      <UserIcon class="w-3 h-3" />
                      Ver ficha
                    </button>
                  </template>
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
              <button @click="showDeleteConfirm = true" class="mode-btn text-red-500 hover:bg-red-50" title="Eliminar conversación">
                <TrashIcon class="w-4 h-4" />
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

    <!-- Template Selector Modal -->
    <Teleport to="body">
      <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="showTemplateModal = false">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-surface-200">
            <div class="flex items-center gap-2">
              <ChatBubbleLeftEllipsisIcon class="w-5 h-5 text-green-500" />
              <h3 class="text-lg font-semibold text-surface-900">Nueva conversación</h3>
            </div>
            <button @click="showTemplateModal = false" class="p-1.5 hover:bg-surface-100 rounded-lg transition-colors">
              <XMarkIcon class="w-5 h-5 text-surface-500" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <!-- Phone -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Teléfono del paciente</label>
              <input
                v-model="templatePhone"
                type="tel"
                placeholder="+34612345678"
                class="input w-full"
              />
              <p class="text-xs text-surface-400 mt-1">Formato internacional con prefijo (ej. +34...)</p>
            </div>

            <!-- Template selector -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Selecciona una plantilla</label>
              <div v-if="loadingTemplates" class="text-center py-4 text-surface-400 text-sm">Cargando plantillas...</div>
              <div v-else-if="templates.length === 0" class="text-center py-4 text-surface-400 text-sm">
                No hay plantillas aprobadas. Crea plantillas en Meta Business Suite.
              </div>
              <div v-else class="space-y-2 max-h-48 overflow-y-auto">
                <button
                  v-for="tpl in templates"
                  :key="tpl.id"
                  @click="selectTemplate(tpl)"
                  :class="[
                    'w-full text-left p-3 rounded-lg border transition-all',
                    selectedTemplate?.id === tpl.id
                      ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                      : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                  ]"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-sm text-surface-800">{{ tpl.name }}</span>
                    <span class="text-xs text-surface-400 uppercase">{{ tpl.category }}</span>
                  </div>
                  <p class="text-xs text-surface-500 mt-1 line-clamp-2">{{ getTemplatePreview(tpl) }}</p>
                </button>
              </div>
            </div>

            <!-- Variables -->
            <div v-if="selectedTemplate && templateVariables.length > 0">
              <label class="block text-sm font-medium text-surface-700 mb-1">Variables</label>
              <div class="space-y-2">
                <div v-for="(_, i) in templateVariables" :key="i">
                  <label class="text-xs text-surface-500 mb-0.5 block">Variable {{ i + 1 }}</label>
                  <input
                    v-model="templateVariables[i]"
                    type="text"
                    :placeholder="`Valor para {{${i + 1}}}`"
                    class="input w-full text-sm"
                  />
                </div>
              </div>
            </div>

            <!-- Preview -->
            <div v-if="selectedTemplate" class="bg-green-50 rounded-lg p-3">
              <p class="text-xs font-medium text-green-700 mb-1">Vista previa:</p>
              <p class="text-sm text-surface-700 whitespace-pre-wrap">{{ getFilledPreview() }}</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-5 border-t border-surface-200">
            <button
              @click="sendTemplateMessage"
              :disabled="!templatePhone || !selectedTemplate || sendingTemplate"
              class="btn-primary w-full justify-center gap-2"
            >
              <PaperAirplaneIcon class="w-4 h-4" />
              {{ sendingTemplate ? 'Enviando...' : 'Enviar plantilla' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
          <div class="p-6 text-center">
            <div class="w-14 h-14 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
              <TrashIcon class="w-7 h-7 text-red-600" />
            </div>
            <h3 class="text-lg font-bold text-surface-900">¿Eliminar conversación?</h3>
            <p class="text-sm text-surface-500 mt-2">
              Se eliminarán todos los mensajes y notas de esta conversación.
              <strong class="text-surface-700">Esta acción no se puede deshacer.</strong>
            </p>
          </div>
          <div class="flex border-t border-surface-200">
            <button
              @click="showDeleteConfirm = false"
              class="flex-1 py-3 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="deleteConversation"
              :disabled="deletingConversation"
              class="flex-1 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border-l border-surface-200"
            >
              {{ deletingConversation ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </div>
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
</style>
