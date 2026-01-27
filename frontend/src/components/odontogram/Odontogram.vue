<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { api } from '@/services/api'
import ToothSVG from './ToothSVG.vue'
import type { Odontogram, OdontogramTooth, DentalCondition, ToothSurfaces, ApiResponse, OdontogramHistoryEntry, OdontogramSnapshot } from '@/types'

const props = defineProps<{
  patientId: string
  isFullscreen?: boolean
}>()

// State
const odontogram = ref<Odontogram | null>(null)
const isLoading = ref(false)
const error = ref('')
const selectedTooth = ref<OdontogramTooth | null>(null)
const selectedSurface = ref<keyof ToothSurfaces | null>(null)
const selectedRoot = ref(false)
const isSaving = ref(false)
const history = ref<OdontogramHistoryEntry[]>([])
const showHistory = ref(false)
const showRoots = ref(true) // Toggle to show/hide roots

// Snapshots state
const snapshots = ref<OdontogramSnapshot[]>([])
const showSnapshotsPanel = ref(false)
const showCreateSnapshotModal = ref(false)
const snapshotForm = ref({ name: '', description: '' })
const isCreatingSnapshot = ref(false)
const viewingSnapshot = ref<OdontogramSnapshot | null>(null)
const showDeleteConfirmModal = ref(false)
const snapshotToDelete = ref<OdontogramSnapshot | null>(null)

// Dental conditions with labels and colors
const conditions: Array<{ value: DentalCondition; label: string; color: string }> = [
  { value: 'HEALTHY', label: 'Sano', color: '#FFFFFF' },
  { value: 'CARIES', label: 'Caries', color: '#EF4444' },
  { value: 'FILLING', label: 'Obturación', color: '#3B82F6' },
  { value: 'CROWN', label: 'Corona', color: '#F59E0B' },
  { value: 'EXTRACTION_INDICATED', label: 'Extracción', color: '#DC2626' },
  { value: 'MISSING', label: 'Ausente', color: '#9CA3AF' },
  { value: 'IMPLANT', label: 'Implante', color: '#10B981' },
  { value: 'ROOT_CANAL', label: 'Endodoncia', color: '#8B5CF6' },
  { value: 'FRACTURE', label: 'Fractura', color: '#F97316' },
  { value: 'BRIDGE', label: 'Puente', color: '#06B6D4' },
  { value: 'VENEER', label: 'Carilla', color: '#EC4899' },
  { value: 'SEALANT', label: 'Sellante', color: '#84CC16' },
]

// Tooth organization by quadrant (FDI notation)
const upperRight = [18, 17, 16, 15, 14, 13, 12, 11]
const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28]
const lowerLeft = [38, 37, 36, 35, 34, 33, 32, 31]
const lowerRight = [41, 42, 43, 44, 45, 46, 47, 48]

// Get tooth data by number
const getToothData = (toothNumber: number): OdontogramTooth | null => {
  return odontogram.value?.teeth?.find(t => t.toothNumber === toothNumber) || null
}

// Load odontogram
const loadOdontogram = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const response = await api.get<ApiResponse<Odontogram>>(`/odontogram/patient/${props.patientId}`)
    if (response.success && response.data) {
      odontogram.value = response.data
    }
  } catch (err: any) {
    console.error('Error loading odontogram:', err)
    error.value = 'Error al cargar el odontograma'
  } finally {
    isLoading.value = false
  }
}

// Load history
const loadHistory = async () => {
  if (!odontogram.value) return
  try {
    const response = await api.get<ApiResponse<OdontogramHistoryEntry[]>>(
      `/odontogram/${odontogram.value.id}/history?limit=20`
    )
    if (response.success && response.data) {
      history.value = response.data
    }
  } catch (err) {
    console.error('Error loading history:', err)
  }
}

// Load snapshots
const loadSnapshots = async () => {
  if (!odontogram.value) return
  try {
    const response = await api.get<ApiResponse<OdontogramSnapshot[]>>(
      `/odontogram/${odontogram.value.id}/snapshots`
    )
    if (response.success && response.data) {
      snapshots.value = response.data
    }
  } catch (err) {
    console.error('Error loading snapshots:', err)
  }
}

