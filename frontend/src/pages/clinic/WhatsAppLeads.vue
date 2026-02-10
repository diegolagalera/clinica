<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/services/api'
import { useToast } from '@/composables/useToast'
import {
  UserGroupIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  UserPlusIcon,
  SparklesIcon,
  PencilIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

const toast = useToast()

const leads = ref<any[]>([])
const loading = ref(true)
const filterStatus = ref('')
const searchQuery = ref('')
const showEditModal = ref(false)
const editingLead = ref<any>(null)
const saving = ref(false)
const showConvertModal = ref(false)
const converting = ref(false)

const editForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  notes: '',
  status: '',
})

const convertForm = ref({
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
})

const fetchLeads = async () => {
  loading.value = true
  try {
    const params: any = {}
    if (filterStatus.value) params.status = filterStatus.value
    const res = await api.get<any>('/chatbot/leads', { params })
    leads.value = res.data || []
  } catch (err: any) {
    console.error('Failed to load leads', err)
  } finally {
    loading.value = false
  }
}

const filteredLeads = computed(() => {
  if (!searchQuery.value) return leads.value
  const q = searchQuery.value.toLowerCase()
  return leads.value.filter(l =>
    (l.firstName || '').toLowerCase().includes(q) ||
    (l.lastName || '').toLowerCase().includes(q) ||
    (l.phone || '').includes(q) ||
    (l.email || '').toLowerCase().includes(q)
  )
})

const openEdit = (lead: any) => {
  editingLead.value = lead
  editForm.value = {
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    email: lead.email || '',
    notes: lead.notes || '',
    status: lead.status || 'NEW',
  }
  showEditModal.value = true
}

const saveLead = async () => {
  if (!editingLead.value) return
  saving.value = true
  try {
    const res = await api.put<any>(`/chatbot/leads/${editingLead.value.id}`, editForm.value)
    const idx = leads.value.findIndex(l => l.id === editingLead.value.id)
    if (idx !== -1) leads.value.splice(idx, 1, res.data)
    showEditModal.value = false
    toast.success('Lead actualizado')
  } catch (err: any) {
    toast.error('Error actualizando lead')
  } finally {
    saving.value = false
  }
}

const openConvert = (lead: any) => {
  editingLead.value = lead
  convertForm.value = {
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    phone: lead.phone || '',
    email: lead.email || '',
  }
  showConvertModal.value = true
}

const convertLead = async () => {
  if (!editingLead.value || !convertForm.value.firstName || !convertForm.value.lastName) return
  converting.value = true
  try {
    await api.post(`/chatbot/leads/${editingLead.value.id}/convert`, convertForm.value)
    showConvertModal.value = false
    toast.success('Lead convertido a paciente correctamente')
    fetchLeads()
  } catch (err: any) {
    toast.error('Error convirtiendo lead')
  } finally {
    converting.value = false
  }
}

const formatDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'NEW': return { label: 'Nuevo', color: 'bg-blue-100 text-blue-700', icon: SparklesIcon }
    case 'CONTACTED': return { label: 'Contactado', color: 'bg-amber-100 text-amber-700', icon: ClockIcon }
    case 'QUALIFIED': return { label: 'Cualificado', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon }
    case 'CONVERTED': return { label: 'Convertido', color: 'bg-emerald-100 text-emerald-700', icon: UserPlusIcon }
    case 'LOST': return { label: 'Perdido', color: 'bg-surface-100 text-surface-500', icon: XCircleIcon }
    default: return { label: status, color: 'bg-surface-100 text-surface-600', icon: ClockIcon }
  }
}

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'NEW', label: 'Nuevos' },
  { value: 'CONTACTED', label: 'Contactados' },
  { value: 'QUALIFIED', label: 'Cualificados' },
  { value: 'CONVERTED', label: 'Convertidos' },
  { value: 'LOST', label: 'Perdidos' },
]

