<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import type { ApiResponse } from '@/types'
import {
  BuildingOffice2Icon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline'

interface Tenant {
  id: string
  name: string
  slug: string
  isActive: boolean
  plan: string
  maxClinics: number
  contactEmail: string | null
  createdAt: string
}

const router = useRouter()
const authStore = useAuthStore()

const tenants = ref<Tenant[]>([])
const isLoading = ref(true)
const search = ref('')
const error = ref('')

const filteredTenants = computed(() => {
  if (!search.value) return tenants.value
  const q = search.value.toLowerCase()
  return tenants.value.filter(
    t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
  )
})

import { computed } from 'vue'

const loadTenants = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const response = await api.get<ApiResponse<Tenant[]>>('/admin/tenants')
    if (response.success && response.data) {
      tenants.value = response.data
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error al cargar empresas'
  } finally {
    isLoading.value = false
  }
}

const selectTenant = (tenant: Tenant) => {
  authStore.setTenantSlug(tenant.slug)
  router.push('/admin/dashboard')
}

onMounted(() => {
  loadTenants()
})
</script>

<template>
  <div class="min-h-screen bg-surface-50 flex flex-col">
    <!-- Top bar -->
    <header class="bg-white border-b border-surface-200 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img
          src="@/assets/img/logo.png"
          alt="CUSPIA"
          class="w-10 h-10 rounded-xl object-cover shadow-sm ring-1 ring-surface-200"
        />
        <div>
          <h1 class="font-display font-bold text-surface-900">CUSPIA Platform</h1>
          <p class="text-xs text-surface-500">Panel de Super Administrador</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-surface-600">{{ authStore.user?.email }}</span>
        <button
          @click="authStore.logout()"
          class="btn-ghost text-danger-600 hover:bg-danger-50 flex items-center gap-2 text-sm"
        >
          <ArrowRightOnRectangleIcon class="w-4 h-4" />
          Salir
        </button>
      </div>
    </header>

    <!-- Main -->
    <main class="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BuildingOffice2Icon class="w-8 h-8 text-primary-600" />
        </div>
        <h2 class="text-2xl font-display font-bold text-surface-900">Selecciona una empresa</h2>
        <p class="text-surface-500 mt-1">
          Elige la empresa que quieres gestionar como Super Administrador
        </p>
      </div>

      <!-- Search -->
      <div class="relative max-w-md mx-auto mb-6">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <input
          v-model="search"
          type="text"
          placeholder="Buscar empresa..."
          class="input pl-10"
        />
      </div>

      <!-- Error -->
      <div v-if="error" class="p-4 rounded-xl bg-danger-50 text-danger-600 text-sm text-center mb-6">
        {{ error }}
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="flex justify-center py-12">
        <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredTenants.length === 0 && !error" class="text-center py-12">
        <BuildingOffice2Icon class="w-12 h-12 text-surface-300 mx-auto mb-3" />
        <p class="text-surface-500">
          {{ search ? 'No se encontraron empresas' : 'No hay empresas registradas' }}
        </p>
        <p class="text-surface-400 text-sm mt-1">
          Usa <code class="bg-surface-100 px-1 rounded">npm run tenant:provision</code> para crear una
        </p>
      </div>

      <!-- Tenant grid -->
      <div v-else class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="tenant in filteredTenants"
          :key="tenant.id"
          @click="selectTenant(tenant)"
          :disabled="!tenant.isActive"
          class="flex items-center gap-4 p-5 rounded-xl border border-surface-200 bg-white
                 hover:border-primary-300 hover:shadow-md hover:shadow-primary-100/50
                 transition-all duration-200 text-left group
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-surface-200 disabled:hover:shadow-none"
        >
          <div class="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600
                      rounded-xl flex items-center justify-center text-white font-bold text-lg
                      group-hover:shadow-lg group-hover:shadow-primary-200 transition-shadow shrink-0">
            {{ tenant.name.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-surface-900 group-hover:text-primary-700 transition-colors truncate">
              {{ tenant.name }}
            </div>
            <div class="text-xs text-surface-500 mt-0.5 flex items-center gap-2">
              <span>{{ tenant.slug }}</span>
              <span class="inline-block w-1 h-1 rounded-full bg-surface-300"></span>
              <span class="capitalize">{{ tenant.plan }}</span>
            </div>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span
              :class="tenant.isActive ? 'badge-success' : 'badge-neutral'"
              class="text-xs"
            >
              {{ tenant.isActive ? 'Activa' : 'Inactiva' }}
            </span>
            <svg class="w-5 h-5 text-surface-300 group-hover:text-primary-500 transition-colors"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>
    </main>
  </div>
</template>
