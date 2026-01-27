<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()

// State
const invoices = ref<any[]>([])
const isLoading = ref(true)

// Load invoices
const loadInvoices = async () => {
  isLoading.value = true
  
  try {
    // In a real implementation, this would call patient-specific endpoints
    invoices.value = []
  } catch (err) {
    console.error('Error loading invoices:', err)
  } finally {
    isLoading.value = false
  }
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'PAID': return 'badge-success'
    case 'PENDING': return 'badge-warning'
    case 'OVERDUE': return 'badge-danger'
    default: return 'badge-neutral'
  }
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    DRAFT: 'Borrador',
    PENDING: 'Pendiente',
    PAID: 'Pagada',
    OVERDUE: 'Vencida',
    CANCELLED: 'Cancelada',
  }
  return labels[status] || status
}

onMounted(() => {
  loadInvoices()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-display font-bold text-surface-900">Facturas</h1>
      <p class="text-surface-500 mt-1">Consulta tus facturas y pagos</p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- Invoices list -->
    <div v-else-if="invoices.length > 0" class="space-y-4">
      <div 
        v-for="invoice in invoices" 
        :key="invoice.id"
        class="card p-4"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center flex-shrink-0">
            <DocumentTextIcon class="w-5 h-5 text-surface-600" />
          </div>
          <div class="flex-1">
            <p class="font-medium text-surface-900">Factura #{{ invoice.number }}</p>
            <p class="text-sm text-surface-500">{{ invoice.date }}</p>
          </div>
          <div class="text-right">
            <p class="font-semibold text-surface-900">{{ invoice.total }}€</p>
            <span :class="getStatusClass(invoice.status)">
              {{ getStatusLabel(invoice.status) }}
            </span>
          </div>
          <button class="btn-ghost btn-sm">
            <ArrowDownTrayIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card p-12 text-center">
      <DocumentTextIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
      <h3 class="text-lg font-medium text-surface-900 mb-2">No hay facturas</h3>
      <p class="text-surface-500">Tus facturas aparecerán aquí</p>
    </div>
  </div>
</template>
