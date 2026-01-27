<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import type { Organization, ApiResponse, PaginatedResponse } from '@/types'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  BuildingOffice2Icon,
} from '@heroicons/vue/24/outline'

const router = useRouter()

// State
const organizations = ref<Organization[]>([])
const isLoading = ref(true)
const error = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)

// Modal state
const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const selectedOrg = ref<Organization | null>(null)
const formData = ref({
  name: '',
  slug: '',
  email: '',
  phone: '',
  address: '',
})
const isSaving = ref(false)
const formError = ref('')

// Delete confirmation
const showDeleteConfirm = ref(false)
const orgToDelete = ref<Organization | null>(null)
const isDeleting = ref(false)

// Load organizations
const loadOrganizations = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const response = await api.get<ApiResponse<PaginatedResponse<Organization>>>('/organizations', {
      params: {
        page: currentPage.value,
        limit: 10,
        search: searchQuery.value || undefined,
      },
    })
    
    if (response.success && response.data) {
      organizations.value = response.data.data
      totalPages.value = response.data.pagination.totalPages
      total.value = response.data.pagination.total
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error loading organizations'
  } finally {
    isLoading.value = false
  }
}

// Create/Update organization
const saveOrganization = async () => {
  formError.value = ''
  isSaving.value = true
  
  try {
    if (modalMode.value === 'create') {
      await api.post('/organizations', formData.value)
    } else if (selectedOrg.value) {
      await api.put(`/organizations/${selectedOrg.value.id}`, formData.value)
    }
    
    showModal.value = false
    resetForm()
    await loadOrganizations()
  } catch (err: any) {
    formError.value = err.response?.data?.message || 'Error saving organization'
  } finally {
    isSaving.value = false
  }
}

// Delete organization
const deleteOrganization = async () => {
  if (!orgToDelete.value) return
  
  isDeleting.value = true
  
  try {
    await api.delete(`/organizations/${orgToDelete.value.id}`)
    showDeleteConfirm.value = false
    orgToDelete.value = null
    await loadOrganizations()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error deleting organization'
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

const openEditModal = (org: Organization) => {
  modalMode.value = 'edit'
  selectedOrg.value = org
  formData.value = {
    name: org.name,
    slug: org.slug,
    email: org.email || '',
    phone: org.phone || '',
    address: org.address || '',
  }
  showModal.value = true
}

const resetForm = () => {
  formData.value = { name: '', slug: '', email: '', phone: '', address: '' }
  selectedOrg.value = null
  formError.value = ''
}

const confirmDelete = (org: Organization) => {
  orgToDelete.value = org
  showDeleteConfirm.value = true
}

// Auto-generate slug from name
watch(() => formData.value.name, (name) => {
  if (modalMode.value === 'create') {
    formData.value.slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }
})

// Search debounce
let searchTimeout: number
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    currentPage.value = 1
    loadOrganizations()
  }, 300)
})

onMounted(() => {
  loadOrganizations()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold text-surface-900">Organizaciones</h1>
        <p class="text-surface-500 mt-1">Gestiona las organizaciones de la plataforma</p>
      </div>
      <button @click="openCreateModal" class="btn-primary">
        <PlusIcon class="w-5 h-5" />
        Nueva Organización
      </button>
    </div>

    <!-- Search -->
    <div class="flex gap-4">
      <div class="relative flex-1 max-w-md">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar organizaciones..."
          class="input pl-10"
        />
      </div>
    </div>

    <!-- Error message -->
    <div v-if="error" class="p-4 rounded-xl bg-danger-50 text-danger-600">
      {{ error }}
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- Organizations table -->
    <div v-else-if="organizations.length > 0" class="card">
      <div class="table-container border-0">
        <table class="table">
          <thead>
            <tr>
              <th>Organización</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-100">
            <tr v-for="org in organizations" :key="org.id">
              <td>
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                    <BuildingOffice2Icon class="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p class="font-medium text-surface-900">{{ org.name }}</p>
                    <p class="text-sm text-surface-500">{{ org.slug }}</p>
                  </div>
                </div>
              </td>
              <td class="text-surface-600">{{ org.email || '-' }}</td>
              <td class="text-surface-600">{{ org.phone || '-' }}</td>
              <td>
                <span :class="org.isActive ? 'badge-success' : 'badge-neutral'">
                  {{ org.isActive ? 'Activa' : 'Inactiva' }}
                </span>
              </td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-2">
                  <RouterLink 
                    :to="`/admin/organizations/${org.id}`"
                    class="btn-ghost btn-sm"
                  >
                    Ver
                  </RouterLink>
                  <button @click="openEditModal(org)" class="btn-ghost btn-sm">
                    <PencilIcon class="w-4 h-4" />
                  </button>
                  <button @click="confirmDelete(org)" class="btn-ghost btn-sm text-danger-600">
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
          Mostrando {{ organizations.length }} de {{ total }} organizaciones
        </p>
        <div class="flex gap-2">
          <button 
            @click="currentPage--; loadOrganizations()"
            :disabled="currentPage <= 1"
            class="btn-secondary btn-sm"
          >
            Anterior
          </button>
          <button 
            @click="currentPage++; loadOrganizations()"
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
      <BuildingOffice2Icon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-medium text-surface-900 mb-2">No hay organizaciones</h3>
      <p class="text-surface-500 mb-6">Crea la primera organización para comenzar</p>
      <button @click="openCreateModal" class="btn-primary">
        <PlusIcon class="w-5 h-5" />
        Nueva Organización
      </button>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ modalMode === 'create' ? 'Nueva Organización' : 'Editar Organización' }}
            </h2>
            <button @click="showModal = false" class="text-surface-400 hover:text-surface-600">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <form @submit.prevent="saveOrganization" class="p-6 space-y-4">
            <div v-if="formError" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
              {{ formError }}
            </div>
            
            <div>
              <label class="label">Nombre *</label>
              <input v-model="formData.name" type="text" required class="input" placeholder="Clínicas Dentales Madrid" />
            </div>
            
            <div>
              <label class="label">Slug *</label>
              <input v-model="formData.slug" type="text" required class="input" placeholder="clinicas-madrid" />
              <p class="text-xs text-surface-400 mt-1">Identificador único (solo letras, números y guiones)</p>
            </div>
            
            <div>
              <label class="label">Email</label>
              <input v-model="formData.email" type="email" class="input" placeholder="info@ejemplo.com" />
            </div>
            
            <div>
              <label class="label">Teléfono</label>
              <input v-model="formData.phone" type="tel" class="input" placeholder="+34 912 345 678" />
            </div>
            
            <div>
              <label class="label">Dirección</label>
              <input v-model="formData.address" type="text" class="input" placeholder="Calle Mayor 123, Madrid" />
            </div>
            
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

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-surface-900/50" @click="showDeleteConfirm = false"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
          <div class="p-6 text-center">
            <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-danger-50 flex items-center justify-center">
              <TrashIcon class="w-6 h-6 text-danger-600" />
            </div>
            <h3 class="text-lg font-semibold text-surface-900 mb-2">¿Eliminar organización?</h3>
            <p class="text-surface-500 mb-6">
              Esta acción eliminará permanentemente <strong>{{ orgToDelete?.name }}</strong> y todos sus datos asociados.
            </p>
            <div class="flex gap-3">
              <button @click="showDeleteConfirm = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button @click="deleteOrganization" :disabled="isDeleting" class="btn-danger flex-1">
                {{ isDeleting ? 'Eliminando...' : 'Eliminar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
