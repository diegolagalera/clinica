<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import type { User, Clinic, ApiResponse, ModulePermission } from '@/types'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  UserPlusIcon,
  UserIcon,
  BuildingStorefrontIcon,
  KeyIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  NoSymbolIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline'
import PhoneCountrySelect from '@/components/PhoneCountrySelect.vue'

interface StaffMember extends User {
  staffProfile?: {
    licenseNumber?: string
    specialty?: string
    bio?: string
    color?: string
  }
  workerClinics?: Array<{
    id: string
    clinicId: string
    role?: string
    permissions?: string[]
    clinic: Clinic
  }>
  clinic?: Clinic
  isActive?: boolean
  clinicRole?: string
  permissions?: string[]
}

// Available module permissions
const modulePermissions: { key: ModulePermission; label: string; description: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', description: 'Chat, configuración y leads' },
  { key: 'ratings', label: 'Valoraciones', description: 'Ver y gestionar valoraciones' },
  { key: 'marketing', label: 'Marketing', description: 'Campañas y plantillas' },
  { key: 'staff', label: 'Personal', description: 'Gestionar el equipo' },
  { key: 'stock', label: 'Inventario', description: 'Stock, proveedores y analítica' },
  { key: 'settings', label: 'Configuración', description: 'SMS, email y ajustes' },
]

interface PaginatedResponse {
  items: StaffMember[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const authStore = useAuthStore()

// State
const staff = ref<StaffMember[]>([])
const total = ref(0)
const page = ref(1)
const limit = ref(10)
const totalPages = computed(() => Math.ceil(total.value / limit.value))
const availableClinics = ref<Clinic[]>([])
const isLoading = ref(true)
const error = ref('')
const searchQuery = ref('')
const roleFilter = ref('')

// Modal state
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showResetPasswordModal = ref(false)
const showAssignClinicsModal = ref(false)
const showConfirmModal = ref(false)
const selectedStaff = ref<StaffMember | null>(null)

// Confirmation modal state
const confirmAction = ref<{
  title: string
  message: string
  confirmText: string
  confirmClass: string
  action: () => Promise<void>
} | null>(null)

// Country codes list (most common for Spain market)
const countryCodes = [
  { code: '+34', country: 'ES', name: 'España', flag: '🇪🇸' },
  { code: '+33', country: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: '+351', country: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: '+44', country: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  { code: '+49', country: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: '+39', country: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: '+212', country: 'MA', name: 'Marruecos', flag: '🇲🇦' },
  { code: '+52', country: 'MX', name: 'México', flag: '🇲🇽' },
  { code: '+54', country: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: '+57', country: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: '+1', country: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+55', country: 'BR', name: 'Brasil', flag: '🇧🇷' },
]

// Forms
const userForm = ref({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phoneCountry: '+34',
  phoneNumber: '',
  role: 'WORKER' as 'ADMIN' | 'WORKER' | 'USER',
  clinicIds: [] as string[],
  licenseNumber: '',
  specialty: '',
  clinicPermissions: {} as Record<string, string[]>,
})

const resetPasswordForm = ref({
  newPassword: '',
  confirmPassword: '',
})

const isSaving = ref(false)
const formError = ref('')

// Load staff
const loadStaff = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: limit.value.toString(),
    })
    if (searchQuery.value) params.append('search', searchQuery.value)
    if (roleFilter.value) params.append('role', roleFilter.value)
    
    const response = await api.get<ApiResponse<{ data: StaffMember[], pagination: { total: number } }>>(`/users/org?${params}`)
    if (response.success && response.data) {
      // The API returns { data: [...items], pagination: { total, ... } }
      staff.value = response.data.data || []
      total.value = response.data.pagination?.total || 0
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error loading staff'
  } finally {
    isLoading.value = false
  }
}

// Load clinics
const loadClinics = async () => {
  try {
    const response = await api.get<ApiResponse<Clinic[]>>('/users/clinics')
    if (response.success && response.data) {
      availableClinics.value = response.data
    }
  } catch {
    // Handle error
  }
}

// Debounced search
let searchTimeout: number | undefined
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    page.value = 1
    loadStaff()
  }, 300)
})

