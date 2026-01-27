<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/services/api'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PhotoIcon,
  DocumentTextIcon,
  LinkIcon,
  MinusIcon,
  EyeIcon,
  CheckIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ArrowUpTrayIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()

// Block types
type BlockType = 'header' | 'logo' | 'text' | 'button' | 'divider' | 'spacer'

interface TemplateBlock {
  id: string
  type: BlockType
  content: {
    text?: string
    html?: string
    url?: string
    buttonText?: string
    buttonUrl?: string
    buttonColor?: string
    backgroundColor?: string
    textColor?: string
    alignment?: 'left' | 'center' | 'right'
    height?: number
  }
}

interface TemplateType {
  value: string
  label: string
}

// State
const templateId = computed(() => route.params.id as string | undefined)
const isEditing = computed(() => !!templateId.value)
const isLoading = ref(false)
const isSaving = ref(false)
const showPreview = ref(true)
const showTestModal = ref(false)
const testEmail = ref('')
const isSendingTest = ref(false)
const testMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// AI Generation state
const showAIModal = ref(false)
const aiPrompt = ref('')
const isGeneratingAI = ref(false)
const aiMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Form
const templateForm = ref({
  type: 'APPOINTMENT_CREATED',
  name: '',
  subject: '',
})

// Blocks
const blocks = ref<TemplateBlock[]>([])
const selectedBlockId = ref<string | null>(null)

// Template types
const templateTypes = ref<TemplateType[]>([])

// Available block types for sidebar
const availableBlocks: { type: BlockType; label: string; icon: any }[] = [
  { type: 'header', label: 'Encabezado', icon: DocumentTextIcon },
  { type: 'logo', label: 'Logo/Imagen', icon: PhotoIcon },
  { type: 'text', label: 'Texto', icon: DocumentTextIcon },
  { type: 'button', label: 'Botón', icon: LinkIcon },
  { type: 'divider', label: 'Separador', icon: MinusIcon },
  { type: 'spacer', label: 'Espacio', icon: MinusIcon },
]

// Variables for insertion
const variables = [
  { key: 'patient_name', label: 'Nombre paciente' },
  { key: 'appointment_date', label: 'Fecha cita' },
  { key: 'appointment_time', label: 'Hora cita' },
  { key: 'clinic_name', label: 'Nombre clínica' },
  { key: 'clinic_phone', label: 'Teléfono clínica' },
  { key: 'doctor_name', label: 'Nombre doctor' },
]

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9)

// Add block
const addBlock = (type: BlockType) => {
  const newBlock: TemplateBlock = {
    id: generateId(),
    type,
    content: getDefaultContent(type),
  }
  blocks.value.push(newBlock)
  selectedBlockId.value = newBlock.id
}

// Get default content for block type
const getDefaultContent = (type: BlockType): TemplateBlock['content'] => {
  switch (type) {
    case 'header':
      return {
        text: 'Título del email',
        backgroundColor: '#0891b2',
        textColor: '#ffffff',
        alignment: 'center',
      }
    case 'logo':
      return {
        url: '',
        alignment: 'center',
      }
    case 'text':
      return {
        html: '<p>Escribe tu texto aquí...</p>',
        alignment: 'left',
      }
    case 'button':
      return {
        buttonText: 'Confirmar Cita',
        buttonUrl: '#',
        buttonColor: '#0891b2',
        alignment: 'center',
      }
    case 'divider':
      return {}
    case 'spacer':
      return { height: 20 }
    default:
      return {}
  }
}

// Remove block
const removeBlock = (id: string) => {
  blocks.value = blocks.value.filter(b => b.id !== id)
  if (selectedBlockId.value === id) {
    selectedBlockId.value = null
  }
}

// Move block up/down
const moveBlock = (id: string, direction: 'up' | 'down') => {
  const index = blocks.value.findIndex(b => b.id === id)
  if (index === -1) return
  
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= blocks.value.length) return
  
  const block = blocks.value[index]
  blocks.value.splice(index, 1)
  blocks.value.splice(newIndex, 0, block)
}

// Select block
const selectBlock = (id: string) => {
  selectedBlockId.value = selectedBlockId.value === id ? null : id
}

// Get selected block
const selectedBlock = computed(() => {
  return blocks.value.find(b => b.id === selectedBlockId.value)
})

