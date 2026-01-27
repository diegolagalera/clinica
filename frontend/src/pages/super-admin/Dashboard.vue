<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/services/api'
import type { Organization, ApiResponse, PaginatedResponse } from '@/types'
import {
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  ChartBarIcon,
} from '@heroicons/vue/24/outline'

// State
const stats = ref({
  totalOrganizations: 0,
  totalClinics: 0,
  totalUsers: 0,
  activeOrganizations: 0,
})
const recentOrganizations = ref<Organization[]>([])
const isLoading = ref(true)

// Load dashboard data
const loadDashboard = async () => {
  isLoading.value = true
  
  try {
    // Load organizations
    const orgsResponse = await api.get<ApiResponse<PaginatedResponse<Organization>>>('/organizations?limit=5')
    if (orgsResponse.success && orgsResponse.data) {
      recentOrganizations.value = orgsResponse.data.data
      stats.value.totalOrganizations = orgsResponse.data.pagination.total
      stats.value.activeOrganizations = orgsResponse.data.data.filter(o => o.isActive).length
    }
    
    // Load clinics count
    const clinicsResponse = await api.get<ApiResponse<{ pagination: { total: number } }>>('/clinics?limit=1')
    if (clinicsResponse.success && clinicsResponse.data) {
      stats.value.totalClinics = clinicsResponse.data.pagination.total
    }
  } catch (err) {
    console.error('Error loading dashboard:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-display font-bold text-surface-900">Dashboard</h1>
      <p class="text-surface-500 mt-1">Vista general de la plataforma</p>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-xl bg-primary-100">
            <BuildingOffice2Icon class="w-5 h-5 text-primary-600" />
          </div>
        </div>
        <p class="stat-value">{{ stats.totalOrganizations }}</p>
        <p class="stat-label">Organizaciones</p>
      </div>
      
      <div class="stat-card">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-xl bg-accent-100">
            <BuildingStorefrontIcon class="w-5 h-5 text-accent-600" />
          </div>
        </div>
        <p class="stat-value">{{ stats.totalClinics }}</p>
        <p class="stat-label">Clínicas</p>
      </div>
      
      <div class="stat-card">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-xl bg-success-100">
            <UserGroupIcon class="w-5 h-5 text-success-600" />
          </div>
        </div>
        <p class="stat-value">{{ stats.totalUsers }}</p>
        <p class="stat-label">Usuarios</p>
      </div>
      
      <div class="stat-card">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-xl bg-warning-100">
            <ChartBarIcon class="w-5 h-5 text-warning-600" />
          </div>
        </div>
        <p class="stat-value">{{ stats.activeOrganizations }}</p>
        <p class="stat-label">Orgs Activas</p>
      </div>
    </div>

    <!-- Recent organizations -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h2 class="font-semibold text-surface-900">Organizaciones Recientes</h2>
        <RouterLink to="/admin/organizations" class="text-primary-600 text-sm hover:underline">
          Ver todas
        </RouterLink>
      </div>
      
      <div v-if="isLoading" class="p-8 text-center">
        <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
      </div>
      
      <div v-else class="table-container border-0">
        <table class="table">
          <thead>
            <tr>
              <th>Organización</th>
              <th>Email</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-100">
            <tr v-for="org in recentOrganizations" :key="org.id">
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
              <td>
                <span :class="org.isActive ? 'badge-success' : 'badge-neutral'">
                  {{ org.isActive ? 'Activa' : 'Inactiva' }}
                </span>
              </td>
              <td class="text-right">
                <RouterLink 
                  :to="`/admin/organizations/${org.id}`"
                  class="btn-secondary btn-sm"
                >
                  Ver
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
