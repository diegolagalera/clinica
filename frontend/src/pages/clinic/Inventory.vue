<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { api } from '@/services/api'
import { toast } from '@/composables/useToast'
import { getTenantSlug } from '@/utils/tenant'
import type { ApiResponse, PaginatedResponse } from '@/types'
import BarcodeScanner from '@/components/BarcodeScanner.vue'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  CubeIcon,
  Squares2X2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
  InformationCircleIcon,
  SparklesIcon,
  QrCodeIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
} from '@heroicons/vue/24/outline'

// Build image URL with tenant context for <img> tags (can't send auth headers)
const tenantSlug = getTenantSlug()
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'
const stockImageUrl = (itemId: string) =>
  `${API_BASE}/stock/items/${itemId}/image${tenantSlug ? `?tenant=${tenantSlug}` : ''}`

interface InventoryItem {
  id: string
  name: string
  sku: string | null
  description: string | null
  category: string | null
  unit: string
  currentStock: number
  minStock: number
  maxStock: number | null
  costPrice: string | null
  sellPrice: string | null
  supplierId: string | null
  supplier: string | null
  supplierCode: string | null
  expirationDate: string | null
  location: string | null
  imageUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface StockSummary {
  totalItems: number
  totalStock: number
  totalValue: string
  lowStockCount: number
  outOfStockCount: number
  byCategory: { category: string; count: number; totalValue: string }[]
}

interface SimpleSupplier {
  id: string
  name: string
}

// State
const items = ref<InventoryItem[]>([])
const categories = ref<string[]>([])
const suppliers = ref<SimpleSupplier[]>([])
const summary = ref<StockSummary | null>(null)
const total = ref(0)
const page = ref(1)
const limit = ref(20)

// Filters
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedSupplier = ref('')
const showLowStock = ref(false)

// UI State
const isLoading = ref(false)
const showModal = ref(false)
const showAdjustModal = ref(false)
const isEditing = ref(false)
const currentItem = ref<InventoryItem | null>(null)
const showDeleteModal = ref(false)
const itemToDelete = ref<InventoryItem | null>(null)

// Form data
const form = ref({
  name: '',
  sku: '',
  description: '',
  category: '',
  unit: 'unidades',
  currentStock: 0,
  minStock: 0,
  maxStock: 0,
  costPrice: '',
  sellPrice: '',
  supplierId: '' as string | null,
  supplier: '',
  supplierCode: '',
  expirationDate: '',
  location: '',
})

// Adjustment form
const adjustForm = ref({
  type: 'IN' as 'IN' | 'OUT' | 'ADJUSTMENT' | 'EXPIRED',
  quantity: 1,
  reason: '',
  unitCost: null as number | null,
})

// Image upload
const selectedImage = ref<File | null>(null)
const imagePreview = ref<string | null>(null)

// AI Image generation
const isGeneratingImage = ref(false)
const generatedImageUrl = ref<string | null>(null)

// Barcode scanner
const showBarcodeScanner = ref(false)
const lastScannedBarcode = ref<{ code: string; format: string } | null>(null)

// Handle barcode scan result
function handleBarcodeScanned(code: string, format: string) {
  lastScannedBarcode.value = { code, format }
  showBarcodeScanner.value = false
  
  // Auto-fill SKU field with the barcode
  form.value.sku = code
}

// Saving state
const isSaving = ref(false)

// Image lightbox
const lightboxImage = ref<string | null>(null)

// Computed
const totalPages = computed(() => Math.ceil(total.value / limit.value))

// Load items
async function loadItems() {
  isLoading.value = true
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: limit.value.toString(),
    })
    if (searchQuery.value) params.append('search', searchQuery.value)
    if (selectedCategory.value) params.append('category', selectedCategory.value)
    if (selectedSupplier.value) params.append('supplierId', selectedSupplier.value)
    if (showLowStock.value) params.append('lowStock', 'true')

    const data = await api.get<ApiResponse<PaginatedResponse<InventoryItem>>>(`/stock/items?${params}`)
    if (data.success && data.data) {
      items.value = data.data.data
      total.value = data.data.pagination.total
    }
  } catch (error) {
    console.error('Error loading items:', error)
  } finally {
    isLoading.value = false
  }
}