watch([roleFilter], () => {
  page.value = 1
  loadStaff()
})

// Create user
const createUser = async () => {
  formError.value = ''
  isSaving.value = true
  
  try {
    await api.post('/users/org', {
      email: userForm.value.email,
      password: userForm.value.password,
      firstName: userForm.value.firstName,
      lastName: userForm.value.lastName,
      phone: userForm.value.phoneNumber ? `${userForm.value.phoneCountry}${userForm.value.phoneNumber}` : undefined,
      role: userForm.value.role,
      clinicIds: userForm.value.clinicIds.length > 0 ? userForm.value.clinicIds : undefined,
      licenseNumber: userForm.value.role === 'WORKER' ? userForm.value.licenseNumber || undefined : undefined,
      specialty: userForm.value.role === 'WORKER' ? userForm.value.specialty || undefined : undefined,
    })
    showCreateModal.value = false
    resetUserForm()
    await loadStaff()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error creating user'
  } finally {
    isSaving.value = false
  }
}

// Update user
const updateUser = async () => {
  if (!selectedStaff.value) return
  
  formError.value = ''
  isSaving.value = true
  
  try {
    await api.put(`/users/org/${selectedStaff.value.id}`, {
      firstName: userForm.value.firstName,
      lastName: userForm.value.lastName,
      phone: userForm.value.phoneNumber ? `${userForm.value.phoneCountry}${userForm.value.phoneNumber}` : undefined,
      role: userForm.value.role,
      clinicIds: userForm.value.clinicIds,
      licenseNumber: userForm.value.role === 'WORKER' ? userForm.value.licenseNumber || undefined : undefined,
      specialty: userForm.value.role === 'WORKER' ? userForm.value.specialty || undefined : undefined,
      clinicPermissions: userForm.value.role === 'WORKER' ? userForm.value.clinicPermissions : undefined,
    })
    showEditModal.value = false
    await loadStaff()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error updating user'
  } finally {
    isSaving.value = false
  }
}

// Reset password
const resetPassword = async () => {
  if (!selectedStaff.value) return
  
  if (resetPasswordForm.value.newPassword !== resetPasswordForm.value.confirmPassword) {
    formError.value = 'Las contraseñas no coinciden'
    return
  }
  
  formError.value = ''
  isSaving.value = true
  
  try {
    await api.post(`/users/org/${selectedStaff.value.id}/reset-password`, {
      newPassword: resetPasswordForm.value.newPassword,
    })
    showResetPasswordModal.value = false
    resetPasswordForm.value = { newPassword: '', confirmPassword: '' }
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error resetting password'
  } finally {
    isSaving.value = false
  }
}

