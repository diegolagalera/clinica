<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
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
const showRoots = ref(true)
// Condition panel tab
const conditionTab = ref<'crown' | 'root' | 'tooth'>('crown')

// Clinic color overrides
const clinicColors = ref<Record<string, string>>({})

// Snapshots state
const snapshots = ref<OdontogramSnapshot[]>([])
const showSnapshotsPanel = ref(false)
const showCreateSnapshotModal = ref(false)
const snapshotForm = ref({ name: '', description: '' })
const isCreatingSnapshot = ref(false)
const viewingSnapshot = ref<OdontogramSnapshot | null>(null)
const showDeleteConfirmModal = ref(false)
const snapshotToDelete = ref<OdontogramSnapshot | null>(null)

// ============================================================================
// CATEGORIZED CONDITIONS
// ============================================================================

// Default condition colors
const defaultConditionColors: Record<string, string> = {
  HEALTHY: '#FFFFFF',
  CARIES: '#EF4444',
  FILLING: '#3B82F6',
  TEMPORARY_FILLING: '#93C5FD',
  CROWN: '#F59E0B',
  VENEER: '#EC4899',
  BRIDGE: '#06B6D4',
  SEALANT: '#84CC16',
  FRACTURE: '#F97316',
  EROSION: '#FBBF24',
  ABRASION: '#D97706',
  ROOT_CANAL: '#8B5CF6',
  PERIAPICAL_LESION: '#EF4444',
  ROOT_RESORPTION: '#F97316',
  ROOT_FRACTURE: '#DC2626',
  MISSING: '#9CA3AF',
  IMPLANT: '#10B981',
  EXTRACTION_INDICATED: '#DC2626',
}

// Helper to get merged color
const cc = (value: string): string => clinicColors.value[value] || defaultConditionColors[value] || '#9CA3AF'

const crownConditions = computed(() => [
  { value: 'HEALTHY' as DentalCondition, label: 'Sano', color: cc('HEALTHY') },
  { value: 'CARIES' as DentalCondition, label: 'Caries', color: cc('CARIES') },
  { value: 'FILLING' as DentalCondition, label: 'Obturación', color: cc('FILLING') },
  { value: 'TEMPORARY_FILLING' as DentalCondition, label: 'Obt. temporal', color: cc('TEMPORARY_FILLING') },
  { value: 'CROWN' as DentalCondition, label: 'Corona', color: cc('CROWN') },
  { value: 'VENEER' as DentalCondition, label: 'Carilla', color: cc('VENEER') },
  { value: 'BRIDGE' as DentalCondition, label: 'Puente', color: cc('BRIDGE') },
  { value: 'SEALANT' as DentalCondition, label: 'Sellante', color: cc('SEALANT') },
  { value: 'FRACTURE' as DentalCondition, label: 'Fractura', color: cc('FRACTURE') },
  { value: 'EROSION' as DentalCondition, label: 'Erosión', color: cc('EROSION') },
  { value: 'ABRASION' as DentalCondition, label: 'Abrasión', color: cc('ABRASION') },
])

const rootConditions = computed(() => [
  { value: 'HEALTHY' as DentalCondition, label: 'Sana', color: cc('HEALTHY') },
  { value: 'ROOT_CANAL' as DentalCondition, label: 'Endodoncia', color: cc('ROOT_CANAL') },
  { value: 'PERIAPICAL_LESION' as DentalCondition, label: 'Lesión periapical', color: cc('PERIAPICAL_LESION') },
  { value: 'ROOT_RESORPTION' as DentalCondition, label: 'Reabsorción', color: cc('ROOT_RESORPTION') },
  { value: 'ROOT_FRACTURE' as DentalCondition, label: 'Fractura radicular', color: cc('ROOT_FRACTURE') },
])