// Load categories
async function loadCategories() {
  try {
    const data = await api.get<ApiResponse<string[]>>('/stock/items/categories')
    if (data.success && data.data) {
      categories.value = data.data
    }
  } catch (error) {
    console.error('Error loading categories:', error)
  }
}

// Load suppliers for dropdown
async function loadSuppliers() {
  try {
    const data = await api.get<ApiResponse<SimpleSupplier[]>>('/stock/suppliers/all')
    if (data.success && data.data) {
      suppliers.value = data.data
    }
  } catch (error) {
    console.error('Error loading suppliers:', error)
  }
}

// Load summary
async function loadSummary() {
  try {
    const data = await api.get<ApiResponse<StockSummary>>('/stock/reports/summary')
    if (data.success && data.data) {
      summary.value = data.data
    }
  } catch (error) {
    console.error('Error loading summary:', error)
  }
}

// Create item
async function createItem() {
  isSaving.value = true
  try {
    const payload = {
      ...form.value,
      currentStock: Number(form.value.currentStock),
      minStock: Number(form.value.minStock),
      maxStock: form.value.maxStock ? Number(form.value.maxStock) : undefined,
      costPrice: form.value.costPrice || undefined,
      sellPrice: form.value.sellPrice || undefined,
      expirationDate: form.value.expirationDate || undefined,
    }
    
    const data = await api.post<ApiResponse<InventoryItem>>('/stock/items', payload)
    if (data.success && data.data) {
      // Upload image if selected from file
      if (selectedImage.value) {
        await uploadImage(data.data.id)
      } 
      // Or save AI-generated image (pass the URL so it doesn't regenerate)
      else if (generatedImageUrl.value) {
        await api.post(`/stock/items/${data.data.id}/generate-image`, {
          imageUrl: generatedImageUrl.value
        })
      }
      closeModal()
      loadItems()
      loadSummary()
      loadCategories()
    }
  } catch (error) {
    console.error('Error creating item:', error)
    toast.error('Error al crear el item')
  } finally {
    isSaving.value = false
  }
}

// Update item
async function updateItem() {
  if (!currentItem.value) return
  
  isSaving.value = true
  try {
    const payload = {
      ...form.value,
      currentStock: Number(form.value.currentStock),
      minStock: Number(form.value.minStock),
      maxStock: form.value.maxStock ? Number(form.value.maxStock) : undefined,
      costPrice: form.value.costPrice || undefined,
      sellPrice: form.value.sellPrice || undefined,
      expirationDate: form.value.expirationDate || undefined,
    }
    
    const data = await api.put<ApiResponse<InventoryItem>>(`/stock/items/${currentItem.value.id}`, payload)
    if (data.success) {
      // Upload image if selected from file
      if (selectedImage.value) {
        await uploadImage(currentItem.value.id)
      }
      // Or save AI-generated image (pass the URL so it doesn't regenerate)
      else if (generatedImageUrl.value) {
        await api.post(`/stock/items/${currentItem.value.id}/generate-image`, {
          imageUrl: generatedImageUrl.value
        })
      }
      closeModal()
      loadItems()
      loadSummary()
      loadCategories()
    }
  } catch (error) {
    console.error('Error updating item:', error)
    toast.error('Error al actualizar el item')
  } finally {
    isSaving.value = false
  }
}

