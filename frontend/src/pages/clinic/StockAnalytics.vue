<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import type { ApiResponse } from '@/types'
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CubeIcon,
  UserIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/vue/24/outline'

// Types
interface StockSummary {
  totalItems: number
  totalStock: number
  totalValue: string
  lowStockCount: number
  outOfStockCount: number
  byCategory: { category: string; count: number; totalValue: string }[]
}

interface Movement {
  id: string
  itemId: string
  itemName: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'EXPIRED'
  quantity: number
  unitCost: string | null
  previousStock: number
  newStock: number
  reason: string | null
  reference: string | null
  performedBy: string | null
  createdAt: string
}

interface MovementSummary {
  type: string
  count: number
  totalQuantity: number
}

interface ConsumptionItem {
  itemId: string
  itemName: string
  itemSku: string | null
  category: string | null
  totalQuantity: number
  totalCost: string
  usageCount: number
}

interface ConsumptionReport {
  dateRange: { start: string; end: string }
  summary: {
    totalQuantity: number
    totalCost: string
    uniqueItems: number
  }
  items: ConsumptionItem[]
}

interface PatientConsumption {
  patientId: string
  patientName: string
  totalQuantity: number
  totalCost: string
  appointmentCount: number
}

interface LowStockItem {
  id: string
  name: string
  sku: string | null
  category: string | null
  currentStock: number
  minStock: number
}

interface ExpiringItem {
  id: string
  name: string
  sku: string | null
  category: string | null
  currentStock: number
  expirationDate: string
  daysUntilExpiration: number
}

// Router
const router = useRouter()

// State
const isLoading = ref(false)
const summary = ref<StockSummary | null>(null)
const movements = ref<Movement[]>([])
const movementSummary = ref<MovementSummary[]>([])
const consumption = ref<ConsumptionReport | null>(null)
const patientConsumption = ref<PatientConsumption[]>([])
const lowStockItems = ref<LowStockItem[]>([])
const expiringItems = ref<ExpiringItem[]>([])

// Filters
const dateRange = ref<'today' | '7days' | '30days' | '90days' | 'custom'>('30days')
const customStartDate = ref('')
const customEndDate = ref('')
const movementTypeFilter = ref<string>('')
const itemFilter = ref<string>('')

// Items list for filter
interface SimpleItem {
  id: string
  name: string
  sku: string | null
}
const items = ref<SimpleItem[]>([])
const itemSearch = ref('')
const showItemDropdown = ref(false)

// Filtered items for dropdown
const filteredItems = computed(() => {
  if (!itemSearch.value) return items.value
  const search = itemSearch.value.toLowerCase()
  return items.value.filter(item => 
    item.name.toLowerCase().includes(search) || 
    (item.sku && item.sku.toLowerCase().includes(search))
  )
})

// Selected item display
const selectedItemDisplay = computed(() => {
  if (!itemFilter.value) return 'Todos los productos'
  const item = items.value.find(i => i.id === itemFilter.value)
  return item ? `${item.name}${item.sku ? ` (${item.sku})` : ''}` : 'Todos los productos'
})

// Ref for dropdown positioning
const productInputRef = ref<HTMLElement | null>(null)
const dropdownPosition = ref({ top: 0, left: 0 })

const dropdownStyle = computed(() => ({
  top: `${dropdownPosition.value.top}px`,
  left: `${dropdownPosition.value.left}px`,
}))

function updateDropdownPosition() {
  if (productInputRef.value) {
    const rect = productInputRef.value.getBoundingClientRect()
    dropdownPosition.value = {
      top: rect.bottom + 4,
      left: rect.left,
    }
  }
}

function selectItem(itemId: string) {
  itemFilter.value = itemId
  itemSearch.value = ''
  showItemDropdown.value = false
}

function clearItemFilter() {
  itemFilter.value = ''
  itemSearch.value = ''
  showItemDropdown.value = false
}

function openProductDropdown() {
  updateDropdownPosition()
  showItemDropdown.value = true
}

// Sections visibility
const showPatientConsumption = ref(false)
const showAlerts = ref(true)