const toothConditions = computed(() => [
  { value: 'HEALTHY' as DentalCondition, label: 'Sano', color: cc('HEALTHY') },
  { value: 'MISSING' as DentalCondition, label: 'Ausente', color: cc('MISSING') },
  { value: 'IMPLANT' as DentalCondition, label: 'Implante', color: cc('IMPLANT') },
  { value: 'EXTRACTION_INDICATED' as DentalCondition, label: 'Extracción indicada', color: cc('EXTRACTION_INDICATED') },
])

// All conditions for legend
const allConditions = computed(() => [
  ...crownConditions.value.filter(c => c.value !== 'HEALTHY'),
  ...rootConditions.value.filter(c => c.value !== 'HEALTHY'),
  ...toothConditions.value.filter(c => c.value !== 'HEALTHY'),
])

// Compute active conditions based on selection
const activeConditions = computed(() => {
  if (selectedRoot.value) return rootConditions.value
  if (selectedSurface.value) return crownConditions.value
  // General tooth click — show tab content
  if (conditionTab.value === 'crown') return crownConditions.value
  if (conditionTab.value === 'root') return rootConditions.value
  return toothConditions.value
})

// Current condition of selected element
const currentConditionValue = computed(() => {
  if (!selectedTooth.value) return null
  if (selectedRoot.value) return selectedTooth.value.rootCondition || 'HEALTHY'
  if (selectedSurface.value) return selectedTooth.value.surfaces[selectedSurface.value]
  return selectedTooth.value.generalCondition
})

// Tooth organization by quadrant (FDI notation)
const upperRight = [18, 17, 16, 15, 14, 13, 12, 11]
const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28]
const lowerLeft = [38, 37, 36, 35, 34, 33, 32, 31]
const lowerRight = [41, 42, 43, 44, 45, 46, 47, 48]

const defaultSurfaces: ToothSurfaces = { mesial: 'HEALTHY', distal: 'HEALTHY', occlusal: 'HEALTHY', vestibular: 'HEALTHY', palatino: 'HEALTHY' }

// Get tooth data by number
const getToothData = (toothNumber: number): OdontogramTooth | null => {
  return odontogram.value?.teeth?.find(t => t.toothNumber === toothNumber) || null
}