// Upload image
async function uploadImage(itemId: string) {
  if (!selectedImage.value) return
  
  const formData = new FormData()
  formData.append('image', selectedImage.value)
  
  try {
    await api.post(`/stock/items/${itemId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  } catch (error) {
    console.error('Error uploading image:', error)
  }
}

// Delete item
function confirmDelete(item: InventoryItem) {
  itemToDelete.value = item
  showDeleteModal.value = true
}

async function deleteItem() {
  if (!itemToDelete.value) return
  
  try {
    await api.delete(`/stock/items/${itemToDelete.value.id}`)
    showDeleteModal.value = false
    itemToDelete.value = null
    loadItems()
    loadSummary()
  } catch (error) {
    console.error('Error deleting item:', error)
    toast.error('Error al eliminar el item')
  }
}

// Adjust stock
async function adjustStock() {
  if (!currentItem.value) return
  
  try {
    await api.post(`/stock/items/${currentItem.value.id}/adjust`, adjustForm.value)
    closeAdjustModal()
    loadItems()
    loadSummary()
  } catch (error: any) {
    console.error('Error adjusting stock:', error)
    toast.error(error.response?.data?.message || 'Error al ajustar el stock')
  }
}

// Open modals
function openCreateModal() {
  isEditing.value = false
  currentItem.value = null
  resetForm()
  showModal.value = true
}

function openEditModal(item: InventoryItem) {
  isEditing.value = true
  currentItem.value = item
  form.value = {
    name: item.name,
    sku: item.sku || '',
    description: item.description || '',
    category: item.category || '',
    unit: item.unit,
    currentStock: item.currentStock,
    minStock: item.minStock,
    maxStock: item.maxStock || 0,
    costPrice: item.costPrice || '',
    sellPrice: item.sellPrice || '',
    supplierId: item.supplierId || '',
    supplier: item.supplier || '',
    supplierCode: item.supplierCode || '',
    expirationDate: item.expirationDate ? item.expirationDate.split('T')[0] : '',
    location: item.location || '',
  }
  // Set image preview using the API endpoint (imageUrl contains filesystem path, not URL)
  imagePreview.value = item.imageUrl ? stockImageUrl(item.id) : null
  showModal.value = true
}

function openAdjustModal(item: InventoryItem) {
  currentItem.value = item
  adjustForm.value = {
    type: 'IN',
    quantity: 1,
    reason: '',
    unitCost: item.costPrice ? parseFloat(item.costPrice) : null,
  }
  showAdjustModal.value = true
}

function closeModal() {
  showModal.value = false
  currentItem.value = null
  selectedImage.value = null
  imagePreview.value = null
  generatedImageUrl.value = null
  resetForm()
}

function closeAdjustModal() {
  showAdjustModal.value = false
  currentItem.value = null
}

function resetForm() {
  form.value = {
    name: '',
    sku: '',
    description: '',
    category: '',
    unit: 'unidades',
    currentStock: 0,
    minStock: 0,
    maxStock: 0,
    costPrice: '',
    sellPrice: '',
    supplierId: '',
    supplier: '',
    supplierCode: '',
    expirationDate: '',
    location: '',
  }
  selectedImage.value = null
  imagePreview.value = null
  generatedImageUrl.value = null
}

// Image handling
function handleImageSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedImage.value = input.files[0]
    imagePreview.value = URL.createObjectURL(input.files[0])
    generatedImageUrl.value = null
  }
}

// AI Image generation
async function generateAIImage() {
  if (!form.value.name.trim()) {
    toast.error('Por favor, introduce el nombre del producto primero')
    return
  }
  
  isGeneratingImage.value = true
  try {
    const response = await api.post<ApiResponse<{ imageUrl: string; revisedPrompt: string }>>('/stock/items/generate-image', {
      itemName: form.value.name,
      description: form.value.description || undefined,
    })
    
    if (response.success && response.data) {
      generatedImageUrl.value = response.data.imageUrl
      imagePreview.value = response.data.imageUrl
      // Clear any selected file since we're using AI image
      selectedImage.value = null
    } else {
      toast.error(response.errors?.[0] || 'Error al generar la imagen')
    }
  } catch (error: any) {
    console.error('Error generating AI image:', error)
    toast.error(error.response?.data?.error || 'Error al generar la imagen. Asegúrate de que el nombre sea de un producto médico/dental.')
  } finally {
    isGeneratingImage.value = false
  }
}

// Helpers
function getStockClass(item: InventoryItem) {
  if (item.currentStock === 0) return 'text-red-600 bg-red-50'
  if (item.currentStock <= item.minStock) return 'text-amber-600 bg-amber-50'
  return 'text-green-600 bg-green-50'
}

function formatCurrency(value: string | null) {
  if (!value) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(parseFloat(value))
}

// Debounced search
let searchTimeout: number | undefined
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    page.value = 1
    loadItems()
  }, 300)
})

watch([selectedCategory, selectedSupplier, showLowStock], () => {
  page.value = 1
  loadItems()
})

onMounted(() => {
  loadItems()
  loadCategories()
  loadSuppliers()
  loadSummary()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold text-surface-900">Inventario</h1>
        <p class="text-surface-500">Gestión de stock y materiales</p>
      </div>
      <div class="flex gap-2">
        <router-link to="/clinic/stock-analytics" class="btn-secondary">
          <ChartBarIcon class="w-5 h-5" />
          Analíticas
        </router-link>
        <router-link to="/clinic/suppliers" class="btn-secondary">
          <BuildingStorefrontIcon class="w-5 h-5" />
          Proveedores
        </router-link>
        <router-link to="/clinic/stock-packs" class="btn-secondary">
          <ArchiveBoxIcon class="w-5 h-5" />
          Ver Packs
        </router-link>
        <button @click="openCreateModal" class="btn-primary">
          <PlusIcon class="w-5 h-5" />
          Nuevo Item
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div v-if="summary" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary-100 rounded-lg">
            <CubeIcon class="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <p class="text-sm text-surface-500">Total Items</p>
            <p class="text-xl font-bold text-surface-900">{{ summary.totalItems }}</p>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-green-100 rounded-lg">
            <Squares2X2Icon class="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p class="text-sm text-surface-500">Stock Total</p>
            <p class="text-xl font-bold text-surface-900">{{ summary.totalStock }}</p>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-amber-100 rounded-lg">
            <ExclamationTriangleIcon class="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p class="text-sm text-surface-500">Stock Bajo</p>
            <p class="text-xl font-bold text-amber-600">{{ summary.lowStockCount }}</p>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-100 rounded-lg">
            <span class="text-blue-600 font-bold text-lg">€</span>
          </div>
          <div>
            <p class="text-sm text-surface-500">Valor Total</p>
            <p class="text-xl font-bold text-surface-900">€{{ summary.totalValue }}</p>
          </div>
        </div>
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
            placeholder="Buscar por nombre o SKU..."
            class="input pl-10 w-full"
          />
        </div>
        <select v-model="selectedCategory" class="input w-full sm:w-48">
          <option value="">Todas las categorías</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="selectedSupplier" class="input w-full sm:w-48">
          <option value="">Todos los proveedores</option>
          <option value="none">Sin proveedor</option>
          <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="showLowStock" type="checkbox" class="rounded text-primary-600" />
          <span class="text-sm text-surface-700">Stock bajo</span>
        </label>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- Items Table -->
    <div v-else-if="items.length > 0" class="card overflow-hidden">
      <!-- Top Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between p-4 border-b border-surface-200 bg-surface-50">
        <p class="text-sm text-surface-500">
          Mostrando {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, total) }} de {{ total }} items
        </p>
        <div class="flex items-center gap-2">
          <span class="text-sm text-surface-500">Página {{ page }} de {{ totalPages }}</span>
          <button 
            @click="page--; loadItems()" 
            :disabled="page === 1"
            class="btn-secondary p-2"
          >
            <ChevronLeftIcon class="w-5 h-5" />
          </button>
          <button 
            @click="page++; loadItems()" 
            :disabled="page >= totalPages"
            class="btn-secondary p-2"
          >
            <ChevronRightIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-surface-50 border-b border-surface-200">
            <tr>
              <th class="text-left p-4 font-medium text-surface-600">Item</th>
              <th class="text-left p-4 font-medium text-surface-600">Categoría</th>
              <th class="text-center p-4 font-medium text-surface-600">Stock</th>
              <th class="text-right p-4 font-medium text-surface-600">Precio Costo</th>
              <th class="text-left p-4 font-medium text-surface-600">Ubicación</th>
              <th class="text-right p-4 font-medium text-surface-600">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-100">
            <tr v-for="item in items" :key="item.id" class="hover:bg-surface-50">
              <td class="p-4">
                <div class="flex items-center gap-3">
                  <div 
                    v-if="item.imageUrl" 
                    class="w-10 h-10 rounded-lg bg-surface-100 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all"
                    @click="lightboxImage = stockImageUrl(item.id)"
                  >
                    <img :src="stockImageUrl(item.id)" class="w-full h-full object-cover" />
                  </div>
                  <div v-else class="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center">
                    <PhotoIcon class="w-5 h-5 text-surface-400" />
                  </div>
                  <div>
                    <p class="font-medium text-surface-900">{{ item.name }}</p>
                    <p v-if="item.sku" class="text-xs text-surface-500">{{ item.sku }}</p>
                  </div>
                </div>
              </td>
              <td class="p-4">
                <span v-if="item.category" class="px-2 py-1 text-xs rounded-full bg-surface-100 text-surface-600">
                  {{ item.category }}
                </span>
                <span v-else class="text-surface-400">-</span>
              </td>
              <td class="p-4 text-center">
                <span 
                  class="px-3 py-1 rounded-full text-sm font-medium"
                  :class="getStockClass(item)"
                >
                  {{ item.currentStock }} {{ item.unit }}
                </span>
                <p v-if="item.minStock > 0" class="text-xs text-surface-400 mt-1">
                  Min: {{ item.minStock }}
                </p>
              </td>
              <td class="p-4 text-right">
                {{ formatCurrency(item.costPrice) }}
              </td>
              <td class="p-4">
                {{ item.location || '-' }}
              </td>
              <td class="p-4">
                <div class="flex justify-end gap-2">
                  <button 
                    @click="openAdjustModal(item)" 
                    class="p-2 text-surface-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                    title="Ajustar stock"
                  >
                    <AdjustmentsHorizontalIcon class="w-5 h-5" />
                  </button>
                  <button 
                    @click="openEditModal(item)" 
                    class="p-2 text-surface-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Editar"
                  >
                    <PencilIcon class="w-5 h-5" />
                  </button>
                  <button 
                    @click="confirmDelete(item)" 
                    class="p-2 text-surface-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Eliminar"
                  >
                    <TrashIcon class="w-5 h-5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bottom Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between p-4 border-t border-surface-200 bg-surface-50">
        <p class="text-sm text-surface-500">
          Mostrando {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, total) }} de {{ total }} items
        </p>
        <div class="flex items-center gap-2">
          <span class="text-sm text-surface-500">Página {{ page }} de {{ totalPages }}</span>
          <button 
            @click="page--; loadItems()" 
            :disabled="page === 1"
            class="btn-secondary p-2"
          >
            <ChevronLeftIcon class="w-5 h-5" />
          </button>
          <button 
            @click="page++; loadItems()" 
            :disabled="page >= totalPages"
            class="btn-secondary p-2"
          >
            <ChevronRightIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="card p-12 text-center">
      <CubeIcon class="w-12 h-12 mx-auto text-surface-300" />
      <h3 class="mt-4 font-medium text-surface-900">No hay items</h3>
      <p class="text-surface-500 mt-1">Comienza añadiendo items a tu inventario</p>
      <button @click="openCreateModal" class="btn-primary mt-4">
        <PlusIcon class="w-5 h-5" />
        Añadir primer item
      </button>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
          <!-- Header (sticky) -->
          <div class="flex items-center justify-between p-6 border-b border-surface-200 flex-shrink-0">
            <h2 class="text-xl font-display font-bold text-surface-900">
              {{ isEditing ? 'Editar Item' : 'Nuevo Item' }}
            </h2>
            <div class="flex items-center gap-2">
              <!-- Barcode Scanner Button -->
              <button 
                v-if="!isEditing"
                type="button" 
                @click="showBarcodeScanner = true" 
                class="btn-secondary p-2"
                title="Escanear código de barras"
              >
                <QrCodeIcon class="w-5 h-5" />
              </button>
              <button @click="closeModal" class="p-2 hover:bg-surface-100 rounded-lg">
                <XMarkIcon class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Scrollable content -->
          <form @submit.prevent="isEditing ? updateItem() : createItem()" class="flex flex-col flex-1 overflow-hidden">
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <!-- Image Upload -->
              <div class="flex items-center gap-6">
                <div class="w-24 h-24 rounded-xl bg-surface-100 overflow-hidden flex items-center justify-center relative">
                  <img v-if="imagePreview" :src="imagePreview" class="w-full h-full object-cover" />
                  <PhotoIcon v-else class="w-10 h-10 text-surface-400" />
                  <div v-if="isGeneratingImage" class="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <ArrowPathIcon class="w-8 h-8 text-primary-600 animate-spin" />
                  </div>
                </div>
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <label class="btn-secondary cursor-pointer">
                      <PhotoIcon class="w-5 h-5" />
                      Subir imagen
                      <input type="file" accept="image/*" class="hidden" @change="handleImageSelect" />
                    </label>
                    <button
                      type="button"
                      @click="generateAIImage"
                      :disabled="isGeneratingImage || !form.name.trim()"
                      class="btn-secondary gap-1"
                      :class="{ 'opacity-50 cursor-not-allowed': isGeneratingImage || !form.name.trim() }"
                      :title="!form.name.trim() ? 'Introduce el nombre del producto primero' : 'Generar imagen con IA'"
                    >
                      <SparklesIcon class="w-5 h-5" />
                      <span v-if="isGeneratingImage">Generando...</span>
                      <span v-else>IA</span>
                    </button>
                  </div>
                  <p class="text-xs text-surface-500">JPG, PNG o WebP. Max 5MB. O genera con IA ✨</p>
                  <p v-if="generatedImageUrl" class="text-xs text-primary-600">✓ Imagen generada por IA</p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                  <label class="label flex items-center gap-1">
                    Nombre *
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Nombre del producto o material</span>
                    </span>
                  </label>
                  <input v-model="form.name" type="text" class="input" required />
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    SKU
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Código único interno para identificar el producto</span>
                    </span>
                  </label>
                  <input v-model="form.sku" type="text" class="input" placeholder="Código único" />
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Categoría
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Agrupa productos similares (texto libre)</span>
                    </span>
                  </label>
                  <input v-model="form.category" type="text" class="input" list="categories" />
                  <datalist id="categories">
                    <option v-for="cat in categories" :key="cat" :value="cat" />
                  </datalist>
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Unidad
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Cómo se mide o cuenta el producto</span>
                    </span>
                  </label>
                  <select v-model="form.unit" class="input">
                    <option value="unidades">Unidades</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="cajas">Cajas</option>
                    <option value="paquetes">Paquetes</option>
                  </select>
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Stock Actual
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Cantidad disponible ahora mismo</span>
                    </span>
                  </label>
                  <input v-model.number="form.currentStock" type="number" min="0" class="input" />
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Stock Mínimo
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Cantidad bajo la cual se muestra alerta</span>
                    </span>
                  </label>
                  <input v-model.number="form.minStock" type="number" min="0" class="input" />
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Stock Máximo
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Cantidad ideal máxima para evitar exceso</span>
                    </span>
                  </label>
                  <input v-model.number="form.maxStock" type="number" min="0" class="input" />
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Precio Costo (€)
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Lo que pagas al proveedor</span>
                    </span>
                  </label>
                  <input v-model="form.costPrice" type="number" step="0.01" min="0" class="input" />
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Precio Venta (€)
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Lo que cobras al paciente (si aplica)</span>
                    </span>
                  </label>
                  <input v-model="form.sellPrice" type="number" step="0.01" min="0" class="input" />
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Proveedor
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Selecciona un proveedor registrado</span>
                    </span>
                  </label>
                  <select v-model="form.supplierId" class="input">
                    <option value="">Sin proveedor</option>
                    <option v-for="s in suppliers" :key="s.id" :value="s.id">
                      {{ s.name }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Código Proveedor
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Referencia del producto en el catálogo del proveedor</span>
                    </span>
                  </label>
                  <input v-model="form.supplierCode" type="text" class="input" />
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Fecha Caducidad
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Para productos que expiran</span>
                    </span>
                  </label>
                  <input v-model="form.expirationDate" type="date" class="input" />
                </div>
                <div>
                  <label class="label flex items-center gap-1">
                    Ubicación
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Dónde guardas el producto en la clínica</span>
                    </span>
                  </label>
                  <input v-model="form.location" type="text" class="input" placeholder="Ej: Armario A, Estante 2" />
                </div>
                <div class="md:col-span-2">
                  <label class="label flex items-center gap-1">
                    Descripción
                    <span class="relative group">
                      <InformationCircleIcon class="w-4 h-4 text-surface-400 cursor-help" />
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-surface-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">Notas adicionales sobre el producto</span>
                    </span>
                  </label>
                  <textarea v-model="form.description" rows="2" class="input"></textarea>
                </div>
              </div>
            </div>

            <!-- Footer (sticky) -->
            <div class="flex justify-end gap-3 px-6 py-4 border-t border-surface-200 flex-shrink-0 bg-white rounded-b-xl">
              <button type="button" @click="closeModal" class="btn-secondary" :disabled="isSaving">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="isSaving">
                <span v-if="isSaving" class="flex items-center gap-2">
                  <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </span>
                <span v-else>{{ isEditing ? 'Guardar cambios' : 'Crear item' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Adjust Stock Modal -->
    <div v-if="showAdjustModal && currentItem" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div class="flex items-center justify-between p-6 border-b border-surface-200">
          <h2 class="text-xl font-display font-bold text-surface-900">Ajustar Stock</h2>
          <button @click="closeAdjustModal" class="p-2 hover:bg-surface-100 rounded-lg">
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="adjustStock" class="p-6 space-y-4">
          <div class="text-center pb-4 border-b border-surface-200">
            <p class="font-medium text-surface-900">{{ currentItem.name }}</p>
            <p class="text-2xl font-bold mt-2">
              Stock actual: <span :class="getStockClass(currentItem)">{{ currentItem.currentStock }}</span>
            </p>
          </div>

          <div>
            <label class="label">Tipo de movimiento</label>
            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                @click="adjustForm.type = 'IN'"
                class="p-3 rounded-lg border-2 flex items-center justify-center gap-2"
                :class="adjustForm.type === 'IN' ? 'border-green-500 bg-green-50 text-green-700' : 'border-surface-200'"
              >
                <ArrowUpIcon class="w-5 h-5" />
                Entrada
              </button>
              <button 
                type="button" 
                @click="adjustForm.type = 'OUT'"
                class="p-3 rounded-lg border-2 flex items-center justify-center gap-2"
                :class="adjustForm.type === 'OUT' ? 'border-red-500 bg-red-50 text-red-700' : 'border-surface-200'"
              >
                <ArrowDownIcon class="w-5 h-5" />
                Salida
              </button>
              <button 
                type="button" 
                @click="adjustForm.type = 'ADJUSTMENT'"
                class="p-3 rounded-lg border-2 flex items-center justify-center gap-2"
                :class="adjustForm.type === 'ADJUSTMENT' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-surface-200'"
              >
                <ArrowPathIcon class="w-5 h-5" />
                Ajuste
              </button>
              <button 
                type="button" 
                @click="adjustForm.type = 'EXPIRED'"
                class="p-3 rounded-lg border-2 flex items-center justify-center gap-2"
                :class="adjustForm.type === 'EXPIRED' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-surface-200'"
              >
                <ExclamationTriangleIcon class="w-5 h-5" />
                Caducado
              </button>
            </div>
          </div>

          <div>
            <label class="label">
              {{ adjustForm.type === 'ADJUSTMENT' ? 'Nuevo stock' : 'Cantidad' }}
            </label>
            <input v-model.number="adjustForm.quantity" type="number" min="1" class="input" required />
          </div>

          <!-- Unit Cost field - only for IN movements -->
          <div v-if="adjustForm.type === 'IN'">
            <label class="label">
              Precio unitario de compra (€)
              <span class="text-surface-400 font-normal">- para calcular coste promedio</span>
            </label>
            <input 
              v-model.number="adjustForm.unitCost" 
              type="number" 
              min="0" 
              step="0.01" 
              class="input" 
              :placeholder="currentItem?.costPrice ? `Precio actual: ${currentItem.costPrice}€` : 'Precio por unidad'"
            />
          </div>

          <div>
            <label class="label">Razón (opcional)</label>
            <input v-model="adjustForm.reason" type="text" class="input" placeholder="Ej: Inventario inicial, Rotura..." />
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-surface-200">
            <button type="button" @click="closeAdjustModal" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Aplicar</button>
          </div>
        </form>
      </div>
    </div>
  </div>

    <!-- Barcode Scanner Modal -->
    <BarcodeScanner 
      v-if="showBarcodeScanner" 
      @scanned="handleBarcodeScanned"
      @close="showBarcodeScanner = false"
    />

    <!-- Image Lightbox -->
    <Teleport to="body">
      <div 
        v-if="lightboxImage" 
        class="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4 cursor-pointer"
        @click="lightboxImage = null"
      >
        <button 
          class="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          @click.stop="lightboxImage = null"
        >
          <XMarkIcon class="w-6 h-6 text-white" />
        </button>
        <img 
          :src="lightboxImage" 
          class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          @click.stop
        />
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-3 bg-red-100 rounded-full">
              <ExclamationTriangleIcon class="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 class="text-lg font-display font-bold text-surface-900">Eliminar item</h3>
              <p class="text-sm text-surface-500">Esta acción no se puede deshacer</p>
            </div>
          </div>
          <p class="text-surface-700 mb-6">
            ¿Estás seguro de que quieres eliminar <strong>{{ itemToDelete?.name }}</strong>?
          </p>
          <div class="flex gap-3">
            <button 
              @click="showDeleteModal = false; itemToDelete = null" 
              class="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button 
              @click="deleteItem" 
              class="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
</template>
