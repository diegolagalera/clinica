<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { api } from '@/services/api'
import type { ApiResponse, PaginatedResponse } from '@/types'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArchiveBoxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeIcon,
} from '@heroicons/vue/24/outline'

interface InventoryItem {
  id: string
  name: string
  sku: string | null
  category: string | null
  unit: string
  currentStock: number
}

interface StockPackItem {
  id: string
  itemId: string
  quantity: number
  item: {
    id: string
    name: string
    sku: string | null
    unit: string
    currentStock: number
  }
}

interface StockPack {
  id: string
  name: string
  description: string | null
  category: string | null
  isActive: boolean
  createdAt: string
  items?: StockPackItem[]
  itemCount?: number
}

// State
const packs = ref<StockPack[]>([])
const availableItems = ref<InventoryItem[]>([])
const categories = ref<string[]>([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)

// Filters
const searchQuery = ref('')
const selectedCategory = ref('')

// UI State
const isLoading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const currentPack = ref<StockPack | null>(null)

// Form data
const form = ref({
  name: '',
  description: '',
  category: '',
  items: [] as { itemId: string; quantity: number }[],
})

// Item search for adding to pack
const itemSearch = ref('')
const showItemDropdown = ref(false)

const totalPages = computed(() => Math.ceil(total.value / limit.value))

const filteredItems = computed(() => {
  if (!itemSearch.value) return availableItems.value.slice(0, 10)
  const search = itemSearch.value.toLowerCase()
  return availableItems.value
    .filter(item => 
      item.name.toLowerCase().includes(search) || 
      item.sku?.toLowerCase().includes(search)
    )
    .slice(0, 10)
})

// Get item details by ID
function getItemById(id: string): InventoryItem | undefined {
  return availableItems.value.find(item => item.id === id)
}

// Load packs
async function loadPacks() {
  isLoading.value = true
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: limit.value.toString(),
    })
    if (searchQuery.value) params.append('search', searchQuery.value)
    if (selectedCategory.value) params.append('category', selectedCategory.value)

    const data = await api.get<ApiResponse<PaginatedResponse<StockPack>>>(`/stock/packs?${params}`)
    if (data.success && data.data) {
      packs.value = data.data.data
      total.value = data.data.total
    }
  } catch (error) {
    console.error('Error loading packs:', error)
  } finally {
    isLoading.value = false
  }
}

// Load categories
async function loadCategories() {
  try {
    const data = await api.get<ApiResponse<string[]>>('/stock/packs/categories')
    if (data.success && data.data) {
      categories.value = data.data
    }
  } catch (error) {
    console.error('Error loading categories:', error)
  }
}

// Load available items for pack creation
async function loadAvailableItems() {
  try {
    const data = await api.get<ApiResponse<PaginatedResponse<InventoryItem>>>('/stock/items?limit=1000&active=true')
    if (data.success && data.data) {
      availableItems.value = data.data.data
    }
  } catch (error) {
    console.error('Error loading items:', error)
  }
}

// Load pack detail with items
async function loadPackDetail(packId: string) {
  try {
    const data = await api.get<ApiResponse<StockPack>>(`/stock/packs/${packId}`)
    if (data.success && data.data) {
      return data.data
    }
  } catch (error) {
    console.error('Error loading pack detail:', error)
  }
  return null
}

// Create pack
async function createPack() {
  try {
    const data = await api.post<ApiResponse<StockPack>>('/stock/packs', {
      name: form.value.name,
      description: form.value.description || undefined,
      category: form.value.category || undefined,
      items: form.value.items,
    })
    if (data.success) {
      closeModal()
      loadPacks()
      loadCategories()
    }
  } catch (error) {
    console.error('Error creating pack:', error)
    alert('Error al crear el pack')
  }
}

// Update pack
async function updatePack() {
  if (!currentPack.value) return
  
  try {
    const data = await api.put<ApiResponse<StockPack>>(`/stock/packs/${currentPack.value.id}`, {
      name: form.value.name,
      description: form.value.description || undefined,
      category: form.value.category || undefined,
      items: form.value.items,
    })
    if (data.success) {
      closeModal()
      loadPacks()
      loadCategories()
    }
  } catch (error) {
    console.error('Error updating pack:', error)
    alert('Error al actualizar el pack')
  }
}

