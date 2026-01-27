<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { api } from '@/services/api'
import type { User, Organization, Clinic, ApiResponse, PaginatedResponse } from '@/types'
import type { Role } from '@/types'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  UserIcon,
  KeyIcon,
  FunnelIcon,
} from '@heroicons/vue/24/outline'

interface UserWithRelations extends User {
  organization?: Organization
  clinic?: Clinic
  staffProfile?: {
    licenseNumber?: string
    specialty?: string
  }
}

// State
const users = ref<UserWithRelations[]>([])
const organizations = ref<Organization[]>([])
const clinics = ref<Clinic[]>([])
const isLoading = ref(true)
const error = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)

// Filters
const roleFilter = ref<string>('')
const orgFilter = ref<string>('')

// Modal state
const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const selectedUser = ref<UserWithRelations | null>(null)
const formData = ref({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'ADMIN' as Role,
  organizationId: '',
  clinicId: '',
  licenseNumber: '',
  specialty: '',
})
const isSaving = ref(false)
const formError = ref('')

// Password reset modal
const showPasswordModal = ref(false)
const newPassword = ref('')
const isResettingPassword = ref(false)

// Delete confirmation
const showDeleteConfirm = ref(false)
const userToDelete = ref<UserWithRelations | null>(null)
const isDeleting = ref(false)

// Role labels
const roleLabels: Record<Role, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  WORKER: 'Personal',
  USER: 'Paciente',
}

const roleColors: Record<Role, string> = {
  SUPERADMIN: 'badge-primary',
  ADMIN: 'badge-accent',
  WORKER: 'badge-success',
  USER: 'badge-neutral',
}

// Load users
const loadUsers = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      limit: 10,
    }
    if (searchQuery.value) params['search'] = searchQuery.value
    if (roleFilter.value) params['role'] = roleFilter.value
    if (orgFilter.value) params['organizationId'] = orgFilter.value
    
    const response = await api.get<ApiResponse<PaginatedResponse<UserWithRelations>>>('/users', { params })
    
    if (response.success && response.data) {
      users.value = response.data.data
      totalPages.value = response.data.pagination.totalPages
      total.value = response.data.pagination.total
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error loading users'
  } finally {
    isLoading.value = false
  }
}

// Load organizations for filter/form
const loadOrganizations = async () => {
  try {
    const response = await api.get<ApiResponse<PaginatedResponse<Organization>>>('/organizations?limit=100')
    if (response.success && response.data) {
      organizations.value = response.data.data
    }
  } catch (err) {
    console.error('Error loading organizations:', err)
  }
}

// Load clinics for form
const loadClinics = async (organizationId?: string) => {
  try {
    const url = organizationId 
      ? `/users/clinics?organizationId=${organizationId}`
      : '/users/clinics'
    const response = await api.get<ApiResponse<Clinic[]>>(url)
    if (response.success && response.data) {
      clinics.value = response.data
    }
  } catch (err) {
    console.error('Error loading clinics:', err)
  }
}

// Watch organization change to reload clinics
watch(() => formData.value.organizationId, (newOrgId) => {
  if (newOrgId) {
    loadClinics(newOrgId)
    formData.value.clinicId = ''
  } else {
    clinics.value = []
    formData.value.clinicId = ''
  }
})

// Save user
const saveUser = async () => {
  formError.value = ''
  isSaving.value = true
  
  try {
    const payload: Record<string, any> = {
      firstName: formData.value.firstName,
      lastName: formData.value.lastName,
      phone: formData.value.phone || undefined,
      role: formData.value.role,
      organizationId: formData.value.organizationId || undefined,
      clinicId: formData.value.clinicId || undefined,
    }
    
    if (modalMode.value === 'create') {
      payload.email = formData.value.email
      payload.password = formData.value.password
    }
    
    if (formData.value.role === 'WORKER') {
      payload.licenseNumber = formData.value.licenseNumber || undefined
      payload.specialty = formData.value.specialty || undefined
    }
    
    if (modalMode.value === 'create') {
      await api.post('/users', payload)
    } else if (selectedUser.value) {
      await api.put(`/users/${selectedUser.value.id}`, payload)
    }
    
    showModal.value = false
    resetForm()
    await loadUsers()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error saving user'
  } finally {
    isSaving.value = false
  }
}

// Reset password
const resetPassword = async () => {
  if (!selectedUser.value || !newPassword.value) return
  
  isResettingPassword.value = true
  
  try {
    await api.post(`/users/${selectedUser.value.id}/reset-password`, {
      newPassword: newPassword.value,
    })
    showPasswordModal.value = false
    newPassword.value = ''
    selectedUser.value = null
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error resetting password'
  } finally {
    isResettingPassword.value = false
  }
}

