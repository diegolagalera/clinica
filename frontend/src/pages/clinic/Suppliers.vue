<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api } from '@/services/api'
import type { ApiResponse, PaginatedResponse } from '@/types'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  MapPinIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeIcon,
  BuildingStorefrontIcon,
} from '@heroicons/vue/24/outline'
import { useRouter } from 'vue-router'

interface Supplier {
  id: string
  name: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  phone2: string | null
  website: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface SupplierItem {
  id: string
  name: string
  sku: string | null
  category: string | null
  currentStock: number
  minStock: number
}

const router = useRouter()

// State
const suppliers = ref<Supplier[]>([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)

// Search
const searchQuery = ref('')
const searchTimeout = ref<NodeJS.Timeout | null>(null)

// UI State
const isLoading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const currentSupplier = ref<Supplier | null>(null)
const isSaving = ref(false)

// Supplier items view
const showItemsModal = ref(false)
const supplierItems = ref<SupplierItem[]>([])
const itemsSupplierName = ref('')

// Form data
const form = ref({
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  phone2: '',
  website: '',
  address: '',
  notes: '',
})

// Delete confirmation
const showDeleteConfirm = ref(false)
const supplierToDelete = ref<Supplier | null>(null)

// Load suppliers
async function loadSuppliers() {
  isLoading.value = true
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: limit.value.toString(),
    })
    if (searchQuery.value) {
      params.append('search', searchQuery.value)
    }

    const response = await api.get<ApiResponse<PaginatedResponse<Supplier>>>(`/stock/suppliers?${params}`)
    if (response.success && response.data) {
      suppliers.value = response.data.data
      total.value = response.data.pagination.total
    }
  } catch (error) {
    console.error('Error loading suppliers:', error)
  } finally {
    isLoading.value = false
  }
}

// Watch for search changes
watch(searchQuery, () => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    page.value = 1
    loadSuppliers()
  }, 300)
})

// Open modal for new supplier
function openNewModal() {
  isEditing.value = false
  currentSupplier.value = null
  form.value = {
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    phone2: '',
    website: '',
    address: '',
    notes: '',
  }
  showModal.value = true
}

// Open modal for editing
function openEditModal(supplier: Supplier) {
  isEditing.value = true
  currentSupplier.value = supplier
  form.value = {
    name: supplier.name,
    contactPerson: supplier.contactPerson || '',
    email: supplier.email || '',
    phone: supplier.phone || '',
    phone2: supplier.phone2 || '',
    website: supplier.website || '',
    address: supplier.address || '',
    notes: supplier.notes || '',
  }
  showModal.value = true
}

// Close modal
function closeModal() {
  showModal.value = false
  currentSupplier.value = null
}

// Save supplier
async function saveSupplier() {
  if (!form.value.name.trim()) return

  isSaving.value = true
  try {
    if (isEditing.value && currentSupplier.value) {
      await api.put(`/stock/suppliers/${currentSupplier.value.id}`, form.value)
    } else {
      await api.post('/stock/suppliers', form.value)
    }
    closeModal()
    loadSuppliers()
  } catch (error) {
    console.error('Error saving supplier:', error)
  } finally {
    isSaving.value = false
  }
}

// Confirm delete
function confirmDelete(supplier: Supplier) {
  supplierToDelete.value = supplier
  showDeleteConfirm.value = true
}

// Delete supplier
async function deleteSupplier() {
  if (!supplierToDelete.value) return

  try {
    await api.delete(`/stock/suppliers/${supplierToDelete.value.id}`)
    showDeleteConfirm.value = false
    supplierToDelete.value = null
    loadSuppliers()
  } catch (error) {
    console.error('Error deleting supplier:', error)
  }
}

// View supplier items
async function viewSupplierItems(supplier: Supplier) {
  itemsSupplierName.value = supplier.name
  try {
    const response = await api.get<ApiResponse<SupplierItem[]>>(`/stock/suppliers/${supplier.id}/items`)
    if (response.success && response.data) {
      supplierItems.value = response.data
    }
  } catch (error) {
    console.error('Error loading supplier items:', error)
  }
  showItemsModal.value = true
}

// Pagination
const totalPages = ref(1)
watch([total, limit], () => {
  totalPages.value = Math.ceil(total.value / limit.value)
})

function goToInventory() {
  router.push('/clinic/inventory')
}