// Delete user
const deleteUser = async (member: StaffMember) => {
  confirmAction.value = {
    title: 'Eliminar Usuario',
    message: `¿Estás seguro de eliminar a ${member.firstName} ${member.lastName}? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    confirmClass: 'btn-danger',
    action: async () => {
      await api.delete(`/users/org/${member.id}`)
      await loadStaff()
    }
  }
  showConfirmModal.value = true
}

// Toggle user active status
const toggleUserStatus = async (member: StaffMember) => {
  const isActivating = !member.isActive
  confirmAction.value = {
    title: isActivating ? 'Activar Usuario' : 'Desactivar Usuario',
    message: isActivating 
      ? `¿Estás seguro de activar a ${member.firstName} ${member.lastName}? Podrá volver a iniciar sesión.`
      : `¿Estás seguro de desactivar a ${member.firstName} ${member.lastName}? No podrá iniciar sesión hasta que lo reactives.`,
    confirmText: isActivating ? 'Activar' : 'Desactivar',
    confirmClass: isActivating ? 'btn-success' : 'btn-warning',
    action: async () => {
      await api.post(`/users/org/${member.id}/toggle-status`)
      await loadStaff()
    }
  }
  showConfirmModal.value = true
}

// Execute confirmation action
const executeConfirmAction = async () => {
  if (!confirmAction.value) return
  try {
    await confirmAction.value.action()
    showConfirmModal.value = false
    confirmAction.value = null
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error ejecutando la acción'
    showConfirmModal.value = false
  }
}

// Open modals
const openCreateModal = () => {
  resetUserForm()
  showCreateModal.value = true
}

const openEditModal = (member: StaffMember) => {
  selectedStaff.value = member
  // Get clinic IDs from workerClinics or use clinicId as fallback
  const clinicIdsFromWorkerClinics = member.workerClinics?.map(wc => wc.clinicId) || []
  const clinicIds = clinicIdsFromWorkerClinics.length > 0 
    ? clinicIdsFromWorkerClinics 
    : (member.clinicId ? [member.clinicId] : [])
  
  // Parse phone into country code and number
  let phoneCountry = '+34'
  let phoneNumber = ''
  if (member.phone) {
    const matchedCountry = countryCodes.find(c => member.phone?.startsWith(c.code))
    if (matchedCountry) {
      phoneCountry = matchedCountry.code
      phoneNumber = member.phone.slice(matchedCountry.code.length)
    } else {
      phoneNumber = member.phone
    }
  }
  
  // Build per-clinic permissions map
  const clinicPermissions: Record<string, string[]> = {}
  if (member.workerClinics) {
    for (const wc of member.workerClinics) {
      clinicPermissions[wc.clinicId] = wc.permissions || []
    }
  }

  userForm.value = {
    email: member.email,
    password: '',
    firstName: member.firstName,
    lastName: member.lastName,
    phoneCountry,
    phoneNumber,
    role: member.role as 'ADMIN' | 'WORKER' | 'USER',
    clinicIds,
    licenseNumber: member.staffProfile?.licenseNumber || '',
    specialty: member.staffProfile?.specialty || '',
    clinicPermissions,
  }
  showEditModal.value = true
}

const openResetPasswordModal = (member: StaffMember) => {
  selectedStaff.value = member
  resetPasswordForm.value = { newPassword: '', confirmPassword: '' }
  formError.value = ''
  showResetPasswordModal.value = true
}

const resetUserForm = () => {
  userForm.value = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phoneCountry: '+34',
    phoneNumber: '',
    role: 'WORKER',
    clinicIds: [],
    licenseNumber: '',
    specialty: '',
    clinicPermissions: {} as Record<string, string[]>,
  }
  formError.value = ''
}

const onClinicToggle = (clinicId: string) => {
  if (!userForm.value.clinicIds.includes(clinicId)) {
    delete userForm.value.clinicPermissions[clinicId]
  }
}

const toggleClinicPermission = (clinicId: string, permKey: string) => {
  if (!userForm.value.clinicPermissions[clinicId]) {
    userForm.value.clinicPermissions[clinicId] = []
  }
  const perms = userForm.value.clinicPermissions[clinicId]
  const idx = perms.indexOf(permKey)
  if (idx >= 0) {
    perms.splice(idx, 1)
  } else {
    perms.push(permKey)
  }
}

// Role helpers
const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    SUPERADMIN: 'Super Admin',
    ADMIN: 'Administrador',
    WORKER: 'Trabajador',
    USER: 'Paciente',
  }
  return labels[role] || role
}

const getRoleClass = (role: string) => {
  switch (role) {
    case 'SUPERADMIN': return 'badge-danger'
    case 'ADMIN': return 'badge-accent'
    case 'WORKER': return 'badge-primary'
    default: return 'badge-neutral'
  }
}

onMounted(async () => {
  await Promise.all([loadStaff(), loadClinics()])
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold text-surface-900">Personal</h1>
        <p class="text-surface-500 mt-1">Gestiona los usuarios de tu organización</p>
      </div>
      <button @click="openCreateModal" class="btn-primary">
        <UserPlusIcon class="w-5 h-5" />
        Nuevo Usuario
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="relative flex-1 max-w-md">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por nombre o email..."
          class="input pl-10"
        />
      </div>
      <select v-model="roleFilter" class="input w-auto">
        <option value="">Todos los roles</option>
        <option value="ADMIN">Administradores</option>
        <option value="WORKER">Trabajadores</option>
      </select>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 rounded-xl bg-danger-50 text-danger-600">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- Staff table -->
    <div v-else-if="staff.length > 0" class="card overflow-hidden">
      <table class="w-full">
        <thead class="bg-surface-50 border-b border-surface-200">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-medium text-surface-600">Usuario</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-surface-600">Rol</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-surface-600 hidden md:table-cell">Clínica</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-surface-600 hidden lg:table-cell">Especialidad</th>
            <th class="px-4 py-3 text-right text-sm font-medium text-surface-600">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-100">
          <tr v-for="member in staff" :key="member.id" :class="[member.isActive ? 'hover:bg-surface-50' : 'bg-surface-100 opacity-60']">
            <td class="px-4 py-4">
              <div class="flex items-center gap-3">
                <div 
                  class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  :style="{ backgroundColor: member.isActive ? (member.staffProfile?.color || '#6366F1') : '#9CA3AF' }"
                >
                  {{ member.firstName.charAt(0) }}{{ member.lastName.charAt(0) }}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <p class="font-medium text-surface-900">{{ member.firstName }} {{ member.lastName }}</p>
                    <span v-if="!member.isActive" class="px-2 py-0.5 text-xs rounded-full bg-surface-300 text-surface-700">Inactivo</span>
                  </div>
                  <p class="text-sm text-surface-500">{{ member.email }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-4">
              <div class="flex flex-col gap-1">
                <span :class="getRoleClass(member.role)">{{ getRoleLabel(member.role) }}</span>
                <template v-if="member.role === 'WORKER' && member.workerClinics?.some(wc => wc.permissions && wc.permissions.length > 0)">
                  <div v-for="wc in member.workerClinics?.filter(w => w.permissions && w.permissions.length > 0)" :key="wc.id" class="flex flex-wrap items-center gap-1">
                    <span class="text-[10px] text-surface-400">{{ wc.clinic?.name }}:</span>
                    <span 
                      v-for="p in wc.permissions" 
                      :key="p"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-100 text-accent-700"
                    >
                      {{ modulePermissions.find(mp => mp.key === p)?.label || p }}
                    </span>
                  </div>
                </template>
              </div>
            </td>
            <td class="px-4 py-4 hidden md:table-cell">
              <div v-if="member.workerClinics && member.workerClinics.length > 0" class="flex flex-wrap gap-1">
                <span 
                  v-for="wc in member.workerClinics" 
                  :key="wc.id"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700"
                >
                  {{ wc.clinic?.name || 'Clínica' }}
                </span>
              </div>
              <span v-else-if="member.clinic" class="text-surface-600">{{ member.clinic.name }}</span>
              <span v-else class="text-surface-400">—</span>
            </td>
            <td class="px-4 py-4 hidden lg:table-cell">
              <span v-if="member.staffProfile?.specialty" class="text-surface-600">{{ member.staffProfile.specialty }}</span>
              <span v-else class="text-surface-400">—</span>
            </td>
            <td class="px-4 py-4">
              <div class="flex items-center justify-end gap-2">
                <button 
                  v-if="member.id !== authStore.user?.id"
                  @click="toggleUserStatus(member)" 
                  :class="[
                    'p-2 rounded-lg',
                    member.isActive 
                      ? 'text-surface-400 hover:text-warning-600 hover:bg-warning-50' 
                      : 'text-success-500 hover:text-success-700 hover:bg-success-50'
                  ]"
                  :title="member.isActive ? 'Desactivar usuario' : 'Activar usuario'"
                >
                  <NoSymbolIcon v-if="member.isActive" class="w-5 h-5" />
                  <CheckCircleIcon v-else class="w-5 h-5" />
                </button>
                <button 
                  @click="openResetPasswordModal(member)" 
                  class="p-2 text-surface-400 hover:text-warning-600 hover:bg-warning-50 rounded-lg"
                  title="Cambiar contraseña"
                >
                  <KeyIcon class="w-5 h-5" />
                </button>
                <button 
                  @click="openEditModal(member)" 
                  class="p-2 text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  title="Editar"
                >
                  <PencilIcon class="w-5 h-5" />
                </button>
                <button 
                  v-if="member.id !== authStore.user?.id"
                  @click="deleteUser(member)" 
                  class="p-2 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                  title="Eliminar"
                >
                  <TrashIcon class="w-5 h-5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t border-surface-200">
        <p class="text-sm text-surface-500">
          Mostrando {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, total) }} de {{ total }}
        </p>
        <div class="flex gap-2">
          <button 
            @click="page--; loadStaff()" 
            :disabled="page === 1" 
            class="btn-secondary btn-sm"
          >
            <ChevronLeftIcon class="w-4 h-4" />
          </button>
          <button 
            @click="page++; loadStaff()" 
            :disabled="page >= totalPages" 
            class="btn-secondary btn-sm"
          >
            <ChevronRightIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card p-12 text-center">
      <UserIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-medium text-surface-900 mb-2">No hay personal</h3>
      <p class="text-surface-500 mb-6">Crea el primer usuario de tu organización</p>
      <button @click="openCreateModal" class="btn-primary">
        <UserPlusIcon class="w-5 h-5" />
        Nuevo Usuario
      </button>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showCreateModal || showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showCreateModal = false; showEditModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in">
          <!-- Header (sticky) -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 flex-shrink-0">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ showCreateModal ? 'Nuevo Usuario' : 'Editar Usuario' }}
            </h2>
            <button @click="showCreateModal = false; showEditModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <!-- Scrollable content -->
          <form @submit.prevent="showCreateModal ? createUser() : updateUser()" class="flex flex-col flex-1 overflow-hidden">
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <div v-if="formError" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
                {{ formError }}
              </div>
              
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="label">Nombre *</label>
                  <input v-model="userForm.firstName" type="text" required class="input" />
                </div>
                <div>
                  <label class="label">Apellidos *</label>
                  <input v-model="userForm.lastName" type="text" required class="input" />
                </div>
              </div>
              
              <div v-if="showCreateModal">
                <label class="label">Email *</label>
                <input v-model="userForm.email" type="email" required class="input" />
              </div>
              
              <div v-if="showCreateModal">
                <label class="label">Contraseña *</label>
                <input v-model="userForm.password" type="password" required minlength="8" class="input" />
                <p class="text-xs text-surface-400 mt-1">Mínimo 8 caracteres</p>
              </div>
              
              <div>
                <label class="label">Teléfono</label>
                <div class="flex gap-2">
                  <PhoneCountrySelect v-model="userForm.phoneCountry" />
                  <input 
                    v-model="userForm.phoneNumber" 
                    type="tel" 
                    class="input flex-1" 
                    placeholder="612345678"
                    @input="userForm.phoneNumber = userForm.phoneNumber.replace(/\D/g, '')"
                  />
                </div>
                <p class="text-xs text-surface-400 mt-1">Solo números, sin espacios</p>
              </div>
              
              <div>
                <label class="label">Rol *</label>
                <select v-model="userForm.role" required class="input">
                  <option value="ADMIN">Administrador</option>
                  <option value="WORKER">Trabajador</option>
                </select>
              </div>
              
              <div v-if="userForm.role === 'WORKER' || userForm.role === 'ADMIN'">
                <label class="label">Clínicas asignadas</label>
                <div class="border border-surface-200 rounded-xl p-3 space-y-1">
                  <div 
                    v-for="clinic in availableClinics" 
                    :key="clinic.id"
                    class="rounded-lg"
                  >
                    <!-- Clinic checkbox -->
                    <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        :value="clinic.id"
                        v-model="userForm.clinicIds"
                        class="w-4 h-4 text-primary-600 border-surface-300 rounded focus:ring-primary-500"
                        @change="onClinicToggle(clinic.id)"
                      />
                      <div class="flex items-center gap-2">
                        <BuildingStorefrontIcon class="w-4 h-4 text-surface-400" />
                        <span class="text-sm text-surface-700">{{ clinic.name }}</span>
                      </div>
                    </label>

                    <!-- Per-clinic permissions (only for WORKER, only if clinic is selected) -->
                    <div 
                      v-if="userForm.role === 'WORKER' && userForm.clinicIds.includes(clinic.id)" 
                      class="ml-9 mb-2 p-2 bg-surface-50 rounded-lg border border-surface-100"
                    >
                      <p class="text-xs font-medium text-surface-500 mb-1.5">Permisos en {{ clinic.name }}</p>
                      <div class="flex flex-wrap gap-2">
                        <label 
                          v-for="perm in modulePermissions" 
                          :key="perm.key"
                          class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer transition-colors text-xs"
                          :class="[
                            (userForm.clinicPermissions[clinic.id] || []).includes(perm.key)
                              ? 'bg-primary-50 border-primary-300 text-primary-700'
                              : 'bg-white border-surface-200 text-surface-500 hover:border-surface-300'
                          ]"
                        >
                          <input 
                            type="checkbox" 
                            :value="perm.key"
                            :checked="(userForm.clinicPermissions[clinic.id] || []).includes(perm.key)"
                            class="sr-only"
                            @change="toggleClinicPermission(clinic.id, perm.key)"
                          />
                          {{ perm.label }}
                        </label>
                      </div>
                    </div>
                  </div>
                  <p v-if="availableClinics.length === 0" class="text-sm text-surface-400 text-center py-2">
                    No hay clínicas disponibles
                  </p>
                </div>
                <p class="text-xs text-surface-400 mt-1">Selecciona una o más clínicas</p>
              </div>
              
              <template v-if="userForm.role === 'WORKER'">
                <div>
                  <label class="label">Nº Colegiado</label>
                  <input v-model="userForm.licenseNumber" type="text" class="input" />
                </div>
                <div>
                  <label class="label">Especialidad</label>
                  <input v-model="userForm.specialty" type="text" class="input" placeholder="Ej: Odontología General" />
                </div>
              </template>
            </div>
            
            <!-- Footer (sticky) -->
            <div class="flex gap-3 px-6 py-4 border-t border-surface-100 flex-shrink-0 bg-white rounded-b-2xl">
              <button type="button" @click="showCreateModal = false; showEditModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isSaving" class="btn-primary flex-1">
                {{ isSaving ? 'Guardando...' : (showCreateModal ? 'Crear Usuario' : 'Guardar Cambios') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Reset Password Modal -->
    <Teleport to="body">
      <div v-if="showResetPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showResetPasswordModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">Cambiar Contraseña</h2>
            <button @click="showResetPasswordModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="resetPassword" class="p-6 space-y-4">
            <div v-if="formError" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
              {{ formError }}
            </div>
            
            <p class="text-surface-600">
              Cambiando contraseña para: <strong>{{ selectedStaff?.firstName }} {{ selectedStaff?.lastName }}</strong>
            </p>
            
            <div>
              <label class="label">Nueva Contraseña *</label>
              <input v-model="resetPasswordForm.newPassword" type="password" required minlength="8" class="input" />
            </div>
            
            <div>
              <label class="label">Confirmar Contraseña *</label>
              <input v-model="resetPasswordForm.confirmPassword" type="password" required minlength="8" class="input" />
            </div>
            
            <div class="flex gap-3 pt-4">
              <button type="button" @click="showResetPasswordModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isSaving" class="btn-primary flex-1">
                {{ isSaving ? 'Cambiando...' : 'Cambiar Contraseña' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showConfirmModal && confirmAction" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showConfirmModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">{{ confirmAction.title }}</h2>
            <button @click="showConfirmModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <div class="p-6">
            <p class="text-surface-600 mb-6">{{ confirmAction.message }}</p>
            
            <div class="flex gap-3">
              <button type="button" @click="showConfirmModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button @click="executeConfirmAction" :class="[confirmAction.confirmClass, 'flex-1']">
                {{ confirmAction.confirmText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