// Delete user
const deleteUser = async () => {
  if (!userToDelete.value) return
  
  isDeleting.value = true
  
  try {
    await api.delete(`/users/${userToDelete.value.id}`)
    showDeleteConfirm.value = false
    userToDelete.value = null
    await loadUsers()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error deleting user'
  } finally {
    isDeleting.value = false
  }
}

// Modal helpers
const openCreateModal = () => {
  modalMode.value = 'create'
  resetForm()
  showModal.value = true
}

const openEditModal = (user: UserWithRelations) => {
  modalMode.value = 'edit'
  selectedUser.value = user
  formData.value = {
    email: user.email,
    password: '',
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || '',
    role: user.role,
    organizationId: user.organizationId || '',
    clinicId: user.clinicId || '',
    licenseNumber: user.staffProfile?.licenseNumber || '',
    specialty: user.staffProfile?.specialty || '',
  }
  if (user.organizationId) {
    loadClinics(user.organizationId)
  }
  showModal.value = true
}

const openPasswordModal = (user: UserWithRelations) => {
  selectedUser.value = user
  newPassword.value = ''
  showPasswordModal.value = true
}

const resetForm = () => {
  formData.value = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'ADMIN',
    organizationId: '',
    clinicId: '',
    licenseNumber: '',
    specialty: '',
  }
  selectedUser.value = null
  formError.value = ''
}

const confirmDelete = (user: UserWithRelations) => {
  userToDelete.value = user
  showDeleteConfirm.value = true
}

// Computed
const needsOrganization = computed(() => {
  return formData.value.role !== 'SUPERADMIN'
})

const needsClinic = computed(() => {
  return formData.value.role === 'WORKER' || formData.value.role === 'USER'
})

const isWorker = computed(() => {
  return formData.value.role === 'WORKER'
})

// Search debounce
let searchTimeout: number
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    currentPage.value = 1
    loadUsers()
  }, 300)
})

watch([roleFilter, orgFilter], () => {
  currentPage.value = 1
  loadUsers()
})