// Create snapshot
const handleCreateSnapshot = async () => {
  if (!odontogram.value || !snapshotForm.value.name.trim()) return
  
  isCreatingSnapshot.value = true
  try {
    await api.post(`/odontogram/${odontogram.value.id}/snapshots`, {
      name: snapshotForm.value.name,
      description: snapshotForm.value.description || null,
    })
    await loadSnapshots()
    showCreateSnapshotModal.value = false
    snapshotForm.value = { name: '', description: '' }
  } catch (err) {
    console.error('Error creating snapshot:', err)
  } finally {
    isCreatingSnapshot.value = false
  }
}

// Delete snapshot - opens confirmation modal
const openDeleteConfirm = (snapshot: OdontogramSnapshot) => {
  snapshotToDelete.value = snapshot
  showDeleteConfirmModal.value = true
}

const confirmDeleteSnapshot = async () => {
  if (!snapshotToDelete.value) return
  try {
    await api.delete(`/odontogram/snapshots/${snapshotToDelete.value.id}`)
    await loadSnapshots()
    if (viewingSnapshot.value?.id === snapshotToDelete.value.id) {
      viewingSnapshot.value = null
    }
  } catch (err) {
    console.error('Error deleting snapshot:', err)
  } finally {
    showDeleteConfirmModal.value = false
    snapshotToDelete.value = null
  }
}

const cancelDeleteSnapshot = () => {
  showDeleteConfirmModal.value = false
  snapshotToDelete.value = null
}

// View snapshot (open dual comparison modal)
const viewSnapshot = (snapshot: OdontogramSnapshot) => {
  viewingSnapshot.value = snapshot
}

const closeSnapshotView = () => {
  viewingSnapshot.value = null
}

// Get tooth data from snapshot
const getSnapshotToothData = (toothNumber: number): OdontogramTooth | null => {
  if (!viewingSnapshot.value) return null
  const teeth = viewingSnapshot.value.teethState as Array<{
    toothNumber: number
    generalCondition: DentalCondition
    surfaces: ToothSurfaces
    notes: string | null
  }>
  return teeth.find(t => t.toothNumber === toothNumber) as OdontogramTooth | null
}

// Select tooth
const selectTooth = (toothNumber: number) => {
  const tooth = getToothData(toothNumber)
  if (tooth) {
    selectedTooth.value = tooth
    selectedSurface.value = null
  }
}

// Select surface
const selectSurface = (toothNumber: number, surface: keyof ToothSurfaces) => {
  const tooth = getToothData(toothNumber)
  if (tooth) {
    selectedTooth.value = tooth
    selectedSurface.value = surface
    selectedRoot.value = false
  }
}

// Select root
const selectRoot = (toothNumber: number) => {
  const tooth = getToothData(toothNumber)
  if (tooth) {
    selectedTooth.value = tooth
    selectedSurface.value = null
    selectedRoot.value = true
  }
}

// Apply condition
const applyCondition = async (condition: DentalCondition) => {
  if (!selectedTooth.value || !odontogram.value) return

  isSaving.value = true
  try {
    await api.put(`/odontogram/${odontogram.value.id}/tooth/${selectedTooth.value.toothNumber}`, {
      condition,
      surface: selectedSurface.value,
    })
    
    // Reload to get updated data
    await loadOdontogram()
    await loadHistory()
    
    // Re-select the tooth to update panel
    if (selectedTooth.value) {
      const updatedTooth = getToothData(selectedTooth.value.toothNumber)
      selectedTooth.value = updatedTooth
    }
  } catch (err: any) {
    console.error('Error updating tooth:', err)
    error.value = 'Error al actualizar el diente'
  } finally {
    isSaving.value = false
  }
}

// Clear selection
const clearSelection = () => {
  selectedTooth.value = null
  selectedSurface.value = null
  selectedRoot.value = false
}

// Surface labels
const surfaceLabels: Record<keyof ToothSurfaces, string> = {
  mesial: 'Mesial',
  distal: 'Distal',
  occlusal: 'Oclusal',
  vestibular: 'Vestibular',
  palatino: 'Palatino/Lingual',
}

