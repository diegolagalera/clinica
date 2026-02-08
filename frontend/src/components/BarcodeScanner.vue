<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { XMarkIcon, CameraIcon } from '@heroicons/vue/24/outline'

const emit = defineEmits<{
  (e: 'scanned', code: string, format: string): void
  (e: 'close'): void
}>()

const isScanning = ref(false)
const scannerError = ref('')
const scannedCode = ref<string | null>(null)
const scannedFormat = ref<string | null>(null)
const html5Qrcode = ref<Html5Qrcode | null>(null)
const scannerContainerId = 'barcode-scanner-container'

async function startScanner() {
  scannerError.value = ''
  scannedCode.value = null
  scannedFormat.value = null
  
  try {
    html5Qrcode.value = new Html5Qrcode(scannerContainerId)
    
    await html5Qrcode.value.start(
      { facingMode: 'environment' }, // Use back camera
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.5,
      },
      (decodedText, decodedResult) => {
        // Success callback
        scannedCode.value = decodedText
        scannedFormat.value = decodedResult.result.format?.formatName || 'Unknown'
        stopScanner()
      },
      () => {
        // Error callback (ignore scanning errors)
      }
    )
    
    isScanning.value = true
  } catch (err: any) {
    console.error('Scanner error:', err)
    if (err.message?.includes('NotAllowedError') || err.name === 'NotAllowedError') {
      scannerError.value = 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara.'
    } else if (err.message?.includes('NotFoundError') || err.name === 'NotFoundError') {
      scannerError.value = 'No se encontró ninguna cámara en este dispositivo.'
    } else {
      scannerError.value = 'Error al iniciar la cámara: ' + (err.message || 'Error desconocido')
    }
  }
}

async function stopScanner() {
  if (html5Qrcode.value && isScanning.value) {
    try {
      await html5Qrcode.value.stop()
    } catch {
      // Ignore stop errors
    }
    isScanning.value = false
  }
}

function handleUseCode() {
  if (scannedCode.value && scannedFormat.value) {
    emit('scanned', scannedCode.value, scannedFormat.value)
  }
}

function handleClose() {
  stopScanner()
  emit('close')
}

function scanAgain() {
  scannedCode.value = null
  scannedFormat.value = null
  startScanner()
}

onMounted(() => {
  startScanner()
})

onUnmounted(() => {
  stopScanner()
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-surface-200">
          <div class="flex items-center gap-2">
            <CameraIcon class="w-5 h-5 text-primary-600" />
            <h3 class="font-semibold text-surface-900">Escanear Código de Barras</h3>
          </div>
          <button @click="handleClose" class="p-2 hover:bg-surface-100 rounded-lg">
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>

        <!-- Scanner Area -->
        <div class="p-4">
          <!-- Error State -->
          <div v-if="scannerError" class="text-center py-8">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <XMarkIcon class="w-8 h-8 text-red-600" />
            </div>
            <p class="text-red-600 mb-4">{{ scannerError }}</p>
            <button @click="startScanner" class="btn-primary">
              Intentar de nuevo
            </button>
          </div>

          <!-- Scanning State -->
          <div v-else-if="!scannedCode">
            <div 
              :id="scannerContainerId" 
              class="w-full aspect-[4/3] bg-black rounded-lg overflow-hidden"
            ></div>
            <p class="text-sm text-surface-500 text-center mt-3">
              Coloca el código de barras del producto dentro del recuadro
            </p>
          </div>

          <!-- Result State -->
          <div v-else class="text-center py-4">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h4 class="font-semibold text-surface-900 mb-2">¡Código escaneado!</h4>
            
            <div class="bg-surface-50 rounded-lg p-4 mb-4">
              <p class="text-xs text-surface-500 mb-1">Formato: {{ scannedFormat }}</p>
              <p class="text-lg font-mono font-bold text-surface-900 break-all">
                {{ scannedCode }}
              </p>
            </div>

            <div class="flex gap-3 justify-center">
              <button @click="scanAgain" class="btn-secondary">
                Escanear otro
              </button>
              <button @click="handleUseCode" class="btn-primary">
                Usar este código
              </button>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div class="px-4 pb-4">
          <div class="bg-blue-50 rounded-lg p-3">
            <p class="text-xs text-blue-700">
              <strong>Formatos soportados:</strong> EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39, QR
            </p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