// Insert variable into text
const insertVariable = (varKey: string) => {
  const variable = `{{${varKey}}}`
  const blockIndex = blocks.value.findIndex(b => b.id === selectedBlockId.value)
  if (blockIndex === -1) return
  
  const block = blocks.value[blockIndex]
  if (block.type === 'text') {
    block.content.html = (block.content.html || '') + variable
  } else if (block.type === 'header') {
    block.content.text = (block.content.text || '') + variable
  }
}

// Update text block HTML content
const updateBlockHtml = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  const blockIndex = blocks.value.findIndex(b => b.id === selectedBlockId.value)
  if (blockIndex === -1) return
  
  blocks.value[blockIndex].content.html = target.value
}

// Handle logo image upload (converts to base64 for inline embedding)
const logoFileInput = ref<HTMLInputElement | null>(null)
const isUploadingLogo = ref(false)

const triggerLogoUpload = () => {
  logoFileInput.value?.click()
}

const handleLogoUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Por favor selecciona una imagen válida')
    return
  }
  
  // Validate file size (max 500KB for base64 embedding)
  if (file.size > 500 * 1024) {
    alert('La imagen es muy grande. El tamaño máximo es 500KB')
    return
  }
  
  isUploadingLogo.value = true
  
  try {
    // Convert to base64
    const reader = new FileReader()
    reader.onload = () => {
      const blockIndex = blocks.value.findIndex(b => b.id === selectedBlockId.value)
      if (blockIndex !== -1) {
        blocks.value[blockIndex].content.url = reader.result as string
      }
      isUploadingLogo.value = false
    }
    reader.onerror = () => {
      alert('Error al leer la imagen')
      isUploadingLogo.value = false
    }
    reader.readAsDataURL(file)
  } catch (err) {
    console.error('Error uploading logo:', err)
    isUploadingLogo.value = false
  }
  
  // Clear input so the same file can be selected again
  input.value = ''
}
const renderBlockHtml = (block: TemplateBlock): string => {
  switch (block.type) {
    case 'header':
      return `
        <div style="background-color: ${block.content.backgroundColor || '#0891b2'}; padding: 24px; text-align: ${block.content.alignment || 'center'};">
          <h1 style="color: ${block.content.textColor || '#ffffff'}; margin: 0; font-size: 24px; font-weight: bold;">
            ${block.content.text || 'Título'}
          </h1>
        </div>
      `
    case 'logo':
      if (!block.content.url) {
        return `
          <div style="padding: 20px; text-align: ${block.content.alignment || 'center'}; color: #9ca3af;">
            [Logo: Añade una URL de imagen]
          </div>
        `
      }
      return `
        <div style="padding: 20px; text-align: ${block.content.alignment || 'center'};">
          <img src="${block.content.url}" alt="Logo" style="max-width: 200px; max-height: 80px;" />
        </div>
      `
    case 'text':
      return `
        <div style="padding: 16px 24px; text-align: ${block.content.alignment || 'left'};">
          ${block.content.html || '<p>Texto...</p>'}
        </div>
      `
    case 'button':
      return `
        <div style="padding: 16px 24px; text-align: ${block.content.alignment || 'center'};">
          <a href="${block.content.buttonUrl || '#'}" style="display: inline-block; background-color: ${block.content.buttonColor || '#0891b2'}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            ${block.content.buttonText || 'Botón'}
          </a>
        </div>
      `
    case 'divider':
      return `
        <div style="padding: 16px 24px;">
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
        </div>
      `
    case 'spacer':
      return `<div style="height: ${block.content.height || 20}px;"></div>`
    default:
      return ''
  }
}

