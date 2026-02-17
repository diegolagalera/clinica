<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToast'
import type { ApiResponse } from '@/types'
import {
  PlusIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  PencilIcon,
  CheckIcon,
  ExclamationCircleIcon,
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()

interface PrescriptionItem {
  medication: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

interface Prescription {
  id: string
  items: PrescriptionItem[]
  diagnosis: string | null
  notes: string | null
  pdfStorageKey: string | null
  createdAt: string
  prescribedBy: {
    id: string
    firstName: string | null
    lastName: string | null
    licenseNumber: string | null
  }
}

interface CommonMedication {
  id?: string
  medication: string
  category: string
  defaultDosage: string
  defaultFrequency: string
  defaultDuration: string
}

const props = defineProps<{
  patientId: string
}>()

const clinicId = computed(() => authStore.currentClinicId || '')

// State
const prescriptions = ref<Prescription[]>([])
const isLoading = ref(false)
const showForm = ref(false)
const isSaving = ref(false)
const expandedId = ref<string | null>(null)
const hasSignature = ref(true) // optimistic default

// Medications catalog
const medications = ref<CommonMedication[]>([])
const medicationSearch = ref('')
const showMedicationDropdown = ref(false)

// Form
const form = ref({
  diagnosis: '',
  notes: '',
  items: [{ medication: '', dosage: '', frequency: '', duration: '', instructions: '' }] as PrescriptionItem[],
})

// Delete confirmation
const deletingId = ref<string | null>(null)

// Filtered medications for search
const filteredMedications = computed(() => {
  if (!medicationSearch.value) return medications.value
  const q = medicationSearch.value.toLowerCase()
  return medications.value.filter(m =>
    m.medication.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
  )
})

// Grouped medications by category
const groupedMedications = computed(() => {
  const groups: Record<string, CommonMedication[]> = {}
  filteredMedications.value.forEach(m => {
    if (!groups[m.category]) groups[m.category] = []
    groups[m.category]!.push(m)
  })
  return groups
})

// Load prescriptions
const fetchPrescriptions = async () => {
  isLoading.value = true
  try {
    const res = await api.get<ApiResponse<Prescription[]>>(`/prescriptions/patient/${props.patientId}`)
    prescriptions.value = (res as any).data || []
  } catch {
    toast.error('Error al cargar recetas')
  } finally {
    isLoading.value = false
  }
}

// Load medications catalog
const fetchMedications = async () => {
  try {
    const res = await api.get<ApiResponse<CommonMedication[]>>('/prescriptions/medications')
    medications.value = (res as any).data || []
  } catch {
    // Non-blocking
  }
}

// Add medication item
const addItem = () => {
  form.value.items.push({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })
}

// Remove medication item
const removeItem = (idx: number) => {
  if (form.value.items.length > 1) {
    form.value.items.splice(idx, 1)
  }
}

// Select a medication from the catalog
const selectMedication = (med: CommonMedication, itemIdx: number) => {
  const item = form.value.items[itemIdx]
  if (!item) return
  item.medication = med.medication
  item.dosage = med.defaultDosage
  item.frequency = med.defaultFrequency
  item.duration = med.defaultDuration
  showMedicationDropdown.value = false
  medicationSearch.value = ''
}

// Create prescription
const createPrescription = async () => {
  // Validate: at least one item with medication
  const validItems = form.value.items.filter(i => i.medication.trim())
  if (validItems.length === 0) {
    toast.error('Añade al menos un medicamento')
    return
  }

  isSaving.value = true
  try {
    await api.post('/prescriptions', {
      clinicId: clinicId.value,
      patientId: props.patientId,
      items: validItems.map(i => ({
        medication: i.medication,
        dosage: i.dosage || '-',
        frequency: i.frequency || '-',
        duration: i.duration || '-',
        instructions: i.instructions || '',
      })),
      diagnosis: form.value.diagnosis || undefined,
      notes: form.value.notes || undefined,
    })
    toast.success('Receta creada correctamente')
    showForm.value = false
    resetForm()
    await fetchPrescriptions()
  } catch {
    toast.error('Error al crear receta')
  } finally {
    isSaving.value = false
  }
}

// Delete prescription
const confirmDelete = async (id: string) => {
  deletingId.value = id
}

const doDelete = async () => {
  if (!deletingId.value) return
  try {
    await api.delete(`/prescriptions/${deletingId.value}`)
    toast.success('Receta eliminada')
    deletingId.value = null
    await fetchPrescriptions()
  } catch {
    toast.error('Error al eliminar receta')
  }
}

// Download PDF
const downloadPdf = async (prescriptionId: string) => {
  try {
    const res = await api.get<Blob>(`/prescriptions/${prescriptionId}/pdf`, {
      responseType: 'blob',
    })
    const blob = res instanceof Blob ? res : new Blob([res as any])
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `receta_${prescriptionId.slice(0, 8)}.pdf`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch {
    toast.error('Error al descargar PDF')
  }
}

// Toggle expand
const toggleExpand = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id
}

// Reset form
const resetForm = () => {
  form.value = {
    diagnosis: '',
    notes: '',
    items: [{ medication: '', dosage: '', frequency: '', duration: '', instructions: '' }],
  }
}

// Format date
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Active medication item for catalog selection
const activeMedItemIdx = ref(0)

// Handle blur on medication input — delay so mousedown on dropdown fires first
const handleMedBlur = () => {
  window.setTimeout(() => { showMedicationDropdown.value = false }, 200)
}

// ── Medications Management Modal ──
const showMedModal = ref(false)
const editingMed = ref<CommonMedication | null>(null)
const medForm = ref({
  medication: '',
  category: '',
  defaultDosage: '',
  defaultFrequency: '',
  defaultDuration: '',
})
const isSavingMed = ref(false)

const categoryOptions = [
  'Antibiótico', 'Antiinflamatorio', 'Analgésico', 'Corticoide',
  'Antiséptico', 'Antifúngico', 'Protector gástrico', 'Otro'
]

const openMedModal = () => {
  showMedModal.value = true
  editingMed.value = null
  resetMedForm()
}

const resetMedForm = () => {
  medForm.value = { medication: '', category: 'Antibiótico', defaultDosage: '', defaultFrequency: '', defaultDuration: '' }
  editingMed.value = null
}

const startEditMed = (med: CommonMedication) => {
  editingMed.value = med
  medForm.value = {
    medication: med.medication,
    category: med.category,
    defaultDosage: med.defaultDosage,
    defaultFrequency: med.defaultFrequency,
    defaultDuration: med.defaultDuration,
  }
}

const saveMed = async () => {
  if (!medForm.value.medication.trim()) {
    toast.error('El nombre del medicamento es obligatorio')
    return
  }
  isSavingMed.value = true
  try {
    if (editingMed.value?.id) {
      await api.put(`/prescriptions/medications/${editingMed.value.id}`, medForm.value)
      toast.success('Medicamento actualizado')
    } else {
      await api.post('/prescriptions/medications', medForm.value)
      toast.success('Medicamento añadido')
    }
    resetMedForm()
    await fetchMedications()
  } catch {
    toast.error('Error al guardar medicamento')
  } finally {
    isSavingMed.value = false
  }
}

const deleteMed = async (med: CommonMedication) => {
  if (!med.id) return
  try {
    await api.delete(`/prescriptions/medications/${med.id}`)
    toast.success('Medicamento eliminado')
    await fetchMedications()
  } catch {
    toast.error('Error al eliminar')
  }
}

// Grouped medications for management modal
const medModalGroups = computed(() => {
  const groups: Record<string, CommonMedication[]> = {}
  medications.value.forEach(m => {
    if (!groups[m.category]) groups[m.category] = []
    groups[m.category]!.push(m)
  })
  return groups
})

onMounted(() => {
  fetchPrescriptions()
  fetchMedications()
  // Check if user has signature configured
  api.get<ApiResponse<{ signatureImage?: string | null }>>('/staff/me')
    .then((res: any) => { hasSignature.value = !!res?.data?.signatureImage })
    .catch(() => { /* non-blocking */ })
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-surface-900">Recetas médicas</h3>
      <div class="flex items-center gap-2">
        <button
          @click="openMedModal"
          class="btn-ghost text-surface-500 hover:text-surface-700 p-2 rounded-lg"
          title="Gestionar medicamentos"
        >
          <Cog6ToothIcon class="w-5 h-5" />
        </button>
        <button
          v-if="!showForm"
          @click="showForm = true"
          class="btn-primary flex items-center gap-2 text-sm"
        >
          <PlusIcon class="w-4 h-4" />
          Nueva receta
        </button>
      </div>
    </div>

    <!-- New Prescription Form -->
    <div v-if="showForm" class="card p-6 space-y-5 border-2 border-primary-200 bg-primary-50/30">
      <div class="flex items-center justify-between">
        <h4 class="text-base font-semibold text-surface-900">Nueva receta</h4>
        <button @click="showForm = false; resetForm()" class="text-surface-400 hover:text-surface-600">
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- Signature warning banner -->
      <div v-if="!hasSignature" class="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <ExclamationCircleIcon class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <p class="text-sm text-amber-700">
          No tiene firma digital configurada. La receta se creará sin firma. Puede añadirla desde
          <span class="font-semibold">Editar perfil → Firma</span>.
        </p>
      </div>

      <!-- Diagnosis -->
      <div>
        <label class="block text-sm font-medium text-surface-700 mb-1">Diagnóstico (opcional)</label>
        <input
          v-model="form.diagnosis"
          type="text"
          class="input w-full"
          placeholder="Ej: Infección periapical en pieza 36"
        />
      </div>

      <!-- Medication items -->
      <div class="space-y-4">
        <label class="block text-sm font-medium text-surface-700">Medicamentos</label>

        <div v-for="(item, idx) in form.items" :key="idx" class="bg-white rounded-xl p-4 border border-surface-200 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-surface-400 uppercase tracking-wider">Medicamento {{ idx + 1 }}</span>
            <button
              v-if="form.items.length > 1"
              @click="removeItem(idx)"
              class="text-red-400 hover:text-red-600 p-1"
            >
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>

          <!-- Medication name + catalog search -->
          <div class="relative">
            <input
              v-model="item.medication"
              type="text"
              class="input w-full pr-10"
              placeholder="Nombre del medicamento"
              @focus="activeMedItemIdx = idx; showMedicationDropdown = true; medicationSearch = item.medication"
              @input="activeMedItemIdx = idx; showMedicationDropdown = true; medicationSearch = item.medication"
              @blur="handleMedBlur"
            />
            <MagnifyingGlassIcon class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />

            <!-- Medication dropdown -->
            <div
              v-if="showMedicationDropdown && activeMedItemIdx === idx && filteredMedications.length > 0"
              class="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-xl max-h-60 overflow-y-auto"
            >
              <template v-for="(meds, category) in groupedMedications" :key="category">
                <p class="px-3 py-1.5 text-xs font-semibold text-surface-400 uppercase tracking-wider bg-surface-50 sticky top-0">
                  {{ category }}
                </p>
                <button
                  v-for="med in meds"
                  :key="med.medication"
                  @mousedown.prevent="selectMedication(med, idx)"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors"
                >
                  <span class="font-medium text-surface-800">{{ med.medication }}</span>
                  <span class="text-xs text-surface-400 ml-2">{{ med.defaultDosage }} · {{ med.defaultFrequency }}</span>
                </button>
              </template>
            </div>
          </div>

          <!-- Dosage, Frequency, Duration -->
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-surface-500 mb-1">Dosis</label>
              <input v-model="item.dosage" type="text" class="input w-full text-sm" placeholder="1 comprimido" />
            </div>
            <div>
              <label class="block text-xs text-surface-500 mb-1">Frecuencia</label>
              <input v-model="item.frequency" type="text" class="input w-full text-sm" placeholder="Cada 8 horas" />
            </div>
            <div>
              <label class="block text-xs text-surface-500 mb-1">Duración</label>
              <input v-model="item.duration" type="text" class="input w-full text-sm" placeholder="7 días" />
            </div>
          </div>

          <!-- Instructions -->
          <div>
            <label class="block text-xs text-surface-500 mb-1">Indicaciones (opcional)</label>
            <input v-model="item.instructions" type="text" class="input w-full text-sm" placeholder="Tomar después de las comidas" />
          </div>
        </div>

        <button
          @click="addItem"
          class="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <PlusIcon class="w-4 h-4" />
          Añadir medicamento
        </button>
      </div>

      <!-- Notes -->
      <div>
        <label class="block text-sm font-medium text-surface-700 mb-1">Indicaciones adicionales (opcional)</label>
        <textarea
          v-model="form.notes"
          class="input w-full text-sm"
          rows="2"
          placeholder="Notas adicionales para el paciente..."
        ></textarea>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-2">
        <button @click="showForm = false; resetForm()" class="btn-secondary text-sm">
          Cancelar
        </button>
        <button
          @click="createPrescription"
          :disabled="isSaving"
          class="btn-primary text-sm flex items-center gap-2"
        >
          <template v-if="isSaving">
            <svg class="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generando...
          </template>
          <template v-else>
            <ClipboardDocumentListIcon class="w-4 h-4" />
            Crear receta y generar PDF
          </template>
        </button>
      </div>
    </div>

    <!-- Prescriptions list -->
    <div v-if="isLoading" class="text-center py-10">
      <svg class="animate-spin h-8 w-8 mx-auto text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-sm text-surface-500 mt-2">Cargando recetas...</p>
    </div>

    <div v-else-if="prescriptions.length === 0 && !showForm" class="text-center py-12 card">
      <ClipboardDocumentListIcon class="w-12 h-12 mx-auto text-surface-300 mb-3" />
      <p class="text-surface-500 font-medium">Sin recetas</p>
      <p class="text-sm text-surface-400 mt-1">Este paciente no tiene recetas generadas aún</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="rx in prescriptions"
        :key="rx.id"
        class="card overflow-hidden"
      >
        <!-- Prescription header -->
        <div
          class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-50 transition-colors"
          @click="toggleExpand(rx.id)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 bg-blue-100 rounded-lg shrink-0">
              <ClipboardDocumentListIcon class="w-5 h-5 text-blue-600" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-semibold text-surface-900">
                  {{ (rx.items as PrescriptionItem[]).map((i: PrescriptionItem) => i.medication).join(', ') }}
                </p>
              </div>
              <p class="text-xs text-surface-400 mt-0.5">
                {{ formatDate(rx.createdAt) }} · Dr/a. {{ rx.prescribedBy?.firstName }} {{ rx.prescribedBy?.lastName }}
                <span v-if="rx.prescribedBy?.licenseNumber" class="ml-1">({{ rx.prescribedBy.licenseNumber }})</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              v-if="rx.pdfStorageKey"
              @click.stop="downloadPdf(rx.id)"
              class="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Descargar PDF"
            >
              <DocumentArrowDownIcon class="w-5 h-5" />
            </button>
            <button
              @click.stop="confirmDelete(rx.id)"
              class="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar"
            >
              <TrashIcon class="w-4 h-4" />
            </button>
            <component :is="expandedId === rx.id ? ChevronUpIcon : ChevronDownIcon" class="w-4 h-4 text-surface-400" />
          </div>
        </div>

        <!-- Expanded detail -->
        <div v-if="expandedId === rx.id" class="px-4 pb-4 border-t border-surface-100">
          <div v-if="rx.diagnosis" class="mt-3">
            <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Diagnóstico</p>
            <p class="text-sm text-surface-700">{{ rx.diagnosis }}</p>
          </div>

          <div class="mt-3">
            <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Medicamentos</p>
            <div class="space-y-2">
              <div
                v-for="(item, idx) in (rx.items as PrescriptionItem[])"
                :key="idx"
                class="bg-surface-50 rounded-lg p-3"
              >
                <p class="text-sm font-semibold text-surface-800">{{ idx + 1 }}. {{ item.medication }}</p>
                <p class="text-xs text-surface-500 mt-0.5">
                  {{ item.dosage }} — {{ item.frequency }} — {{ item.duration }}
                </p>
                <p v-if="item.instructions" class="text-xs text-surface-400 italic mt-0.5">{{ item.instructions }}</p>
              </div>
            </div>
          </div>

          <div v-if="rx.notes" class="mt-3">
            <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Indicaciones adicionales</p>
            <p class="text-sm text-surface-600">{{ rx.notes }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <div v-if="deletingId" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="deletingId = null"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in p-6 text-center">
          <div class="p-3 bg-red-100 rounded-full w-fit mx-auto mb-4">
            <ExclamationTriangleIcon class="w-6 h-6 text-red-600" />
          </div>
          <h3 class="text-lg font-semibold text-surface-900 mb-2">¿Eliminar receta?</h3>
          <p class="text-sm text-surface-500 mb-6">Esta acción no se puede deshacer. Se eliminará también el PDF generado.</p>
          <div class="flex gap-3 justify-center">
            <button @click="deletingId = null" class="btn-secondary text-sm px-6">Cancelar</button>
            <button @click="doDelete" class="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <!-- Medications Management Modal -->
    <Teleport to="body">
      <div v-if="showMedModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showMedModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-surface-200">
            <h3 class="text-lg font-semibold text-surface-900">Gestionar medicamentos</h3>
            <button @click="showMedModal = false" class="p-1 hover:bg-surface-100 rounded-lg">
              <XMarkIcon class="w-5 h-5 text-surface-500" />
            </button>
          </div>

          <!-- Add/Edit form -->
          <div class="p-4 border-b border-surface-100 bg-surface-50">
            <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
              {{ editingMed ? 'Editar medicamento' : 'Añadir nuevo medicamento' }}
            </p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <input v-model="medForm.medication" type="text" class="input w-full text-sm" placeholder="Nombre del medicamento *" />
              </div>
              <div>
                <select v-model="medForm.category" class="input w-full text-sm">
                  <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>
              <div>
                <input v-model="medForm.defaultDosage" type="text" class="input w-full text-sm" placeholder="Dosis por defecto" />
              </div>
              <div>
                <input v-model="medForm.defaultFrequency" type="text" class="input w-full text-sm" placeholder="Frecuencia por defecto" />
              </div>
              <div>
                <input v-model="medForm.defaultDuration" type="text" class="input w-full text-sm" placeholder="Duración por defecto" />
              </div>
              <div class="flex items-end gap-2">
                <button @click="saveMed" :disabled="isSavingMed" class="btn-primary text-sm flex items-center gap-1.5">
                  <CheckIcon class="w-4 h-4" />
                  {{ editingMed ? 'Actualizar' : 'Añadir' }}
                </button>
                <button v-if="editingMed" @click="resetMedForm" class="btn-secondary text-sm">Cancelar</button>
              </div>
            </div>
          </div>

          <!-- Medications list -->
          <div class="flex-1 overflow-y-auto p-4">
            <template v-for="(meds, category) in medModalGroups" :key="category">
              <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">{{ category }}</p>
              <div class="space-y-1">
                <div
                  v-for="med in meds"
                  :key="med.id || med.medication"
                  class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-50 group"
                >
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-surface-800 truncate">{{ med.medication }}</p>
                    <p class="text-xs text-surface-400">{{ med.defaultDosage }} · {{ med.defaultFrequency }} · {{ med.defaultDuration }}</p>
                  </div>
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button @click="startEditMed(med)" class="p-1.5 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-primary-50">
                      <PencilIcon class="w-4 h-4" />
                    </button>
                    <button @click="deleteMed(med)" class="p-1.5 text-surface-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                      <TrashIcon class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </template>
            <div v-if="medications.length === 0" class="text-center py-8 text-surface-400">
              <p class="text-sm">No hay medicamentos configurados. Añade uno arriba.</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
