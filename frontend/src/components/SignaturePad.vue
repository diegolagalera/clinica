<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import SignaturePadLib from 'signature_pad'
import {
  PencilIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  modelValue?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// State
const mode = ref<'draw' | 'upload'>('draw')
const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
let signaturePad: SignaturePadLib | null = null

const currentSignature = ref<string | null>(props.modelValue || null)
const hasDrawn = ref(false)

// Initialize signature pad
const initPad = () => {
  if (!canvasRef.value) return
  signaturePad = new SignaturePadLib(canvasRef.value, {
    backgroundColor: 'rgba(255,255,255,0)',
    penColor: '#1E293B',
    minWidth: 1.5,
    maxWidth: 3,
  })
  resizeCanvas()
  signaturePad.addEventListener('endStroke', () => {
    hasDrawn.value = !signaturePad!.isEmpty()
  })
}

const resizeCanvas = () => {
  if (!canvasRef.value || !signaturePad) return
  const canvas = canvasRef.value
  const container = canvas.parentElement
  if (!container) return

  const ratio = Math.max(window.devicePixelRatio || 1, 1)
  canvas.width = container.clientWidth * ratio
  canvas.height = 160 * ratio
  canvas.style.width = `${container.clientWidth}px`
  canvas.style.height = '160px'
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.scale(ratio, ratio)
  signaturePad.clear()
  hasDrawn.value = false
}

// Actions
const clearPad = () => {
  signaturePad?.clear()
  hasDrawn.value = false
}

const undoPad = () => {
  if (!signaturePad) return
  const data = signaturePad.toData()
  if (data.length > 0) {
    data.pop()
    signaturePad.fromData(data)
    hasDrawn.value = data.length > 0
  }
}

const saveDraw = () => {
  if (!signaturePad || signaturePad.isEmpty()) return
  const dataUrl = signaturePad.toDataURL('image/png')
  currentSignature.value = dataUrl
  emit('update:modelValue', dataUrl)
}

// Upload handling
const triggerUpload = () => {
  fileInputRef.value?.click()
}

const handleFileUpload = (ev: Event) => {
  const target = ev.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('Por favor selecciona una imagen (PNG, JPG)')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('La imagen no puede superar los 5MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    // Process the image: resize and make background transparent
    processUploadedImage(result)
  }
  reader.readAsDataURL(file)
  // Reset the input so the same file can be re-uploaded
  target.value = ''
}

const processUploadedImage = (dataUrl: string) => {
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const maxWidth = 400
    const maxHeight = 160
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Simple background removal: make white/light pixels transparent
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      // If pixel is close to white (light), make it transparent
      if (r > 200 && g > 200 && b > 200) {
        data[i + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)

    const processedUrl = canvas.toDataURL('image/png')
    currentSignature.value = processedUrl
    emit('update:modelValue', processedUrl)
  }
  img.src = dataUrl
}

const removeSignature = () => {
  currentSignature.value = null
  emit('update:modelValue', '')
}

// Watch for external changes
watch(() => props.modelValue, (val) => {
  currentSignature.value = val || null
})

// Resize observer
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    initPad()
  })
  if (canvasRef.value?.parentElement) {
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })
    resizeObserver.observe(canvasRef.value.parentElement)
  }
})

onUnmounted(() => {
  signaturePad?.off()
  signaturePad = null
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Current signature preview -->
    <div v-if="currentSignature" class="border border-surface-200 rounded-xl p-4 bg-surface-50 relative">
      <p class="text-xs text-surface-500 mb-2 font-medium">Firma actual</p>
      <div class="flex items-center justify-between">
        <img :src="currentSignature" alt="Firma" class="max-h-20 object-contain" />
        <button
          @click="removeSignature"
          class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Eliminar firma"
        >
          <TrashIcon class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Mode tabs -->
    <div class="flex gap-2">
      <button
        @click="mode = 'draw'"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
          mode === 'draw'
            ? 'bg-primary-100 text-primary-700 shadow-sm'
            : 'text-surface-500 hover:bg-surface-100'
        ]"
      >
        <PencilIcon class="w-4 h-4" />
        Dibujar
      </button>
      <button
        @click="mode = 'upload'"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
          mode === 'upload'
            ? 'bg-primary-100 text-primary-700 shadow-sm'
            : 'text-surface-500 hover:bg-surface-100'
        ]"
      >
        <ArrowUpTrayIcon class="w-4 h-4" />
        Subir imagen
      </button>
    </div>

    <!-- Draw mode -->
    <div v-if="mode === 'draw'" class="space-y-3">
      <div class="border-2 border-dashed border-surface-300 rounded-xl overflow-hidden bg-white relative">
        <canvas ref="canvasRef" class="touch-none w-full" style="height: 160px" />
        <div v-if="!hasDrawn" class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p class="text-surface-400 text-sm">Dibuja tu firma aquí</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          @click="clearPad"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
        >
          <ArrowPathIcon class="w-3.5 h-3.5" />
          Borrar
        </button>
        <button
          @click="undoPad"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
        >
          <ArrowUturnLeftIcon class="w-3.5 h-3.5" />
          Deshacer
        </button>
        <div class="flex-1"></div>
        <button
          @click="saveDraw"
          :disabled="!hasDrawn"
          class="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckIcon class="w-3.5 h-3.5" />
          Guardar firma
        </button>
      </div>
    </div>

    <!-- Upload mode -->
    <div v-if="mode === 'upload'" class="space-y-3">
      <div
        @click="triggerUpload"
        class="border-2 border-dashed border-surface-300 rounded-xl p-8 text-center hover:border-primary-400 transition-colors cursor-pointer bg-white"
      >
        <ArrowUpTrayIcon class="w-10 h-10 mx-auto text-surface-400 mb-2" />
        <p class="text-sm text-surface-600">Click para subir una imagen de tu firma</p>
        <p class="text-xs text-surface-400 mt-1">PNG o JPG · Máx. 5MB · Se eliminará automáticamente el fondo blanco</p>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/png,image/jpeg"
        class="hidden"
        @change="handleFileUpload"
      />
    </div>
  </div>
</template>