// Load odontogram
const loadOdontogram = async () => {
  const isInitialLoad = !odontogram.value
  if (isInitialLoad) isLoading.value = true
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
    if (isInitialLoad) isLoading.value = false
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

// Delete snapshot
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

const viewSnapshot = (snapshot: OdontogramSnapshot) => {
  viewingSnapshot.value = snapshot
}

const closeSnapshotView = () => {
  viewingSnapshot.value = null
}

const getSnapshotToothData = (toothNumber: number): OdontogramTooth | null => {
  if (!viewingSnapshot.value) return null
  const teeth = viewingSnapshot.value.teethState as Array<{
    toothNumber: number
    generalCondition: DentalCondition
    surfaces: ToothSurfaces
    rootCondition?: DentalCondition
    notes: string | null
  }>
  return teeth.find(t => t.toothNumber === toothNumber) as OdontogramTooth | null
}

// Select tooth (general click)
const selectTooth = (toothNumber: number) => {
  const tooth = getToothData(toothNumber)
  if (tooth) {
    selectedTooth.value = tooth
    selectedSurface.value = null
    selectedRoot.value = false
    conditionTab.value = 'crown'
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
    // Determine what to update based on context
    let surface = selectedSurface.value
    let isRoot = selectedRoot.value

    // If no explicit surface/root selected, use tab context
    if (!surface && !isRoot) {
      if (conditionTab.value === 'root') {
        // Root tab → apply as root condition
        isRoot = true
      } else if (conditionTab.value === 'crown') {
        // Crown tab → apply to ALL surfaces at once for visual effect
        const surfaces = ['mesial', 'distal', 'occlusal', 'vestibular', 'palatino'] as const
        for (const s of surfaces) {
          await api.put(`/odontogram/${odontogram.value!.id}/tooth/${selectedTooth.value!.toothNumber}`, {
            condition,
            surface: s,
            isRoot: false,
          })
        }
        await loadOdontogram()
        await loadHistory()
        if (selectedTooth.value) {
          selectedTooth.value = getToothData(selectedTooth.value.toothNumber)
        }
        isSaving.value = false
        return
      }
      // conditionTab === 'tooth' → generalCondition (surface=null, isRoot=false) — default behavior
    }

    await api.put(`/odontogram/${odontogram.value.id}/tooth/${selectedTooth.value.toothNumber}`, {
      condition,
      surface,
      isRoot,
    })
    
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

// Format date
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

// Get condition label by value
const getConditionLabel = (value: string): string => {
  const all = [...crownConditions.value, ...rootConditions.value, ...toothConditions.value]
  return all.find(c => c.value === value)?.label || value
}

// Load clinic color settings
const loadClinicColors = async () => {
  try {
    const response = await api.get<ApiResponse<{ settings: Record<string, any> }>>('/clinics/current')
    if (response.success && response.data?.settings?.odontogramColors) {
      clinicColors.value = response.data.settings.odontogramColors
    }
  } catch (err) {
    console.warn('Could not load clinic color settings', err)
  }
}

// Load on mount
onMounted(async () => {
  await Promise.all([loadOdontogram(), loadClinicColors()])
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
    <div v-else-if="odontogram" class="space-y-3">
      <!-- Top bar: controls + legend -->
      <div class="bg-white rounded-xl border border-surface-200 px-4 py-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <button 
              @click="showRoots = !showRoots"
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors"
              :class="showRoots ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-surface-50 border-surface-300 text-surface-600'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              {{ showRoots ? 'Ocultar Raíces' : 'Mostrar Raíces' }}
            </button>
          </div>
          <router-link 
            v-if="!props.isFullscreen"
            :to="{ name: 'clinic-odontogram-fullscreen', params: { patientId: patientId } }"
            target="_blank"
            class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-surface-300 bg-surface-50 text-surface-700 hover:bg-surface-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Pantalla Completa
          </router-link>
        </div>
        <!-- Inline legend -->
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          <div 
            v-for="cond in allConditions" 
            :key="'legend-' + cond.value"
            class="flex items-center gap-1.5 text-xs text-surface-600"
          >
            <span 
              class="w-3 h-3 rounded-full inline-block flex-shrink-0" 
              :style="{ backgroundColor: cond.color }"
            ></span>
            <span>{{ cond.label }}</span>
          </div>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-3">
        <!-- Dental Chart -->
        <div class="flex-1 bg-white rounded-xl border border-surface-200 p-5 overflow-x-auto">
          <!-- Upper teeth -->
          <div class="mb-8">
            <div class="text-center text-[10px] font-semibold text-surface-400 mb-3 tracking-[0.2em] uppercase">Superior</div>
            <div class="flex justify-center gap-1.5">
              <!-- Upper Right (18-11) -->
              <div class="flex gap-1.5 border-r-2 border-surface-300 pr-2 mr-2">
                <ToothSVG
                  v-for="num in upperRight"
                  :key="num"
                  :toothNumber="num"
                  :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                  :surfaces="getToothData(num)?.surfaces || defaultSurfaces"
                  :rootCondition="getToothData(num)?.rootCondition || 'HEALTHY'"
                  :isSelected="selectedTooth?.toothNumber === num"
                  :isUpper="true"
                  :showRoot="showRoots"
                   :colorOverrides="clinicColors"
                  @click="selectTooth(num)"
                  @surface-click="(s) => selectSurface(num, s)"
                  @root-click="selectRoot(num)"
                />
              </div>
              <!-- Upper Left (21-28) -->
              <div class="flex gap-1.5">
                <ToothSVG
                  v-for="num in upperLeft"
                  :key="num"
                  :toothNumber="num"
                  :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                  :surfaces="getToothData(num)?.surfaces || defaultSurfaces"
                  :rootCondition="getToothData(num)?.rootCondition || 'HEALTHY'"
                  :isSelected="selectedTooth?.toothNumber === num"
                  :isUpper="true"
                  :showRoot="showRoots"
                   :colorOverrides="clinicColors"
                  @click="selectTooth(num)"
                  @surface-click="(s) => selectSurface(num, s)"
                  @root-click="selectRoot(num)"
                />
              </div>
            </div>
          </div>

          <!-- Divider line -->
          <div class="border-t border-surface-200 my-4 relative">
            <span class="absolute left-1/2 -translate-x-1/2 -top-2 bg-white px-4 text-[9px] text-surface-300 font-medium tracking-[0.15em] uppercase">
              Línea media
            </span>
          </div>

          <!-- Lower teeth -->
          <div class="mt-8">
            <div class="flex justify-center gap-1.5">
              <!-- Lower Left (38-31) -->
              <div class="flex gap-1.5 border-r-2 border-surface-300 pr-2 mr-2">
                <ToothSVG
                  v-for="num in lowerLeft"
                  :key="num"
                  :toothNumber="num"
                  :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                  :surfaces="getToothData(num)?.surfaces || defaultSurfaces"
                  :rootCondition="getToothData(num)?.rootCondition || 'HEALTHY'"
                  :isSelected="selectedTooth?.toothNumber === num"
                  :isUpper="false"
                  :showRoot="showRoots"
                   :colorOverrides="clinicColors"
                  @click="selectTooth(num)"
                  @surface-click="(s) => selectSurface(num, s)"
                  @root-click="selectRoot(num)"
                />
              </div>
              <!-- Lower Right (41-48) -->
              <div class="flex gap-1.5">
                <ToothSVG
                  v-for="num in lowerRight"
                  :key="num"
                  :toothNumber="num"
                  :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                  :surfaces="getToothData(num)?.surfaces || defaultSurfaces"
                  :rootCondition="getToothData(num)?.rootCondition || 'HEALTHY'"
                  :isSelected="selectedTooth?.toothNumber === num"
                  :isUpper="false"
                  :showRoot="showRoots"
                   :colorOverrides="clinicColors"
                  @click="selectTooth(num)"
                  @surface-click="(s) => selectSurface(num, s)"
                  @root-click="selectRoot(num)"
                />
              </div>
            </div>
            <div class="text-center text-[10px] font-semibold text-surface-400 mt-3 tracking-[0.2em] uppercase">Inferior</div>
          </div>
        </div>

        <!-- Condition Panel (compact + scrollable) -->
        <div class="w-full lg:w-72 flex-shrink-0">
          <div class="bg-white rounded-xl border border-surface-200 overflow-hidden lg:sticky lg:top-4">
            <div class="px-3 py-2 border-b border-surface-100 bg-surface-50">
              <h3 class="font-semibold text-surface-900 text-xs">Panel de Condiciones</h3>
            </div>
            
            <!-- No selection -->
            <div v-if="!selectedTooth" class="text-center text-surface-400 py-8 px-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mx-auto mb-1.5 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <p class="text-xs">Selecciona un diente, superficie o raíz</p>
            </div>

            <!-- Tooth selected -->
            <div v-else class="p-3 space-y-2 max-h-[420px] overflow-y-auto">
              <!-- Selection info -->
              <div class="flex items-center justify-between bg-surface-50 rounded-lg p-2">
                <div class="min-w-0">
                  <div class="font-semibold text-surface-900 text-sm">Diente {{ selectedTooth.toothNumber }}</div>
                  <div v-if="selectedRoot" class="text-xs text-purple-600 font-medium mt-0.5 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                    Raíz seleccionada
                  </div>
                  <div v-else-if="selectedSurface" class="text-xs text-primary-600 mt-0.5 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-primary-500 inline-block"></span>
                    {{ surfaceLabels[selectedSurface] }}
                  </div>
                  <div v-else class="text-xs text-surface-500 mt-0.5">
                    Condición general
                  </div>
                </div>
                <button 
                  @click="clearSelection" 
                  class="text-surface-400 hover:text-surface-600 p-1 hover:bg-surface-200 rounded transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>

              <!-- Tabs (only for general tooth click, not surface/root) -->
              <div v-if="!selectedSurface && !selectedRoot" class="flex gap-1 bg-surface-100 rounded-lg p-1">
                <button 
                  @click="conditionTab = 'crown'"
                  class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                  :class="conditionTab === 'crown' ? 'bg-white text-primary-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'"
                >
                  Corona
                </button>
                <button 
                  @click="conditionTab = 'root'"
                  class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                  :class="conditionTab === 'root' ? 'bg-white text-purple-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'"
                >
                  Raíz
                </button>
                <button 
                  @click="conditionTab = 'tooth'"
                  class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                  :class="conditionTab === 'tooth' ? 'bg-white text-surface-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'"
                >
                  Diente
                </button>
              </div>

              <!-- Category label -->
              <div class="flex items-center gap-2">
                <div v-if="selectedRoot" class="text-xs font-medium text-purple-600">Condiciones de Raíz</div>
                <div v-else-if="selectedSurface" class="text-xs font-medium text-primary-600">Condiciones de Corona</div>
                <div v-else-if="conditionTab === 'crown'" class="text-xs font-medium text-primary-600">Condiciones de Corona</div>
                <div v-else-if="conditionTab === 'root'" class="text-xs font-medium text-purple-600">Condiciones de Raíz</div>
                <div v-else class="text-xs font-medium text-surface-600">Estado del Diente</div>
                <div class="flex-1 border-t border-surface-100"></div>
              </div>

              <!-- Condition buttons -->
              <div class="space-y-1">
                <button
                  v-for="cond in activeConditions"
                  :key="cond.value"
                  :disabled="isSaving"
                  @click="applyCondition(cond.value)"
                  class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg border transition-all hover:shadow-sm disabled:opacity-50"
                  :class="currentConditionValue === cond.value
                    ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-200'
                    : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'"
                >
                  <div 
                    class="w-3 h-3 rounded-full border-2 flex-shrink-0" 
                    :class="currentConditionValue === cond.value ? 'scale-110' : ''"
                    :style="{ 
                      backgroundColor: cond.color, 
                      borderColor: cond.value === 'HEALTHY' ? '#D1D5DB' : cond.color 
                    }"
                  ></div>
                  <span class="text-left flex-1" :class="currentConditionValue === cond.value ? 'font-medium text-primary-700' : 'text-surface-700'">
                    {{ cond.label }}
                  </span>
                  <svg v-if="currentConditionValue === cond.value" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>

              <!-- Saving indicator -->
              <div v-if="isSaving" class="text-center text-xs text-primary-600 py-1">
                <div class="animate-spin inline-block w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full mr-1"></div>
                Guardando...
              </div>

              <!-- Current state summary -->
              <div v-if="selectedTooth" class="bg-surface-50 rounded-lg p-2 space-y-1">
                <div class="text-[10px] font-medium text-surface-500">Estado actual</div>
                <div class="flex items-center gap-1.5 text-[11px]">
                  <span class="text-surface-400">General:</span>
                  <span class="font-medium text-surface-700">{{ getConditionLabel(selectedTooth.generalCondition) }}</span>
                </div>
                <div class="flex items-center gap-1.5 text-[11px]">
                  <span class="text-surface-400">Raíz:</span>
                  <span class="font-medium text-surface-700">{{ getConditionLabel(selectedTooth.rootCondition || 'HEALTHY') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
          <button 
            @click="showCreateSnapshotModal = true"
            class="w-full px-4 py-2 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Guardar Estado Actual
          </button>
          
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
                        :surfaces="getSnapshotToothData(num)?.surfaces || defaultSurfaces"
                        :rootCondition="getSnapshotToothData(num)?.rootCondition || 'HEALTHY'"
                        :isSelected="false"
                        :isUpper="true"
                        :showRoot="false"
                         :colorOverrides="clinicColors"
                      />
                    </div>
                    <div class="flex gap-0.5">
                      <ToothSVG
                        v-for="num in upperLeft"
                        :key="'snap-' + num"
                        :toothNumber="num"
                        :generalCondition="getSnapshotToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getSnapshotToothData(num)?.surfaces || defaultSurfaces"
                        :rootCondition="getSnapshotToothData(num)?.rootCondition || 'HEALTHY'"
                        :isSelected="false"
                        :isUpper="true"
                        :showRoot="false"
                         :colorOverrides="clinicColors"
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
                        :surfaces="getSnapshotToothData(num)?.surfaces || defaultSurfaces"
                        :rootCondition="getSnapshotToothData(num)?.rootCondition || 'HEALTHY'"
                        :isSelected="false"
                        :isUpper="false"
                        :showRoot="false"
                         :colorOverrides="clinicColors"
                      />
                    </div>
                    <div class="flex gap-0.5">
                      <ToothSVG
                        v-for="num in lowerRight"
                        :key="'snap-' + num"
                        :toothNumber="num"
                        :generalCondition="getSnapshotToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getSnapshotToothData(num)?.surfaces || defaultSurfaces"
                        :rootCondition="getSnapshotToothData(num)?.rootCondition || 'HEALTHY'"
                        :isSelected="false"
                        :isUpper="false"
                        :showRoot="false"
                         :colorOverrides="clinicColors"
                      />
                    </div>
                  </div>
                  <div class="text-center text-xs font-medium text-surface-400 mt-2">INFERIOR</div>
                </div>
              </div>
              
              <!-- Current (After) -->
              <div class="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
                <div class="text-center mb-4">
                  <span class="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    ACTUAL (Después)
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
                        :surfaces="getToothData(num)?.surfaces || defaultSurfaces"
                        :rootCondition="getToothData(num)?.rootCondition || 'HEALTHY'"
                        :isSelected="false"
                        :isUpper="true"
                        :showRoot="false"
                         :colorOverrides="clinicColors"
                      />
                    </div>
                    <div class="flex gap-0.5">
                      <ToothSVG
                        v-for="num in upperLeft"
                        :key="'curr-' + num"
                        :toothNumber="num"
                        :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getToothData(num)?.surfaces || defaultSurfaces"
                        :rootCondition="getToothData(num)?.rootCondition || 'HEALTHY'"
                        :isSelected="false"
                        :isUpper="true"
                        :showRoot="false"
                         :colorOverrides="clinicColors"
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
                        :surfaces="getToothData(num)?.surfaces || defaultSurfaces"
                        :rootCondition="getToothData(num)?.rootCondition || 'HEALTHY'"
                        :isSelected="false"
                        :isUpper="false"
                        :showRoot="false"
                         :colorOverrides="clinicColors"
                      />
                    </div>
                    <div class="flex gap-0.5">
                      <ToothSVG
                        v-for="num in lowerRight"
                        :key="'curr-' + num"
                        :toothNumber="num"
                        :generalCondition="getToothData(num)?.generalCondition || 'HEALTHY'"
                        :surfaces="getToothData(num)?.surfaces || defaultSurfaces"
                        :rootCondition="getToothData(num)?.rootCondition || 'HEALTHY'"
                        :isSelected="false"
                        :isUpper="false"
                        :showRoot="false"
                         :colorOverrides="clinicColors"
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
                  v-for="cond in allConditions" 
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
    </div>
  </div>
</template>

<style scoped>
.odontogram-container {
  min-height: 400px;
}
</style>