// Full preview HTML
const previewHtml = computed(() => {
  if (blocks.value.length === 0) {
    return '<div style="padding: 40px; text-align: center; color: #9ca3af;">Arrastra bloques aquí para empezar</div>'
  }
  
  const blocksHtml = blocks.value.map(renderBlockHtml).join('')
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      ${blocksHtml}
      <div style="padding: 16px; background-color: #f9fafb; text-align: center; font-size: 12px; color: #6b7280;">
        Este correo fue enviado por {{clinic_name}}
      </div>
    </div>
  `
})

// Load template types
const loadTemplateTypes = async () => {
  try {
    const response = await api.get<any>('/notifications/templates/types')
    templateTypes.value = response.data || []
  } catch {
    console.error('Error loading template types')
  }
}

// Load existing template for editing
const loadTemplate = async () => {
  if (!templateId.value) return
  
  isLoading.value = true
  try {
    const response = await api.get<any>(`/notifications/templates/${templateId.value}`)
    if (response.success && response.data) {
      templateForm.value = {
        type: response.data.type,
        name: response.data.name,
        subject: response.data.subject,
      }
      blocks.value = normalizeBlocks(response.data.blocks || [])
    }
  } catch {
    console.error('Error loading template')
  } finally {
    isLoading.value = false
  }
}

// Normalize blocks from backend format to frontend format
const normalizeBlocks = (backendBlocks: any[]): TemplateBlock[] => {
  return backendBlocks.map((block, index) => ({
    id: block.id || generateId(),
    type: block.type,
    content: {
      // Text content
      text: block.content?.text || block.text || (block.type === 'header' ? block.content : undefined),
      html: block.content?.html || (block.type === 'text' ? block.content : undefined),
      // Logo/image
      url: block.content?.url || block.url,
      // Button
      buttonText: block.content?.buttonText || block.content,
      buttonUrl: block.content?.buttonUrl || block.url,
      buttonColor: block.content?.buttonColor || block.backgroundColor || '#0891b2',
      // Styling
      backgroundColor: block.content?.backgroundColor || block.backgroundColor,
      textColor: block.content?.textColor || block.color,
      alignment: block.content?.alignment || block.align || 'left',
      height: block.content?.height || 20,
    }
  }))
}

// Load default template
const loadDefaultTemplate = async () => {
  try {
    const response = await api.get<any>(`/notifications/templates/default/${templateForm.value.type}`)
    if (response.success && response.data) {
      templateForm.value.subject = response.data.subject
      blocks.value = normalizeBlocks(response.data.blocks || [])
    }
  } catch {
    console.error('Error loading default template')
  }
}

// Save template
const saveTemplate = async () => {
  if (!templateForm.value.name || !templateForm.value.subject) {
    alert('Por favor completa el nombre y asunto')
    return
  }
  
  isSaving.value = true
  try {
    const payload = {
      ...templateForm.value,
      blocks: blocks.value,
    }
    
    if (isEditing.value) {
      await api.put(`/notifications/templates/${templateId.value}`, payload)
    } else {
      await api.post('/notifications/templates', payload)
    }
    
    router.push('/clinic/notifications')
  } catch (err) {
    console.error('Error saving template', err)
    alert('Error al guardar la plantilla')
  } finally {
    isSaving.value = false
  }
}

// Send test email with current template
const sendTestEmail = async () => {
  if (!testEmail.value) return
  
  isSendingTest.value = true
  testMessage.value = null
  
  try {
    // Build HTML from current blocks
    const html = previewHtml.value
    
    const response = await api.post<any>('/notifications/send-test', {
      email: testEmail.value,
      subject: `[PRUEBA] ${templateForm.value.subject || 'Plantilla de prueba'}`,
      html: html,
    })
    
    if (response.success) {
      testMessage.value = { type: 'success', text: '✅ Email de prueba enviado!' }
      setTimeout(() => {
        showTestModal.value = false
        testMessage.value = null
        testEmail.value = ''
      }, 2000)
    } else {
      testMessage.value = { type: 'error', text: response.message || 'Error al enviar' }
    }
  } catch (err: any) {
    testMessage.value = { type: 'error', text: err.message || 'Error al enviar el email' }
  } finally {
    isSendingTest.value = false
  }
}

// Generate template with AI
const generateWithAI = async () => {
  if (!aiPrompt.value.trim()) {
    aiMessage.value = { type: 'error', text: 'Por favor, describe la plantilla que deseas crear.' }
    return
  }

  isGeneratingAI.value = true
  aiMessage.value = null

  try {
    const response = await api.post<any>('/notifications/templates/generate', {
      prompt: aiPrompt.value
    })

    if (response.success && response.data) {
      // Replace blocks with AI-generated ones
      const generatedBlocks = normalizeBlocks(response.data.blocks || [])
      blocks.value = generatedBlocks
      
      // Update subject if provided
      if (response.data.subject) {
        templateForm.value.subject = response.data.subject
      }
      
      aiMessage.value = { type: 'success', text: `✨ Plantilla generada con ${generatedBlocks.length} bloques!` }
      
      setTimeout(() => {
        showAIModal.value = false
        aiMessage.value = null
        aiPrompt.value = ''
      }, 1500)
    } else {
      aiMessage.value = { type: 'error', text: response.message || 'Error al generar la plantilla' }
    }
  } catch (err: any) {
    aiMessage.value = { type: 'error', text: err.message || 'Error al conectar con la IA' }
  } finally {
    isGeneratingAI.value = false
  }
}

// Watch template type change to load defaults
watch(() => templateForm.value.type, async (newType, oldType) => {
  if (newType !== oldType && !isEditing.value && blocks.value.length === 0) {
    await loadDefaultTemplate()
  }
})

onMounted(async () => {
  await loadTemplateTypes()
  if (isEditing.value) {
    await loadTemplate()
  } else {
    await loadDefaultTemplate()
  }
})
</script>

<template>
  <div class="h-[calc(100vh-48px)] flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 bg-white border-b border-surface-200">
      <div class="flex items-center gap-4">
        <button @click="router.push('/clinic/notifications')" class="p-2 hover:bg-surface-100 rounded-lg">
          <ArrowLeftIcon class="w-5 h-5 text-surface-600" />
        </button>
        <div>
          <h1 class="text-lg font-semibold text-surface-900">
            {{ isEditing ? 'Editar Plantilla' : 'Nueva Plantilla' }}
          </h1>
          <p class="text-sm text-surface-500">Diseña tu plantilla de email</p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <button 
          @click="showAIModal = true" 
          class="btn-secondary btn-sm bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-purple-200 hover:from-purple-100 hover:to-pink-100"
        >
          <SparklesIcon class="w-4 h-4" />
          Generar con IA
        </button>
        <button 
          @click="showPreview = !showPreview" 
          :class="['btn-secondary btn-sm', showPreview && 'bg-primary-50 text-primary-700']"
        >
          <EyeIcon class="w-4 h-4" />
          Preview
        </button>
        <button 
          @click="showTestModal = true" 
          class="btn-secondary btn-sm"
          :disabled="blocks.length === 0"
        >
          <PaperAirplaneIcon class="w-4 h-4" />
          Probar
        </button>
        <button 
          @click="saveTemplate" 
          class="btn-primary"
          :disabled="isSaving || !templateForm.name"
        >
          <CheckIcon class="w-4 h-4" />
          {{ isSaving ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>

    <!-- Main content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left sidebar: Block palette + Form -->
      <div class="w-72 bg-white border-r border-surface-200 flex flex-col overflow-y-auto">
        <!-- Template info -->
        <div class="p-4 border-b border-surface-100 space-y-3">
          <div>
            <label class="label">Tipo</label>
            <select v-model="templateForm.type" class="input text-sm" :disabled="isEditing">
              <option v-for="t in templateTypes" :key="t.value" :value="t.value">
                {{ t.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">Nombre</label>
            <input v-model="templateForm.name" type="text" class="input text-sm" placeholder="Mi plantilla" />
          </div>
          <div>
            <label class="label">Asunto</label>
            <input v-model="templateForm.subject" type="text" class="input text-sm" placeholder="Asunto del email" />
          </div>
        </div>

        <!-- Block palette -->
        <div class="p-4 border-b border-surface-100">
          <h3 class="text-xs font-semibold text-surface-500 uppercase mb-3">Añadir bloque</h3>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="block in availableBlocks"
              :key="block.type"
              @click="addBlock(block.type)"
              class="flex flex-col items-center gap-1 p-3 bg-surface-50 hover:bg-surface-100 rounded-lg text-surface-600 hover:text-surface-900 transition-colors"
            >
              <component :is="block.icon" class="w-5 h-5" />
              <span class="text-xs">{{ block.label }}</span>
            </button>
          </div>
        </div>

        <!-- Block editor (when selected) -->
        <div v-if="selectedBlock" class="p-4 flex-1">
          <h3 class="text-xs font-semibold text-surface-500 uppercase mb-3">Editar bloque</h3>
          
          <!-- Header block -->
          <div v-if="selectedBlock.type === 'header'" class="space-y-3">
            <div>
              <label class="label">Texto</label>
              <input v-model="selectedBlock.content.text" type="text" class="input text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="label">Fondo</label>
                <input v-model="selectedBlock.content.backgroundColor" type="color" class="w-full h-9 rounded cursor-pointer" />
              </div>
              <div>
                <label class="label">Texto</label>
                <input v-model="selectedBlock.content.textColor" type="color" class="w-full h-9 rounded cursor-pointer" />
              </div>
            </div>
          </div>

          <!-- Logo block -->
          <div v-if="selectedBlock.type === 'logo'" class="space-y-4">
            <!-- Image preview -->
            <div v-if="selectedBlock.content.url" class="relative">
              <img 
                :src="selectedBlock.content.url" 
                alt="Logo preview" 
                class="w-full max-h-32 object-contain bg-surface-100 rounded-lg border border-surface-200"
              />
              <button 
                @click="selectedBlock.content.url = ''"
                type="button"
                class="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full"
                title="Eliminar imagen"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
            
            <!-- Upload button -->
            <div>
              <label class="label">Subir imagen</label>
              <input 
                type="file" 
                ref="logoFileInput"
                @change="handleLogoUpload"
                accept="image/*"
                class="hidden"
              />
              <button 
                @click="triggerLogoUpload"
                type="button"
                class="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-surface-300 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-colors"
                :disabled="isUploadingLogo"
              >
                <ArrowUpTrayIcon class="w-5 h-5 text-surface-400" />
                <span class="text-sm text-surface-600">
                  {{ isUploadingLogo ? 'Subiendo...' : 'Click para subir imagen' }}
                </span>
              </button>
              <p class="text-xs text-surface-400 mt-1">Máximo 500KB. Formatos: JPG, PNG, GIF</p>
            </div>
            
            <!-- Or paste URL -->
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-surface-200"></div>
              </div>
              <div class="relative flex justify-center text-xs">
                <span class="px-2 bg-white text-surface-400">o pega una URL</span>
              </div>
            </div>
            
            <div>
              <input 
                v-model="selectedBlock.content.url" 
                type="url" 
                class="input text-sm" 
                placeholder="https://ejemplo.com/logo.png" 
              />
            </div>
          </div>

          <!-- Text block -->
          <div v-if="selectedBlock.type === 'text'" class="space-y-3">
            <div>
              <label class="label">Contenido</label>
              <textarea 
                :value="selectedBlock.content.html" 
                @input="updateBlockHtml($event)"
                rows="6" 
                class="input text-sm"
                placeholder="Escribe tu texto aquí..."
              ></textarea>
              <p class="text-xs text-surface-400 mt-1">El texto aparecerá directamente en el email</p>
            </div>
            <div>
              <label class="label">Insertar variable</label>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="v in variables"
                  :key="v.key"
                  @click="insertVariable(v.key)"
                  type="button"
                  class="px-2 py-1 text-xs bg-primary-50 text-primary-700 rounded hover:bg-primary-100"
                >
                  {{ v.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Button block -->
          <div v-if="selectedBlock.type === 'button'" class="space-y-3">
            <div>
              <label class="label">Texto del botón</label>
              <input v-model="selectedBlock.content.buttonText" type="text" class="input text-sm" />
            </div>
            <div>
              <label class="label">URL</label>
              <input v-model="selectedBlock.content.buttonUrl" type="url" class="input text-sm" placeholder="https://..." />
            </div>
            <div>
              <label class="label">Color</label>
              <input v-model="selectedBlock.content.buttonColor" type="color" class="w-full h-9 rounded cursor-pointer" />
            </div>
          </div>

          <!-- Spacer block -->
          <div v-if="selectedBlock.type === 'spacer'" class="space-y-3">
            <div>
              <label class="label">Altura (px)</label>
              <input v-model.number="selectedBlock.content.height" type="number" class="input text-sm" min="10" max="100" />
            </div>
          </div>
        </div>
        <div v-else class="p-4 text-center text-surface-400 text-sm">
          Selecciona un bloque para editarlo
        </div>
      </div>

      <!-- Center: Canvas -->
      <div class="flex-1 bg-surface-100 p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <div v-if="blocks.length === 0" class="bg-white rounded-xl border-2 border-dashed border-surface-300 p-12 text-center">
            <PlusIcon class="w-12 h-12 text-surface-300 mx-auto mb-3" />
            <p class="text-surface-500">Añade bloques desde el panel izquierdo</p>
          </div>
          
          <div v-else class="space-y-2">
            <div
              v-for="(block, index) in blocks"
              :key="block.id"
              :class="[
                'relative group bg-white rounded-lg border-2 transition-all cursor-pointer',
                selectedBlockId === block.id ? 'border-primary-500 shadow-lg' : 'border-transparent hover:border-surface-300'
              ]"
              @click="selectBlock(block.id)"
            >
              <!-- Block controls -->
              <div class="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  v-if="index > 0"
                  @click.stop="moveBlock(block.id, 'up')"
                  class="p-1 bg-white border border-surface-200 rounded shadow-sm hover:bg-surface-50"
                >
                  <ChevronUpIcon class="w-4 h-4" />
                </button>
                <button
                  v-if="index < blocks.length - 1"
                  @click.stop="moveBlock(block.id, 'down')"
                  class="p-1 bg-white border border-surface-200 rounded shadow-sm hover:bg-surface-50"
                >
                  <ChevronDownIcon class="w-4 h-4" />
                </button>
                <button
                  @click.stop="removeBlock(block.id)"
                  class="p-1 bg-white border border-red-200 rounded shadow-sm hover:bg-red-50 text-red-500"
                >
                  <TrashIcon class="w-4 h-4" />
                </button>
              </div>

              <!-- Block preview -->
              <div class="overflow-hidden rounded-lg" v-html="renderBlockHtml(block)"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Preview -->
      <div v-if="showPreview" class="w-96 bg-surface-50 border-l border-surface-200 flex flex-col">
        <div class="p-4 border-b border-surface-100 bg-white">
          <h3 class="font-medium text-surface-900">Vista previa</h3>
          <p class="text-sm text-surface-500">{{ templateForm.subject || 'Sin asunto' }}</p>
        </div>
        <div class="flex-1 p-4 overflow-y-auto">
          <div class="bg-white rounded-lg shadow-sm" v-html="previewHtml"></div>
        </div>
      </div>
    </div>

    <!-- Test Email Modal -->
    <Teleport to="body">
      <div v-if="showTestModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showTestModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">Enviar email de prueba</h2>
            <button @click="showTestModal = false" class="text-surface-400 hover:text-surface-600">
              ✕
            </button>
          </div>
          <div class="p-6 space-y-4">
            <p class="text-sm text-surface-600">
              Se enviará un email con la plantilla actual para que puedas ver cómo se verá en el cliente de correo.
            </p>
            
            <div>
              <label class="label">Email de destino</label>
              <input 
                v-model="testEmail"
                type="email"
                class="input"
                placeholder="tu@email.com"
              />
            </div>

            <div 
              v-if="testMessage" 
              :class="[
                'p-3 rounded-lg text-sm',
                testMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              ]"
            >
              {{ testMessage.text }}
            </div>

            <div class="flex justify-end gap-3">
              <button @click="showTestModal = false" class="btn-secondary">
                Cancelar
              </button>
              <button 
                @click="sendTestEmail"
                class="btn-primary"
                :disabled="!testEmail || isSendingTest"
              >
                <PaperAirplaneIcon class="w-4 h-4" />
                {{ isSendingTest ? 'Enviando...' : 'Enviar prueba' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- AI Generation Modal -->
    <Teleport to="body">
      <div v-if="showAIModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showAIModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 bg-gradient-to-r from-purple-50 to-pink-50">
            <div class="flex items-center gap-2">
              <SparklesIcon class="w-5 h-5 text-purple-600" />
              <h2 class="text-lg font-semibold text-surface-900">Generar plantilla con IA</h2>
            </div>
            <button @click="showAIModal = false" class="text-surface-400 hover:text-surface-600">
              ✕
            </button>
          </div>
          <div class="p-6 space-y-4">
            <p class="text-sm text-surface-600">
              Describe la plantilla de email que deseas crear. La IA generará los bloques automáticamente.
            </p>
            
            <div>
              <label class="label">¿Qué tipo de email necesitas?</label>
              <textarea 
                v-model="aiPrompt"
                rows="4"
                class="input"
                placeholder="Ejemplo: Un email de confirmación de cita elegante con colores azules, que incluya un título llamativo, los datos de la cita (fecha, hora, doctor), y un botón para cancelar si es necesario."
                :disabled="isGeneratingAI"
              ></textarea>
            </div>

            <div class="text-xs text-surface-500 space-y-1">
              <p class="font-medium">💡 Ideas de prompts:</p>
              <ul class="list-disc list-inside space-y-0.5">
                <li>Email de recordatorio de cita para mañana, tono amigable</li>
                <li>Confirmación de cita con diseño minimalista y profesional</li>
                <li>Notificación de cancelación de cita con colores cálidos</li>
              </ul>
            </div>

            <div 
              v-if="aiMessage" 
              :class="[
                'p-3 rounded-lg text-sm',
                aiMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              ]"
            >
              {{ aiMessage.text }}
            </div>

            <div class="flex justify-end gap-3">
              <button @click="showAIModal = false" class="btn-secondary" :disabled="isGeneratingAI">
                Cancelar
              </button>
              <button 
                @click="generateWithAI"
                class="btn-primary bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                :disabled="!aiPrompt.trim() || isGeneratingAI"
              >
                <SparklesIcon class="w-4 h-4" />
                {{ isGeneratingAI ? 'Generando...' : 'Generar plantilla' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