onMounted(fetchLeads)
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <router-link to="/clinic/whatsapp" class="p-2 hover:bg-surface-100 rounded-lg">
          <ArrowLeftIcon class="w-5 h-5 text-surface-500" />
        </router-link>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <UserGroupIcon class="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-surface-900">Leads (Potenciales Pacientes)</h1>
            <p class="text-xs text-surface-500">Contactos que escribieron por WhatsApp y no son pacientes registrados</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative flex-1 max-w-xs">
        <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar lead..."
          class="input w-full pl-9 text-sm h-9"
        />
      </div>
      <div class="flex gap-1.5">
        <button
          v-for="s in statusOptions"
          :key="s.value"
          @click="filterStatus = s.value; fetchLeads()"
          :class="[
            'px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
            filterStatus === s.value
              ? 'bg-primary-100 text-primary-700'
              : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          ]"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <ArrowPathIcon class="w-8 h-8 text-surface-400 animate-spin" />
    </div>

    <!-- Empty -->
    <div v-else-if="filteredLeads.length === 0" class="card p-12 text-center">
      <UserGroupIcon class="w-16 h-16 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-semibold text-surface-700">Sin leads</h3>
      <p class="text-sm text-surface-400 mt-1">Los leads se crean automáticamente cuando un número desconocido escribe por WhatsApp.</p>
    </div>

    <!-- Lead Table -->
    <div v-else class="card overflow-hidden">
      <table class="w-full">
        <thead class="bg-surface-50">
          <tr>
            <th class="text-left text-xs font-medium text-surface-500 uppercase px-4 py-3">Contacto</th>
            <th class="text-left text-xs font-medium text-surface-500 uppercase px-4 py-3">Teléfono</th>
            <th class="text-left text-xs font-medium text-surface-500 uppercase px-4 py-3">Estado</th>
            <th class="text-left text-xs font-medium text-surface-500 uppercase px-4 py-3">Fuente</th>
            <th class="text-left text-xs font-medium text-surface-500 uppercase px-4 py-3">Fecha</th>
            <th class="text-right text-xs font-medium text-surface-500 uppercase px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-100">
          <tr v-for="lead in filteredLeads" :key="lead.id" class="hover:bg-surface-50">
            <td class="px-4 py-3">
              <div>
                <p class="text-sm font-medium text-surface-900">
                  {{ lead.firstName || '—' }} {{ lead.lastName || '' }}
                </p>
                <p v-if="lead.email" class="text-xs text-surface-500 flex items-center gap-1">
                  <EnvelopeIcon class="w-3 h-3" />
                  {{ lead.email }}
                </p>
              </div>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm text-surface-700 flex items-center gap-1.5">
                <PhoneIcon class="w-3.5 h-3.5 text-surface-400" />
                {{ lead.phone }}
              </span>
            </td>
            <td class="px-4 py-3">
              <span :class="['inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', getStatusConfig(lead.status).color]">
                <component :is="getStatusConfig(lead.status).icon" class="w-3 h-3" />
                {{ getStatusConfig(lead.status).label }}
              </span>
            </td>
            <td class="px-4 py-3">
              <span class="text-xs text-surface-500">{{ lead.source || 'whatsapp' }}</span>
            </td>
            <td class="px-4 py-3">
              <span class="text-xs text-surface-500">{{ formatDate(lead.createdAt) }}</span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <button @click="openEdit(lead)" class="p-1.5 hover:bg-surface-100 rounded-lg" title="Editar">
                  <PencilIcon class="w-4 h-4 text-surface-500" />
                </button>
                <button
                  v-if="lead.status !== 'CONVERTED'"
                  @click="openConvert(lead)"
                  class="p-1.5 hover:bg-green-50 rounded-lg"
                  title="Convertir a paciente"
                >
                  <UserPlusIcon class="w-4 h-4 text-green-600" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Lead Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showEditModal = false">
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full">
          <div class="flex items-center justify-between p-4 border-b border-surface-200">
            <h3 class="font-semibold text-surface-900">Editar Lead</h3>
            <button @click="showEditModal = false"><XMarkIcon class="w-5 h-5 text-surface-500" /></button>
          </div>
          <form @submit.prevent="saveLead" class="p-4 space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Nombre</label>
                <input v-model="editForm.firstName" class="input w-full" />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Apellido</label>
                <input v-model="editForm.lastName" class="input w-full" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Email</label>
              <input v-model="editForm.email" type="email" class="input w-full" />
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Estado</label>
              <select v-model="editForm.status" class="input w-full">
                <option value="NEW">Nuevo</option>
                <option value="CONTACTED">Contactado</option>
                <option value="QUALIFIED">Cualificado</option>
                <option value="LOST">Perdido</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Notas</label>
              <textarea v-model="editForm.notes" class="input w-full" rows="3"></textarea>
            </div>
            <div class="flex gap-3">
              <button type="button" @click="showEditModal = false" class="btn-secondary flex-1">Cancelar</button>
              <button type="submit" class="btn-primary flex-1" :disabled="saving">
                {{ saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Convert Lead to Patient Modal -->
    <Teleport to="body">
      <div v-if="showConvertModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showConvertModal = false">
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full">
          <div class="flex items-center justify-between p-4 border-b border-surface-200">
            <div>
              <h3 class="font-semibold text-surface-900">Convertir Lead a Paciente</h3>
              <p class="text-xs text-surface-500 mt-0.5">Revisa los datos y completa los campos necesarios</p>
            </div>
            <button @click="showConvertModal = false"><XMarkIcon class="w-5 h-5 text-surface-500" /></button>
          </div>
          <form @submit.prevent="convertLead" class="p-4 space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Nombre <span class="text-red-500">*</span></label>
                <input v-model="convertForm.firstName" class="input w-full" required placeholder="Nombre" />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Apellido <span class="text-red-500">*</span></label>
                <input v-model="convertForm.lastName" class="input w-full" required placeholder="Apellido" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Teléfono</label>
              <input v-model="convertForm.phone" class="input w-full" placeholder="+34..." />
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Email</label>
              <input v-model="convertForm.email" type="email" class="input w-full" placeholder="email@ejemplo.com" />
            </div>
            <div class="bg-blue-50 rounded-lg p-3">
              <p class="text-xs text-blue-700">
                Se creará un nuevo paciente con estos datos y se vinculará automáticamente a la conversación de WhatsApp.
              </p>
            </div>
            <div class="flex gap-3">
              <button type="button" @click="showConvertModal = false" class="btn-secondary flex-1">Cancelar</button>
              <button type="submit" class="btn-primary flex-1" :disabled="!convertForm.firstName || !convertForm.lastName || converting">
                {{ converting ? 'Convirtiendo...' : 'Convertir a Paciente' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