// Format date for history display
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins}m`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Load on mount
onMounted(async () => {
  await loadOdontogram()
  await loadHistory()
  await loadSnapshots()
})

// Reload when patient changes
watch(() => props.patientId, () => {
  loadOdontogram()
  clearSelection()
})
</script>

<template>
  <div class="odontogram-container">
    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      <span class="ml-3 text-surface-600">Cargando odontograma...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded-lg">
      {{ error }}
      <button @click="loadOdontogram" class="ml-4 underline">Reintentar</button>
    </div>

    <!-- Odontogram -->
    <div v-else-if="odontogram" class="space-y-6">
      <!-- Legend -->
      <div class="flex flex-wrap gap-2 text-xs">
        <div 
          v-for="cond in conditions" 
          :key="cond.value"
          class="flex items-center gap-1 px-2 py-1 rounded border"
        >
          <div 
            class="w-3 h-3 rounded-full border border-gray-300" 
            :style="{ backgroundColor: cond.color }"
          ></div>
          <span>{{ cond.label }}</span>
        </div>
      </div>

      <!-- Controls -->
      <!-- Controls -->
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <button 
            @click="showRoots = !showRoots"
            class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors"
            :class="showRoots ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-surface-50 border-surface-300 text-surface-600'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            {{ showRoots ? 'Ocultar Raíces' : 'Mostrar Raíces' }}
          </button>
        </div>
        
        <router-link 
          v-if="!props.isFullscreen"
          :to="{ name: 'clinic-odontogram-fullscreen', params: { patientId: patientId } }"
          target="_blank"
          class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Pantalla Completa
        </router-link>
      </div>

      <div class="flex flex-col lg:flex-row gap-6">
        <!-- Dental Chart -->
        <div class="flex-1 bg-white rounded-xl border border-surface-200 p-4 overflow-x-auto">
          <!-- Upper teeth -->
          <div class="mb-8">
            <div class="text-center text-sm font-medium text-surface-500 mb-3">SUPERIOR</div>
            <div class="flex justify-center gap-1">
              <!-- Upper Right (18-11) -->
              <div class="flex gap-1 border-r-2 border-surface-300 pr-2 mr-2">
                <ToothSVG
                  v-for="num in upperRight"
                  :key="num"
                  :toothNumber="num"
                  :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                  :surfaces="getToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                  :isSelected="selectedTooth?.toothNumber === num"
                  :isUpper="true"
                  :showRoot="showRoots"
                  @click="selectTooth(num)"
                  @surface-click="(s) => selectSurface(num, s)"
                  @root-click="selectRoot(num)"
                />
              </div>
              <!-- Upper Left (21-28) -->
              <div class="flex gap-1">
                <ToothSVG
                  v-for="num in upperLeft"
                  :key="num"
                  :toothNumber="num"
                  :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                  :surfaces="getToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                  :isSelected="selectedTooth?.toothNumber === num"
                  :isUpper="true"
                  :showRoot="showRoots"
                  @click="selectTooth(num)"
                  @surface-click="(s) => selectSurface(num, s)"
                  @root-click="selectRoot(num)"
                />
              </div>
            </div>
          </div>

          <!-- Divider line -->
          <div class="border-t-2 border-surface-300 my-4 relative">
            <span class="absolute left-1/2 -translate-x-1/2 -top-2 bg-white px-4 text-xs text-surface-400">
              Línea Media
            </span>
          </div>

          <!-- Lower teeth -->
          <div class="mt-8">
            <div class="flex justify-center gap-1">
              <!-- Lower Left (38-31) -->
              <div class="flex gap-1 border-r-2 border-surface-300 pr-2 mr-2">
                <ToothSVG
                  v-for="num in lowerLeft"
                  :key="num"
                  :toothNumber="num"
                  :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                  :surfaces="getToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                  :isSelected="selectedTooth?.toothNumber === num"
                  :isUpper="false"
                  :showRoot="showRoots"
                  @click="selectTooth(num)"
                  @surface-click="(s) => selectSurface(num, s)"
                  @root-click="selectRoot(num)"
                />
              </div>
              <!-- Lower Right (41-48) -->
              <div class="flex gap-1">
                <ToothSVG
                  v-for="num in lowerRight"
                  :key="num"
                  :toothNumber="num"
                  :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                  :surfaces="getToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                  :isSelected="selectedTooth?.toothNumber === num"
                  :isUpper="false"
                  :showRoot="showRoots"
                  @click="selectTooth(num)"
                  @surface-click="(s) => selectSurface(num, s)"
                  @root-click="selectRoot(num)"
                />
              </div>
            </div>
            <div class="text-center text-sm font-medium text-surface-500 mt-3">INFERIOR</div>
          </div>
        </div>

        <!-- Condition Panel -->
        <div class="w-full lg:w-72 bg-white rounded-xl border border-surface-200 p-4">
          <h3 class="font-semibold text-surface-900 mb-4">Panel de Condiciones</h3>
          
          <!-- No selection -->
          <div v-if="!selectedTooth" class="text-center text-surface-400 py-8">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <p class="text-sm">Haz clic en un diente o superficie para seleccionar</p>
          </div>

          <!-- Tooth selected -->
          <div v-else class="space-y-4">
            <div class="flex items-center justify-between bg-surface-50 rounded-lg p-3">
              <div>
                <div class="font-medium">Diente {{ selectedTooth.toothNumber }}</div>
                <div v-if="selectedRoot" class="text-sm text-purple-600 font-medium">
                  🦷 Raíz
                </div>
                <div v-else-if="selectedSurface" class="text-sm text-primary-600">
                  Superficie: {{ surfaceLabels[selectedSurface] }}
                </div>
                <div v-else class="text-sm text-surface-500">
                  Condición general
                </div>
              </div>
              <button 
                @click="clearSelection" 
                class="text-surface-400 hover:text-surface-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>

            <!-- Condition buttons -->
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="cond in conditions"
                :key="cond.value"
                :disabled="isSaving"
                @click="applyCondition(cond.value)"
                class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all hover:shadow-md disabled:opacity-50"
                :class="{
                  'border-primary-500 bg-primary-50': 
                    (selectedSurface && selectedTooth?.surfaces[selectedSurface] === cond.value) ||
                    (!selectedSurface && selectedTooth?.generalCondition === cond.value)
                }"
              >
                <div 
                  class="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" 
                  :style="{ backgroundColor: cond.color }"
                ></div>
                <span class="truncate">{{ cond.label }}</span>
              </button>
            </div>

            <!-- Saving indicator -->
            <div v-if="isSaving" class="text-center text-sm text-primary-600">
              <div class="animate-spin inline-block w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full mr-2"></div>
              Guardando...
            </div>
          </div>
        </div>
      </div>

      <!-- History Panel (hidden for now)
      <div class="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <button 
          @click="showHistory = !showHistory"
          class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-50 transition-colors"
        >
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="font-medium text-surface-900">Historial de Cambios</span>
            <span class="text-xs bg-surface-100 px-2 py-0.5 rounded-full text-surface-600">{{ history.length }}</span>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            class="w-5 h-5 text-surface-400 transition-transform" 
            :class="{ 'rotate-180': showHistory }"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div v-if="showHistory" class="border-t border-surface-200 max-h-64 overflow-y-auto">
          <div v-if="history.length === 0" class="p-4 text-center text-surface-400 text-sm">
            No hay cambios registrados aún
          </div>
          <div v-else class="divide-y divide-surface-100">
            <div 
              v-for="entry in history" 
              :key="entry.id"
              class="px-4 py-3 hover:bg-surface-50 transition-colors"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-surface-900">Diente {{ entry.toothNumber }}</span>
                    <span v-if="entry.surface" class="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">
                      {{ entry.surface }}
                    </span>
                  </div>
                  <div class="text-sm text-surface-600 mt-1 flex items-center gap-1.5">
                    <span class="text-surface-400">{{ entry.previousCondition || 'Sin estado' }}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span class="font-medium text-surface-700">{{ entry.newCondition }}</span>
                  </div>
                  <div v-if="entry.notes" class="text-xs text-surface-500 mt-1 italic">
                    "{{ entry.notes }}"
                  </div>
                </div>
                <div class="text-xs text-surface-400 whitespace-nowrap">
                  {{ formatDate(entry.createdAt) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      -->

      <!-- Snapshots Panel -->
      <div class="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <button 
          @click="showSnapshotsPanel = !showSnapshotsPanel"
          class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-50 transition-colors"
        >
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="font-medium text-surface-900">Snapshots (Antes/Después)</span>
            <span class="text-xs bg-purple-100 px-2 py-0.5 rounded-full text-purple-600">{{ snapshots.length }}</span>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            class="w-5 h-5 text-surface-400 transition-transform" 
            :class="{ 'rotate-180': showSnapshotsPanel }"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div v-if="showSnapshotsPanel" class="border-t border-surface-200 p-4 space-y-3">
          <!-- Create button -->
          <button 
            @click="showCreateSnapshotModal = true"
            class="w-full px-4 py-2 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Guardar Estado Actual
          </button>
          
          <!-- Viewing snapshot indicator -->
          <div v-if="viewingSnapshot" class="bg-purple-100 rounded-lg p-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span class="text-sm text-purple-800">Viendo: {{ viewingSnapshot.name }}</span>
            </div>
            <button @click="closeSnapshotView" class="text-purple-600 hover:text-purple-800">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <!-- Snapshots list -->
          <div v-if="snapshots.length === 0" class="text-center text-surface-400 py-4 text-sm">
            No hay snapshots guardados
          </div>
          <div v-else class="space-y-2">
            <div 
              v-for="snap in snapshots" 
              :key="snap.id"
              class="bg-surface-50 rounded-lg p-3 flex items-center justify-between group"
              :class="{ 'ring-2 ring-purple-400': viewingSnapshot?.id === snap.id }"
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium text-surface-800 truncate">{{ snap.name }}</div>
                <div class="text-xs text-surface-500">{{ formatDate(snap.createdAt) }}</div>
                <div v-if="snap.description" class="text-xs text-surface-400 mt-1 truncate">{{ snap.description }}</div>
              </div>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  @click="viewSnapshot(snap)"
                  class="p-1.5 text-purple-600 hover:bg-purple-100 rounded"
                  title="Ver snapshot"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button 
                  @click="openDeleteConfirm(snap)"
                  class="p-1.5 text-red-500 hover:bg-red-100 rounded"
                  title="Eliminar snapshot"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Snapshot Modal -->
      <Teleport to="body">
        <div v-if="showCreateSnapshotModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="showCreateSnapshotModal = false"></div>
          <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 class="text-lg font-semibold text-surface-900">Crear Snapshot</h3>
            <p class="text-sm text-surface-500">Guarda el estado actual del odontograma para comparar después del tratamiento.</p>
            
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Nombre *</label>
                <input 
                  v-model="snapshotForm.name"
                  type="text"
                  class="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Ej: Estado inicial, Pre-tratamiento..."
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Descripción (opcional)</label>
                <textarea 
                  v-model="snapshotForm.description"
                  class="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  rows="2"
                  placeholder="Notas adicionales..."
                ></textarea>
              </div>
            </div>
            
            <div class="flex justify-end gap-3 pt-2">
              <button 
                @click="showCreateSnapshotModal = false"
                class="px-4 py-2 text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                @click="handleCreateSnapshot"
                :disabled="!snapshotForm.name.trim() || isCreatingSnapshot"
                class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <div v-if="isCreatingSnapshot" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {{ isCreatingSnapshot ? 'Guardando...' : 'Guardar Snapshot' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Delete Confirmation Modal -->
      <Teleport to="body">
        <div v-if="showDeleteConfirmModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="cancelDeleteSnapshot"></div>
          <div class="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-surface-900">Eliminar Snapshot</h3>
                <p class="text-sm text-surface-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            
            <p class="text-surface-700">
              ¿Estás seguro de que quieres eliminar el snapshot 
              <span class="font-semibold">"{{ snapshotToDelete?.name }}"</span>?
            </p>
            
            <div class="flex justify-end gap-3 pt-2">
              <button 
                @click="cancelDeleteSnapshot"
                class="px-4 py-2 text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                @click="confirmDeleteSnapshot"
                class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Dual Comparison Modal -->
      <Teleport to="body">
        <div v-if="viewingSnapshot" class="fixed inset-0 z-50 bg-surface-100 overflow-auto">
          <!-- Header -->
          <div class="sticky top-0 z-10 bg-white border-b border-surface-200 px-6 py-4 flex items-center justify-between shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 class="text-lg font-semibold text-surface-900">Comparación: {{ viewingSnapshot.name }}</h2>
                <p class="text-sm text-surface-500">{{ formatDate(viewingSnapshot.createdAt) }}</p>
              </div>
            </div>
            <button 
              @click="closeSnapshotView"
              class="p-2 text-surface-500 hover:bg-surface-100 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <!-- Dual view -->
          <div class="p-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Snapshot (Before) -->
              <div class="bg-white rounded-xl border border-purple-200 p-4 shadow-sm">
                <div class="text-center mb-4">
                  <span class="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    SNAPSHOT (Antes)
                  </span>
                </div>
                
                <!-- Upper teeth -->
                <div class="mb-4">
                  <div class="text-center text-xs font-medium text-surface-400 mb-2">SUPERIOR</div>
                  <div class="flex justify-center gap-0.5 flex-wrap">
                    <div class="flex gap-0.5 border-r border-surface-300 pr-1 mr-1">
                      <ToothSVG
                        v-for="num in upperRight"
                        :key="'snap-' + num"
                        :toothNumber="num"
                        :generalCondition="getSnapshotToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getSnapshotToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                        :isSelected="false"
                        :isUpper="true"
                        :showRoot="false"
                      />
                    </div>
                    <div class="flex gap-0.5">
                      <ToothSVG
                        v-for="num in upperLeft"
                        :key="'snap-' + num"
                        :toothNumber="num"
                        :generalCondition="getSnapshotToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getSnapshotToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                        :isSelected="false"
                        :isUpper="true"
                        :showRoot="false"
                      />
                    </div>
                  </div>
                </div>
                
                <!-- Lower teeth -->
                <div>
                  <div class="flex justify-center gap-0.5 flex-wrap">
                    <div class="flex gap-0.5 border-r border-surface-300 pr-1 mr-1">
                      <ToothSVG
                        v-for="num in lowerLeft"
                        :key="'snap-' + num"
                        :toothNumber="num"
                        :generalCondition="getSnapshotToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getSnapshotToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                        :isSelected="false"
                        :isUpper="false"
                        :showRoot="false"
                      />
                    </div>
                    <div class="flex gap-0.5">
                      <ToothSVG
                        v-for="num in lowerRight"
                        :key="'snap-' + num"
                        :toothNumber="num"
                        :generalCondition="getSnapshotToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getSnapshotToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                        :isSelected="false"
                        :isUpper="false"
                        :showRoot="false"
                      />
                    </div>
                  </div>
                  <div class="text-center text-xs font-medium text-surface-400 mt-2">INFERIOR</div>
                </div>
              </div>
              
              <!-- Current State (After) -->
              <div class="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
                <div class="text-center mb-4">
                  <span class="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ACTUAL (Ahora)
                  </span>
                </div>
                
                <!-- Upper teeth -->
                <div class="mb-4">
                  <div class="text-center text-xs font-medium text-surface-400 mb-2">SUPERIOR</div>
                  <div class="flex justify-center gap-0.5 flex-wrap">
                    <div class="flex gap-0.5 border-r border-surface-300 pr-1 mr-1">
                      <ToothSVG
                        v-for="num in upperRight"
                        :key="'curr-' + num"
                        :toothNumber="num"
                        :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                        :isSelected="false"
                        :isUpper="true"
                        :showRoot="false"
                      />
                    </div>
                    <div class="flex gap-0.5">
                      <ToothSVG
                        v-for="num in upperLeft"
                        :key="'curr-' + num"
                        :toothNumber="num"
                        :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                        :isSelected="false"
                        :isUpper="true"
                        :showRoot="false"
                      />
                    </div>
                  </div>
                </div>
                
                <!-- Lower teeth -->
                <div>
                  <div class="flex justify-center gap-0.5 flex-wrap">
                    <div class="flex gap-0.5 border-r border-surface-300 pr-1 mr-1">
                      <ToothSVG
                        v-for="num in lowerLeft"
                        :key="'curr-' + num"
                        :toothNumber="num"
                        :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                        :isSelected="false"
                        :isUpper="false"
                        :showRoot="false"
                      />
                    </div>
                    <div class="flex gap-0.5">
                      <ToothSVG
                        v-for="num in lowerRight"
                        :key="'curr-' + num"
                        :toothNumber="num"
                        :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getToothData(num)?.surfaces || { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }"
                        :isSelected="false"
                        :isUpper="false"
                        :showRoot="false"
                      />
                    </div>
                  </div>
                  <div class="text-center text-xs font-medium text-surface-400 mt-2">INFERIOR</div>
                </div>
              </div>
            </div>
            
            <!-- Legend -->
            <div class="mt-6 bg-white rounded-xl border border-surface-200 p-4">
              <div class="text-sm font-medium text-surface-700 mb-3">Leyenda de Condiciones</div>
              <div class="flex flex-wrap gap-2">
                <div 
                  v-for="cond in conditions" 
                  :key="cond.value"
                  class="flex items-center gap-1.5 px-2 py-1 rounded border text-xs"
                >
                  <div 
                    class="w-3 h-3 rounded-full border border-gray-300" 
                    :style="{ backgroundColor: cond.color }"
                  ></div>
                  <span>{{ cond.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Instructions -->
      <div class="text-sm text-surface-500 bg-surface-50 rounded-lg p-3">
        <strong>Instrucciones:</strong> Haz clic en un diente para seleccionarlo. Haz clic en una superficie específica (centro, lados) para marcar solo esa área. Luego selecciona la condición del panel derecho.
      </div>
    </div>
  </div>
</template>

<style scoped>
.odontogram-container {
  min-height: 400px;
}
</style>