// Computed dates
const dateParams = computed(() => {
  const now = new Date()
  let start: Date
  let end = new Date()
  end.setHours(23, 59, 59, 999)

  switch (dateRange.value) {
    case 'today':
      start = new Date()
      start.setHours(0, 0, 0, 0)
      break
    case '7days':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30days':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90days':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'custom':
      start = customStartDate.value ? new Date(customStartDate.value) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      end = customEndDate.value ? new Date(customEndDate.value) : end
      break
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
})

// Load all data
async function loadData() {
  isLoading.value = true
  try {
    await Promise.all([
      loadSummary(),
      loadMovements(),
      loadConsumption(),
      loadLowStock(),
      loadExpiring(),
    ])
  } finally {
    isLoading.value = false
  }
}

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

async function loadMovements() {
  try {
    const params = new URLSearchParams({
      startDate: dateParams.value.startDate,
      endDate: dateParams.value.endDate,
    })
    if (movementTypeFilter.value) {
      params.append('type', movementTypeFilter.value)
    }
    if (itemFilter.value) {
      params.append('itemId', itemFilter.value)
    }

    const data = await api.get<ApiResponse<{ movements: Movement[]; summary: MovementSummary[] }>>(`/stock/reports/movements?${params}`)
    if (data.success && data.data) {
      movements.value = data.data.movements
      movementSummary.value = data.data.summary
    }
  } catch (error) {
    console.error('Error loading movements:', error)
  }
}

async function loadConsumption() {
  try {
    const params = new URLSearchParams({
      startDate: dateParams.value.startDate,
      endDate: dateParams.value.endDate,
    })

    const [consumptionData, patientData] = await Promise.all([
      api.get<ApiResponse<ConsumptionReport>>(`/stock/reports/consumption?${params}`),
      api.get<ApiResponse<{ dateRange: object; patients: PatientConsumption[] }>>(`/stock/reports/consumption/by-patient?${params}`),
    ])

    if (consumptionData.success && consumptionData.data) {
      consumption.value = consumptionData.data
    }
    if (patientData.success && patientData.data) {
      patientConsumption.value = patientData.data.patients
    }
  } catch (error) {
    console.error('Error loading consumption:', error)
  }
}

async function loadLowStock() {
  try {
    const data = await api.get<ApiResponse<LowStockItem[]>>('/stock/reports/low-stock')
    if (data.success && data.data) {
      lowStockItems.value = data.data
    }
  } catch (error) {
    console.error('Error loading low stock:', error)
  }
}

async function loadExpiring() {
  try {
    const data = await api.get<ApiResponse<ExpiringItem[]>>('/stock/reports/expiring')
    if (data.success && data.data) {
      expiringItems.value = data.data
    }
  } catch (error) {
    console.error('Error loading expiring items:', error)
  }
}

async function loadItems() {
  try {
    const data = await api.get<ApiResponse<{ data: SimpleItem[] }>>('/stock/items?limit=500')
    if (data.success && data.data) {
      items.value = data.data.data
    }
  } catch (error) {
    console.error('Error loading items:', error)
  }
}

// Export to CSV
function exportToCSV() {
  if (movements.value.length === 0) {
    alert('No hay movimientos para exportar')
    return
  }

  const headers = ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Precio/ud', 'Stock Anterior', 'Stock Nuevo', 'Usuario', 'Motivo']
  const rows = movements.value.map(m => [
    formatDateTime(m.createdAt),
    m.itemName,
    getMovementTypeLabel(m.type),
    m.quantity,
    m.unitCost ? parseFloat(m.unitCost).toFixed(2) : '',
    m.previousStock,
    m.newStock,
    m.performedBy || 'Sistema',
    m.reason || '',
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `movimientos-stock-${dateParams.value.startDate}-${dateParams.value.endDate}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Helpers
function formatDateTime(date: string) {
  return new Date(date).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getMovementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    IN: 'Entrada',
    OUT: 'Salida',
    ADJUSTMENT: 'Ajuste',
    EXPIRED: 'Expirado',
  }
  return labels[type] || type
}

function getMovementTypeClass(type: string) {
  const classes: Record<string, string> = {
    IN: 'bg-green-100 text-green-700',
    OUT: 'bg-red-100 text-red-700',
    ADJUSTMENT: 'bg-yellow-100 text-yellow-700',
    EXPIRED: 'bg-gray-100 text-gray-700',
  }
  return classes[type] || 'bg-gray-100 text-gray-700'
}

function getSummaryByType(type: string) {
  return movementSummary.value.find(s => s.type === type)
}

// Computed stats
const totalIn = computed(() => getSummaryByType('IN')?.totalQuantity || 0)
const totalOut = computed(() => getSummaryByType('OUT')?.totalQuantity || 0)

// Watchers
watch([dateRange, movementTypeFilter, itemFilter], () => {
  loadMovements()
  loadConsumption()
})

watch([customStartDate, customEndDate], () => {
  if (dateRange.value === 'custom') {
    loadMovements()
    loadConsumption()
  }
})

onMounted(() => {
  loadItems()
  loadData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex items-center gap-3">
        <button @click="router.push('/clinic/inventory')" class="p-2 hover:bg-surface-100 rounded-lg transition-colors">
          <ArrowLeftIcon class="w-5 h-5 text-surface-500" />
        </button>
        <div>
          <h1 class="text-2xl font-display font-bold text-surface-900">Analíticas de Stock</h1>
          <p class="text-surface-500">Movimientos, consumo y tendencias del inventario</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button @click="loadData" class="btn-secondary" :disabled="isLoading">
          <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': isLoading }" />
        </button>
        <button @click="exportToCSV" class="btn-primary">
          <ArrowDownTrayIcon class="w-5 h-5" />
          Exportar CSV
        </button>
      </div>
    </div>

    <!-- Filters Panel (Always Visible) -->
    <div class="card p-4">
      <div class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="label">Período</label>
          <select v-model="dateRange" class="input pr-10 cursor-pointer">
            <option value="today">Hoy</option>
            <option value="7days">Últimos 7 días</option>
            <option value="30days">Últimos 30 días</option>
            <option value="90days">Últimos 90 días</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        <div v-if="dateRange === 'custom'" class="flex gap-2">
          <div>
            <label class="label">Desde</label>
            <input v-model="customStartDate" type="date" class="input" />
          </div>
          <div>
            <label class="label">Hasta</label>
            <input v-model="customEndDate" type="date" class="input" />
          </div>
        </div>
        <div>
          <label class="label">Tipo de movimiento</label>
          <select v-model="movementTypeFilter" class="input pr-10 cursor-pointer">
            <option value="">Todos</option>
            <option value="IN">Entradas</option>
            <option value="OUT">Salidas</option>
            <option value="ADJUSTMENT">Ajustes</option>
            <option value="EXPIRED">Expirados</option>
          </select>
        </div>
        <div class="min-w-[250px] relative">
          <label class="label">Producto</label>
          <div ref="productInputRef" class="relative">
            <input
              v-model="itemSearch"
              @focus="openProductDropdown"
              type="text"
              :placeholder="selectedItemDisplay"
              class="input w-full pr-8"
              :class="{ 'bg-primary-50 border-primary-300': itemFilter }"
            />
            <button 
              v-if="itemFilter" 
              @click="clearItemFilter"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-200 rounded z-10"
            >
              <svg class="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Backdrop -->
          <Teleport to="body">
            <div 
              v-if="showItemDropdown" 
              @click="showItemDropdown = false" 
              class="fixed inset-0 z-40"
            ></div>
          </Teleport>
          <!-- Dropdown -->
          <Teleport to="body">
            <div 
              v-if="showItemDropdown" 
              class="fixed z-50 bg-white border border-surface-200 rounded-lg shadow-xl max-h-64 overflow-y-auto w-80"
              :style="dropdownStyle"
            >
              <button
                @click="selectItem('')"
                class="w-full px-3 py-2 text-left text-sm hover:bg-surface-50 flex items-center gap-2"
                :class="{ 'bg-primary-50 text-primary-700': !itemFilter }"
              >
                <CubeIcon class="w-4 h-4 text-surface-400" />
                Todos los productos
              </button>
              <div v-if="filteredItems.length === 0" class="px-3 py-2 text-sm text-surface-500">
                No se encontraron productos
              </div>
              <button
                v-for="item in filteredItems.slice(0, 50)"
                :key="item.id"
                @click="selectItem(item.id)"
                class="w-full px-3 py-2 text-left text-sm hover:bg-surface-50 flex items-center justify-between"
                :class="{ 'bg-primary-50 text-primary-700': itemFilter === item.id }"
              >
                <span class="truncate">{{ item.name }}</span>
                <span v-if="item.sku" class="text-xs text-surface-400 ml-2 flex-shrink-0">{{ item.sku }}</span>
              </button>
            </div>
          </Teleport>
        </div>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary-100 rounded-lg">
            <CubeIcon class="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <p class="text-sm text-surface-500">Total Productos</p>
            <p class="text-2xl font-bold text-surface-900">{{ summary?.totalItems || 0 }}</p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-100 rounded-lg">
            <ChartBarIcon class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p class="text-sm text-surface-500">Valor Inventario</p>
            <p class="text-2xl font-bold text-surface-900">{{ summary?.totalValue || '0' }}€</p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-green-100 rounded-lg">
            <ArrowTrendingUpIcon class="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p class="text-sm text-surface-500">Entradas</p>
            <p class="text-2xl font-bold text-green-600">+{{ totalIn }}</p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-red-100 rounded-lg">
            <ArrowTrendingDownIcon class="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p class="text-sm text-surface-500">Salidas</p>
            <p class="text-2xl font-bold text-red-600">-{{ totalOut }}</p>
          </div>
        </div>
      </div>

      <div class="card p-4" :class="{ 'ring-2 ring-amber-400': (summary?.lowStockCount || 0) > 0 }">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-amber-100 rounded-lg">
            <ExclamationTriangleIcon class="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p class="text-sm text-surface-500">Stock Bajo</p>
            <p class="text-2xl font-bold text-amber-600">{{ summary?.lowStockCount || 0 }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid lg:grid-cols-3 gap-6">
      <!-- Movements Table (2 cols) -->
      <div class="lg:col-span-2 card">
        <div class="p-4 border-b border-surface-200">
          <h2 class="font-semibold text-surface-900">Historial de Movimientos</h2>
          <p class="text-sm text-surface-500">{{ movements.length }} movimientos en el período</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-surface-50 text-left text-sm text-surface-500">
              <tr>
                <th class="p-3">Fecha</th>
                <th class="p-3">Producto</th>
                <th class="p-3">Tipo</th>
                <th class="p-3 text-right">Cantidad</th>
                <th class="p-3 text-right">Precio/ud</th>
                <th class="p-3 text-right">Stock</th>
                <th class="p-3">Usuario</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr v-for="m in movements.slice(0, 20)" :key="m.id" class="hover:bg-surface-50">
                <td class="p-3 text-sm text-surface-600 whitespace-nowrap">
                  {{ formatDateTime(m.createdAt) }}
                </td>
                <td class="p-3">
                  <p class="font-medium text-surface-900">{{ m.itemName }}</p>
                  <p v-if="m.reason" class="text-xs text-surface-500">{{ m.reason }}</p>
                </td>
                <td class="p-3">
                  <span :class="['px-2 py-1 rounded-full text-xs font-medium', getMovementTypeClass(m.type)]">
                    {{ getMovementTypeLabel(m.type) }}
                  </span>
                </td>
                <td class="p-3 text-right font-mono">
                  <span :class="m.type === 'IN' ? 'text-green-600' : 'text-red-600'">
                    {{ m.type === 'IN' ? '+' : '-' }}{{ m.quantity }}
                  </span>
                </td>
                <td class="p-3 text-right text-sm">
                  <span v-if="m.unitCost && m.type === 'IN'" class="text-surface-700">
                    {{ parseFloat(m.unitCost).toFixed(2) }}€
                  </span>
                  <span v-else class="text-surface-400">-</span>
                </td>
                <td class="p-3 text-right text-sm text-surface-500">
                  {{ m.previousStock }} → {{ m.newStock }}
                </td>
                <td class="p-3 text-sm text-surface-600">
                  <div class="flex items-center gap-1">
                    <UserIcon class="w-4 h-4" />
                    {{ m.performedBy || 'Sistema' }}
                  </div>
                </td>
              </tr>
              <tr v-if="movements.length === 0">
                <td colspan="7" class="p-8 text-center text-surface-500">
                  No hay movimientos en este período
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="movements.length > 20" class="p-3 text-center border-t border-surface-200">
          <p class="text-sm text-surface-500">Mostrando 20 de {{ movements.length }} movimientos. Exporta para ver todos.</p>
        </div>
      </div>

      <!-- Sidebar (1 col) -->
      <div class="space-y-6">
        <!-- Top Consumed -->
        <div class="card">
          <div class="p-4 border-b border-surface-200">
            <h3 class="font-semibold text-surface-900">Top Productos Consumidos</h3>
            <p class="text-sm text-surface-500">{{ consumption?.summary?.totalQuantity || 0 }} unidades totales</p>
          </div>
          <div class="divide-y divide-surface-100">
            <div v-for="item in (consumption?.items || []).slice(0, 5)" :key="item.itemId" class="p-3 flex justify-between items-center">
              <div>
                <p class="font-medium text-surface-900 text-sm">{{ item.itemName }}</p>
                <p class="text-xs text-surface-500">{{ item.usageCount }} usos</p>
              </div>
              <div class="text-right">
                <p class="font-bold text-surface-900">{{ item.totalQuantity }}</p>
                <p class="text-xs text-surface-500">{{ item.totalCost }}€</p>
              </div>
            </div>
            <div v-if="!consumption?.items?.length" class="p-4 text-center text-surface-500 text-sm">
              Sin consumo en este período
            </div>
          </div>
        </div>

        <!-- Alerts Section -->
        <div v-if="showAlerts && (lowStockItems.length > 0 || expiringItems.length > 0)" class="card">
          <div class="p-4 border-b border-surface-200 flex justify-between items-center">
            <h3 class="font-semibold text-surface-900">⚠️ Alertas</h3>
            <button @click="showAlerts = false" class="text-surface-400 hover:text-surface-600">
              <ChevronUpIcon class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Low Stock -->
          <div v-if="lowStockItems.length > 0" class="p-3 border-b border-surface-100">
            <p class="text-xs font-semibold text-amber-600 mb-2">Stock Bajo ({{ lowStockItems.length }})</p>
            <div class="space-y-2">
              <div v-for="item in lowStockItems.slice(0, 3)" :key="item.id" class="flex justify-between text-sm">
                <span class="text-surface-700">{{ item.name }}</span>
                <span class="text-amber-600 font-medium">{{ item.currentStock }}/{{ item.minStock }}</span>
              </div>
            </div>
          </div>

          <!-- Expiring -->
          <div v-if="expiringItems.length > 0" class="p-3">
            <p class="text-xs font-semibold text-red-600 mb-2">Próximos a Caducar ({{ expiringItems.length }})</p>
            <div class="space-y-2">
              <div v-for="item in expiringItems.slice(0, 3)" :key="item.id" class="flex justify-between text-sm">
                <span class="text-surface-700">{{ item.name }}</span>
                <span class="text-red-600 font-medium">{{ item.daysUntilExpiration }}d</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Category Value -->
        <div class="card">
          <div class="p-4 border-b border-surface-200">
            <h3 class="font-semibold text-surface-900">Valor por Categoría</h3>
          </div>
          <div class="divide-y divide-surface-100">
            <div v-for="cat in summary?.byCategory || []" :key="cat.category" class="p-3 flex justify-between items-center">
              <div>
                <p class="font-medium text-surface-900 text-sm">{{ cat.category }}</p>
                <p class="text-xs text-surface-500">{{ cat.count }} productos</p>
              </div>
              <p class="font-bold text-surface-900">{{ cat.totalValue }}€</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Patient Consumption (Collapsible) -->
    <div class="card">
      <button 
        @click="showPatientConsumption = !showPatientConsumption"
        class="w-full p-4 flex justify-between items-center hover:bg-surface-50 transition-colors"
      >
        <div>
          <h3 class="font-semibold text-surface-900 text-left">Consumo por Paciente</h3>
          <p class="text-sm text-surface-500">Análisis de materiales usados por paciente</p>
        </div>
        <component :is="showPatientConsumption ? ChevronUpIcon : ChevronDownIcon" class="w-5 h-5 text-surface-400" />
      </button>
      
      <Transition name="slide">
        <div v-if="showPatientConsumption" class="border-t border-surface-200">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-surface-50 text-left text-sm text-surface-500">
                <tr>
                  <th class="p-3">Paciente</th>
                  <th class="p-3 text-right">Citas</th>
                  <th class="p-3 text-right">Unidades</th>
                  <th class="p-3 text-right">Coste Material</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-surface-100">
                <tr v-for="p in patientConsumption.slice(0, 10)" :key="p.patientId" class="hover:bg-surface-50">
                  <td class="p-3 font-medium text-surface-900">{{ p.patientName }}</td>
                  <td class="p-3 text-right text-surface-600">{{ p.appointmentCount }}</td>
                  <td class="p-3 text-right text-surface-600">{{ p.totalQuantity }}</td>
                  <td class="p-3 text-right font-bold text-surface-900">{{ p.totalCost }}€</td>
                </tr>
                <tr v-if="patientConsumption.length === 0">
                  <td colspan="4" class="p-8 text-center text-surface-500">
                    Sin datos de consumo por paciente
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
