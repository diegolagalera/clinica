<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  UsersIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(false)

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: HomeIcon },
  { name: 'Organizaciones', href: '/admin/organizations', icon: BuildingOffice2Icon },
  { name: 'Clínicas', href: '/admin/clinics', icon: BuildingStorefrontIcon },
  { name: 'Usuarios', href: '/admin/users', icon: UsersIcon },
]

const isActiveRoute = (href: string) => {
  return route.path.startsWith(href)
}
</script>

<template>
  <div class="min-h-screen bg-surface-50">
    <!-- Mobile sidebar backdrop -->
    <div 
      v-if="sidebarOpen" 
      class="fixed inset-0 z-40 bg-surface-900/50 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside 
      :class="[
        'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-surface-200 transform transition-transform duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      ]"
    >
      <!-- Logo -->
      <div class="flex items-center gap-3 px-6 h-16 border-b border-surface-200">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <h1 class="font-display font-bold text-surface-900">DentalERP</h1>
          <p class="text-xs text-surface-500">Super Admin</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="p-4 space-y-1">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          :class="[
            isActiveRoute(item.href) ? 'nav-item-active' : 'nav-item-inactive'
          ]"
        >
          <component :is="item.icon" class="w-5 h-5" />
          {{ item.name }}
        </RouterLink>
      </nav>

      <!-- User section -->
      <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-surface-200">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
            {{ authStore.user?.firstName?.charAt(0) }}{{ authStore.user?.lastName?.charAt(0) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-surface-900 truncate">{{ authStore.fullName }}</p>
            <p class="text-xs text-surface-500 truncate">{{ authStore.user?.email }}</p>
          </div>
        </div>
        <button 
          @click="authStore.logout()" 
          class="btn-ghost w-full justify-start text-danger-600 hover:bg-danger-50"
        >
          <ArrowRightOnRectangleIcon class="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <div class="lg:pl-64">
      <!-- Top bar -->
      <header class="sticky top-0 z-30 flex items-center h-16 px-4 bg-white/80 backdrop-blur-lg border-b border-surface-200">
        <button 
          @click="sidebarOpen = true" 
          class="lg:hidden p-2 -ml-2 text-surface-500 hover:text-surface-700"
        >
          <Bars3Icon class="w-6 h-6" />
        </button>
        
        <div class="flex-1" />
        
        <!-- Right side actions can go here -->
      </header>

      <!-- Page content -->
      <main class="p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