// Delete pack
async function deletePack(pack: StockPack) {
  if (!confirm(`¿Eliminar el pack "${pack.name}"?`)) return
  
  try {
    await api.delete(`/stock/packs/${pack.id}`)
    loadPacks()
  } catch (error) {
    console.error('Error deleting pack:', error)
    alert('Error al eliminar el pack')
  }
}

// Add item to form
function addItemToPack(item: InventoryItem) {
  if (form.value.items.some(i => i.itemId === item.id)) {
    // Item already exists, increment quantity
    const existing = form.value.items.find(i => i.itemId === item.id)
    if (existing) existing.quantity++
  } else {
    form.value.items.push({ itemId: item.id, quantity: 1 })
  }
  itemSearch.value = ''
  showItemDropdown.value = false
}

// Remove item from form
function removeItemFromPack(itemId: string) {
  form.value.items = form.value.items.filter(i => i.itemId !== itemId)
}

// Open modals
function openCreateModal() {
  isEditing.value = false
  currentPack.value = null
  resetForm()
  showModal.value = true
}

async function openEditModal(pack: StockPack) {
  isEditing.value = true
  currentPack.value = pack
  
  // Load pack with items
  const detail = await loadPackDetail(pack.id)
  if (detail && detail.items) {
    form.value = {
      name: detail.name,
      description: detail.description || '',
      category: detail.category || '',
      items: detail.items.map(pi => ({ itemId: pi.itemId, quantity: pi.quantity })),
    }
  } else {
    form.value = {
      name: pack.name,
      description: pack.description || '',
      category: pack.category || '',
      items: [],
    }
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  currentPack.value = null
  resetForm()
}

function resetForm() {
  form.value = {
    name: '',
    description: '',
    category: '',
    items: [],
  }
  itemSearch.value = ''
}

// Debounced search
let searchTimeout: number | undefined
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    page.value = 1
    loadPacks()
  }, 300)
})

watch(selectedCategory, () => {
  page.value = 1
  loadPacks()
})