onMounted(async () => {
  await Promise.all([loadUsers(), loadOrganizations()])
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold text-surface-900">Usuarios</h1>
        <p class="text-surface-500 mt-1">Gestiona los usuarios de la plataforma</p>
      </div>
      <button @click="openCreateModal" class="btn-primary">
        <PlusIcon class="w-5 h-5" />
        Nuevo Usuario
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-4">
      <div class="relative flex-1 min-w-[200px] max-w-md">
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
        <option value="SUPERADMIN">Super Admin</option>
        <option value="ADMIN">Administrador</option>
        <option value="WORKER">Personal</option>
        <option value="USER">Paciente</option>
      </select>
      
      <select v-model="orgFilter" class="input w-auto">
        <option value="">Todas las organizaciones</option>
        <option v-for="org in organizations" :key="org.id" :value="org.id">
          {{ org.name }}
        </option>
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

    <!-- Users table -->
    <div v-else-if="users.length > 0" class="card">
      <div class="table-container border-0">
        <table class="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Organización</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-100">
            <tr v-for="user in users" :key="user.id">
              <td>
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center">
                    <span class="text-surface-600 font-medium">
                      {{ user.firstName.charAt(0) }}{{ user.lastName.charAt(0) }}
                    </span>
                  </div>
                  <div>
                    <p class="font-medium text-surface-900">{{ user.firstName }} {{ user.lastName }}</p>
                    <p class="text-sm text-surface-500">{{ user.email }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span :class="roleColors[user.role]">
                  {{ roleLabels[user.role] }}
                </span>
              </td>
              <td class="text-surface-600">
                {{ user.organization?.name || '-' }}
                <span v-if="user.clinic" class="text-sm text-surface-400 block">
                  {{ user.clinic.name }}
                </span>
              </td>
              <td>
                <span :class="user.isActive ? 'badge-success' : 'badge-danger'">
                  {{ user.isActive ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-2">
                  <button @click="openPasswordModal(user)" class="btn-ghost btn-sm" title="Cambiar contraseña">
                    <KeyIcon class="w-4 h-4" />
                  </button>
                  <button @click="openEditModal(user)" class="btn-ghost btn-sm">
                    <PencilIcon class="w-4 h-4" />
                  </button>
                  <button @click="confirmDelete(user)" class="btn-ghost btn-sm text-danger-600">
                    <TrashIcon class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-6 py-4 border-t border-surface-100 flex items-center justify-between">
        <p class="text-sm text-surface-500">
          Mostrando {{ users.length }} de {{ total }} usuarios
        </p>
        <div class="flex gap-2">
          <button 
            @click="currentPage--; loadUsers()"
            :disabled="currentPage <= 1"
            class="btn-secondary btn-sm"
          >
            Anterior
          </button>
          <button 
            @click="currentPage++; loadUsers()"
            :disabled="currentPage >= totalPages"
            class="btn-secondary btn-sm"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card p-12 text-center">
      <UserIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-medium text-surface-900 mb-2">No hay usuarios</h3>
      <p class="text-surface-500 mb-6">Crea el primer usuario para comenzar</p>
      <button @click="openCreateModal" class="btn-primary">
        <PlusIcon class="w-5 h-5" />
        Nuevo Usuario
      </button>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 sticky top-0 bg-white">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ modalMode === 'create' ? 'Nuevo Usuario' : 'Editar Usuario' }}
            </h2>
            <button @click="showModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="saveUser" class="p-6 space-y-4">
            <div v-if="formError" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
              {{ formError }}
            </div>
            
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="label">Nombre *</label>
                <input v-model="formData.firstName" type="text" required class="input" />
              </div>
              <div>
                <label class="label">Apellidos *</label>
                <input v-model="formData.lastName" type="text" required class="input" />
              </div>
            </div>
            
            <div v-if="modalMode === 'create'">
              <label class="label">Email *</label>
              <input v-model="formData.email" type="email" required class="input" />
            </div>
            
            <div v-if="modalMode === 'create'">
              <label class="label">Contraseña *</label>
              <input v-model="formData.password" type="password" required minlength="8" class="input" />
              <p class="text-xs text-surface-400 mt-1">Mínimo 8 caracteres</p>
            </div>
            
            <div>
              <label class="label">Teléfono</label>
              <input v-model="formData.phone" type="tel" class="input" />
            </div>
            
            <div>
              <label class="label">Rol *</label>
              <select v-model="formData.role" required class="input">
                <option value="SUPERADMIN">Super Admin</option>
                <option value="ADMIN">Administrador</option>
                <option value="WORKER">Personal (Dentista, Auxiliar, etc.)</option>
                <option value="USER">Paciente</option>
              </select>
            </div>
            
            <div v-if="needsOrganization">
              <label class="label">Organización *</label>
              <select v-model="formData.organizationId" :required="needsOrganization" class="input">
                <option value="">Seleccionar...</option>
                <option v-for="org in organizations" :key="org.id" :value="org.id">
                  {{ org.name }}
                </option>
              </select>
            </div>
            
            <div v-if="needsClinic">
              <label class="label">Clínica *</label>
              <select v-model="formData.clinicId" :required="needsClinic" class="input">
                <option value="">Seleccionar...</option>
                <option v-for="clinic in clinics" :key="clinic.id" :value="clinic.id">
                  {{ clinic.name }}
                </option>
              </select>
            </div>
            
            <!-- Staff fields -->
            <template v-if="isWorker">
              <div class="pt-4 border-t border-surface-100">
                <h3 class="font-medium text-surface-900 mb-4">Datos profesionales</h3>
                <div class="grid md:grid-cols-2 gap-4">
                  <div>
                    <label class="label">Nº Colegiado</label>
                    <input v-model="formData.licenseNumber" type="text" class="input" />
                  </div>
                  <div>
                    <label class="label">Especialidad</label>
                    <input v-model="formData.specialty" type="text" class="input" placeholder="Odontología General" />
                  </div>
                </div>
              </div>
            </template>
            
            <div class="flex gap-3 pt-4">
              <button type="button" @click="showModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isSaving" class="btn-primary flex-1">
                {{ isSaving ? 'Guardando...' : (modalMode === 'create' ? 'Crear' : 'Guardar') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Password Reset Modal -->
    <Teleport to="body">
      <div v-if="showPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showPasswordModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">Cambiar Contraseña</h2>
            <button @click="showPasswordModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="resetPassword" class="p-6 space-y-4">
            <p class="text-surface-500">
              Cambiar contraseña para <strong>{{ selectedUser?.email }}</strong>
            </p>
            
            <div>
              <label class="label">Nueva contraseña *</label>
              <input v-model="newPassword" type="password" required minlength="8" class="input" />
              <p class="text-xs text-surface-400 mt-1">Mínimo 8 caracteres</p>
            </div>
            
            <div class="flex gap-3">
              <button type="button" @click="showPasswordModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" :disabled="isResettingPassword" class="btn-primary flex-1">
                {{ isResettingPassword ? 'Guardando...' : 'Cambiar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showDeleteConfirm = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
          <div class="p-6 text-center">
            <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-danger-50 flex items-center justify-center">
              <TrashIcon class="w-6 h-6 text-danger-600" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">¿Eliminar usuario?</h3>
            <p class="text-surface-500 mb-6">
              Esta acción eliminará permanentemente a <strong>{{ userToDelete?.firstName }} {{ userToDelete?.lastName }}</strong>.
            </p>
            <div class="flex gap-3">
              <button @click="showDeleteConfirm = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button @click="deleteUser" :disabled="isDeleting" class="btn-danger flex-1">
                {{ isDeleting ? 'Eliminando...' : 'Eliminar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