onMounted(() => {
  loadSuppliers()
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-3">
        <button 
          @click="goToInventory"
          class="p-2 hover:bg-surface-100 rounded-lg transition-colors"
        >
          <ChevronLeftIcon class="w-5 h-5 text-surface-500" />
        </button>
        <div>
          <h1 class="text-2xl font-bold text-surface-900">Proveedores</h1>
          <p class="text-surface-500 mt-1">Gestiona los proveedores de tu inventario</p>
        </div>
      </div>
      <button @click="openNewModal" class="btn-primary flex items-center gap-2">
        <PlusIcon class="w-5 h-5" />
        Nuevo Proveedor
      </button>
    </div>

    <!-- Search -->
    <div class="card p-4 mb-6">
      <div class="relative">
        <MagnifyingGlassIcon class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por nombre, contacto o email..."
          class="input pl-10 w-full"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="suppliers.length === 0" class="card p-12 text-center">
      <BuildingStorefrontIcon class="w-16 h-16 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-medium text-surface-900 mb-2">No hay proveedores</h3>
      <p class="text-surface-500 mb-4">Añade proveedores para gestionar sus datos de contacto</p>
      <button @click="openNewModal" class="btn-primary">
        <PlusIcon class="w-5 h-5 mr-2" />
        Añadir Proveedor
      </button>
    </div>

    <!-- Suppliers grid -->
    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="supplier in suppliers"
        :key="supplier.id"
        class="card p-5 hover:shadow-lg transition-shadow"
      >
        <div class="flex items-start justify-between mb-3">
          <h3 class="font-semibold text-surface-900 text-lg">{{ supplier.name }}</h3>
          <div class="flex gap-1">
            <button
              @click="viewSupplierItems(supplier)"
              class="p-1.5 hover:bg-surface-100 rounded-lg transition-colors"
              title="Ver productos"
            >
              <CubeIcon class="w-4 h-4 text-surface-500" />
            </button>
            <button
              @click="openEditModal(supplier)"
              class="p-1.5 hover:bg-surface-100 rounded-lg transition-colors"
              title="Editar"
            >
              <PencilIcon class="w-4 h-4 text-surface-500" />
            </button>
            <button
              @click="confirmDelete(supplier)"
              class="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar"
            >
              <TrashIcon class="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>

        <div class="space-y-2 text-sm">
          <div v-if="supplier.contactPerson" class="flex items-center gap-2 text-surface-600">
            <UserIcon class="w-4 h-4 text-surface-400" />
            {{ supplier.contactPerson }}
          </div>
          <div v-if="supplier.phone" class="flex items-center gap-2">
            <PhoneIcon class="w-4 h-4 text-surface-400" />
            <a :href="`tel:${supplier.phone}`" class="text-primary-600 hover:underline">
              {{ supplier.phone }}
            </a>
            <span v-if="supplier.phone2" class="text-surface-400">|</span>
            <a v-if="supplier.phone2" :href="`tel:${supplier.phone2}`" class="text-primary-600 hover:underline">
              {{ supplier.phone2 }}
            </a>
          </div>
          <div v-if="supplier.email" class="flex items-center gap-2">
            <EnvelopeIcon class="w-4 h-4 text-surface-400" />
            <a :href="`mailto:${supplier.email}`" class="text-primary-600 hover:underline truncate">
              {{ supplier.email }}
            </a>
          </div>
          <div v-if="supplier.website" class="flex items-center gap-2">
            <GlobeAltIcon class="w-4 h-4 text-surface-400" />
            <a :href="supplier.website" target="_blank" class="text-primary-600 hover:underline truncate">
              {{ supplier.website.replace(/^https?:\/\//, '').replace(/\/$/, '') }}
            </a>
          </div>
          <div v-if="supplier.address" class="flex items-start gap-2 text-surface-500">
            <MapPinIcon class="w-4 h-4 text-surface-400 flex-shrink-0 mt-0.5" />
            <span class="line-clamp-2">{{ supplier.address }}</span>
          </div>
        </div>

        <p v-if="supplier.notes" class="mt-3 pt-3 border-t text-sm text-surface-500 line-clamp-2">
          {{ supplier.notes }}
        </p>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-center items-center gap-2 mt-6">
      <button
        @click="page = Math.max(1, page - 1)"
        :disabled="page === 1"
        class="p-2 rounded-lg border hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeftIcon class="w-5 h-5" />
      </button>
      <span class="text-sm text-surface-600">
        Página {{ page }} de {{ totalPages }}
      </span>
      <button
        @click="page = Math.min(totalPages, page + 1)"
        :disabled="page === totalPages"
        class="p-2 rounded-lg border hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRightIcon class="w-5 h-5" />
      </button>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="closeModal"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
          <!-- Header (sticky) -->
          <div class="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
            <h2 class="text-lg font-semibold text-surface-900">
              {{ isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor' }}
            </h2>
            <button @click="closeModal" class="p-2 hover:bg-surface-100 rounded-lg">
              <XMarkIcon class="w-5 h-5 text-surface-500" />
            </button>
          </div>

          <!-- Scrollable content -->
          <form @submit.prevent="saveSupplier" class="flex flex-col flex-1 overflow-hidden">
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">
                  Nombre <span class="text-red-500">*</span>
                </label>
                <input v-model="form.name" type="text" class="input w-full" required />
              </div>

              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">
                  Persona de contacto
                </label>
                <input v-model="form.contactPerson" type="text" class="input w-full" />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-surface-700 mb-1">Teléfono</label>
                  <input v-model="form.phone" type="tel" class="input w-full" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-surface-700 mb-1">Teléfono 2</label>
                  <input v-model="form.phone2" type="tel" class="input w-full" />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Email</label>
                <input v-model="form.email" type="email" class="input w-full" />
              </div>

              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Sitio web</label>
                <input v-model="form.website" type="url" class="input w-full" placeholder="https://" />
              </div>

              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Dirección</label>
                <textarea v-model="form.address" rows="2" class="input w-full"></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Notas</label>
                <textarea v-model="form.notes" rows="3" class="input w-full" placeholder="Información adicional, condiciones de pago, etc."></textarea>
              </div>
            </div>

            <!-- Footer (sticky) -->
            <div class="flex justify-end gap-3 px-6 py-4 border-t flex-shrink-0 bg-white rounded-b-xl">
              <button type="button" @click="closeModal" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="isSaving || !form.name.trim()">
                {{ isSaving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Proveedor') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="showDeleteConfirm = false"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <h3 class="text-lg font-semibold text-surface-900 mb-2">¿Eliminar proveedor?</h3>
          <p class="text-surface-600 mb-6">
            ¿Estás seguro de que quieres eliminar a <strong>{{ supplierToDelete?.name }}</strong>?
            Los productos asociados no serán eliminados.
          </p>
          <div class="flex justify-end gap-3">
            <button @click="showDeleteConfirm = false" class="btn-secondary">Cancelar</button>
            <button @click="deleteSupplier" class="btn-danger">Eliminar</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Supplier Items Modal -->
    <Teleport to="body">
      <div
        v-if="showItemsModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="showItemsModal = false"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
          <div class="border-b px-6 py-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-surface-900">
              Productos de {{ itemsSupplierName }}
            </h2>
            <button @click="showItemsModal = false" class="p-2 hover:bg-surface-100 rounded-lg">
              <XMarkIcon class="w-5 h-5 text-surface-500" />
            </button>
          </div>

          <div class="p-6 overflow-y-auto max-h-[60vh]">
            <div v-if="supplierItems.length === 0" class="text-center py-8 text-surface-500">
              <CubeIcon class="w-12 h-12 mx-auto text-surface-300 mb-3" />
              <p>No hay productos asociados a este proveedor</p>
            </div>
            <ul v-else class="space-y-3">
              <li
                v-for="item in supplierItems"
                :key="item.id"
                class="flex items-center justify-between p-3 bg-surface-50 rounded-lg"
              >
                <div>
                  <p class="font-medium text-surface-900">{{ item.name }}</p>
                  <p class="text-sm text-surface-500">
                    {{ item.sku || 'Sin SKU' }} • {{ item.category || 'Sin categoría' }}
                  </p>
                </div>
                <div class="text-right">
                  <p :class="[
                    'font-semibold',
                    item.currentStock <= item.minStock ? 'text-red-600' : 'text-surface-900'
                  ]">
                    {{ item.currentStock }} uds
                  </p>
                  <p v-if="item.currentStock <= item.minStock" class="text-xs text-red-500">
                    Stock bajo
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