onMounted(() => {
  loadPacks()
  loadCategories()
  loadAvailableItems()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold text-surface-900">Packs de Stock</h1>
        <p class="text-surface-500">Agrupa materiales para aplicarlos rápidamente a citas</p>
      </div>
      <div class="flex gap-2">
        <router-link to="/clinic/inventory" class="btn-secondary">
          <CubeIcon class="w-5 h-5" />
          Ver Inventario
        </router-link>
        <button @click="openCreateModal" class="btn-primary">
          <PlusIcon class="w-5 h-5" />
          Nuevo Pack
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card p-4">
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1 relative">
          <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar packs..."
            class="input pl-10 w-full"
          />
        </div>
        <select v-model="selectedCategory" class="input w-full sm:w-48">
          <option value="">Todas las categorías</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- Packs Grid -->
    <div v-else-if="packs.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div 
        v-for="pack in packs" 
        :key="pack.id" 
        class="card p-6 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-primary-100 rounded-xl">
              <ArchiveBoxIcon class="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 class="font-semibold text-surface-900">{{ pack.name }}</h3>
              <p v-if="pack.category" class="text-xs text-surface-500">{{ pack.category }}</p>
            </div>
          </div>
          <div class="flex gap-1">
            <button 
              @click="openEditModal(pack)" 
              class="p-2 text-surface-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <PencilIcon class="w-4 h-4" />
            </button>
            <button 
              @click="deletePack(pack)" 
              class="p-2 text-surface-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
            >
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <p v-if="pack.description" class="mt-3 text-sm text-surface-600 line-clamp-2">
          {{ pack.description }}
        </p>

        <div class="mt-4 pt-4 border-t border-surface-100">
          <p class="text-sm text-surface-500">
            <span class="font-medium text-surface-900">{{ pack.itemCount || 0 }}</span> items
          </p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="card p-12 text-center">
      <ArchiveBoxIcon class="w-12 h-12 mx-auto text-surface-300" />
      <h3 class="mt-4 font-medium text-surface-900">No hay packs</h3>
      <p class="text-surface-500 mt-1">Crea packs para agrupar materiales de uso frecuente</p>
      <button @click="openCreateModal" class="btn-primary mt-4">
        <PlusIcon class="w-5 h-5" />
        Crear primer pack
      </button>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-surface-500">
        Mostrando {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, total) }} de {{ total }}
      </p>
      <div class="flex gap-2">
        <button 
          @click="page--; loadPacks()" 
          :disabled="page === 1"
          class="btn-secondary p-2"
        >
          <ChevronLeftIcon class="w-5 h-5" />
        </button>
        <button 
          @click="page++; loadPacks()" 
          :disabled="page >= totalPages"
          class="btn-secondary p-2"
        >
          <ChevronRightIcon class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-6 border-b border-surface-200">
          <h2 class="text-xl font-display font-bold text-surface-900">
            {{ isEditing ? 'Editar Pack' : 'Nuevo Pack' }}
          </h2>
          <button @click="closeModal" class="p-2 hover:bg-surface-100 rounded-lg">
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="isEditing ? updatePack() : createPack()" class="p-6 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="label">Nombre del pack *</label>
              <input v-model="form.name" type="text" class="input" required placeholder="Ej: Pack Limpieza Dental" />
            </div>
            <div>
              <label class="label">Categoría</label>
              <input v-model="form.category" type="text" class="input" list="pack-categories" placeholder="Ej: Procedimientos" />
              <datalist id="pack-categories">
                <option v-for="cat in categories" :key="cat" :value="cat" />
              </datalist>
            </div>
            <div class="md:col-span-2">
              <label class="label">Descripción</label>
              <textarea v-model="form.description" rows="2" class="input" placeholder="Descripción opcional..."></textarea>
            </div>
          </div>

          <!-- Items Section -->
          <div>
            <label class="label">Items del pack</label>
            
            <!-- Item Search -->
            <div class="relative">
              <input 
                v-model="itemSearch"
                type="text"
                placeholder="Buscar item para añadir..."
                class="input w-full"
                @focus="showItemDropdown = true"
              />
              
              <!-- Dropdown -->
              <div 
                v-if="showItemDropdown && filteredItems.length > 0" 
                class="absolute top-full left-0 right-0 bg-white border border-surface-200 rounded-lg shadow-lg mt-1 z-10 max-h-48 overflow-y-auto"
              >
                <button
                  v-for="item in filteredItems"
                  :key="item.id"
                  type="button"
                  class="w-full px-4 py-2 text-left hover:bg-surface-50 flex items-center justify-between"
                  @click="addItemToPack(item)"
                >
                  <span>
                    <span class="font-medium">{{ item.name }}</span>
                    <span v-if="item.sku" class="text-xs text-surface-400 ml-2">{{ item.sku }}</span>
                  </span>
                  <span class="text-xs text-surface-500">{{ item.currentStock }} {{ item.unit }}</span>
                </button>
              </div>
            </div>

            <!-- Selected Items -->
            <div v-if="form.items.length > 0" class="mt-4 space-y-2">
              <div 
                v-for="packItem in form.items" 
                :key="packItem.itemId"
                class="flex items-center justify-between p-3 bg-surface-50 rounded-lg"
              >
                <div class="flex items-center gap-3">
                  <CubeIcon class="w-5 h-5 text-surface-400" />
                  <div>
                    <p class="font-medium text-surface-900">
                      {{ getItemById(packItem.itemId)?.name || 'Item' }}
                    </p>
                    <p class="text-xs text-surface-500">
                      {{ getItemById(packItem.itemId)?.unit }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <input 
                    v-model.number="packItem.quantity" 
                    type="number" 
                    min="1" 
                    class="input w-20 text-center"
                  />
                  <button 
                    type="button"
                    @click="removeItemFromPack(packItem.itemId)"
                    class="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <XMarkIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-surface-400 mt-2">
              No hay items en este pack. Usa la búsqueda de arriba para añadirlos.
            </p>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-surface-200">
            <button type="button" @click="closeModal" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="form.items.length === 0">
              {{ isEditing ? 'Guardar cambios' : 'Crear pack' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Click outside to close dropdown -->
    <div v-if="showItemDropdown" class="fixed inset-0 z-5" @click="showItemDropdown = false"></div>
  </div>
</template>
