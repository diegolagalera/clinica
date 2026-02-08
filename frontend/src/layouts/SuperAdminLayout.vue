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
        <img 
          src="@/assets/img/logo.png" 
          alt="CUSPIA-ERP" 
          class="w-12 h-12 rounded-2xl object-cover shadow-lg ring-2 ring-primary-100"
        />
        <div>
          <h1 class="font-display font-bold text-surface-900">CUSPIA-ERP</h1>
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
