<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  HomeIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  CreditCardIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(false)

const navigation = [
  { name: 'Inicio', href: '/patient/dashboard', icon: HomeIcon },
  { name: 'Mis Citas', href: '/patient/appointments', icon: CalendarDaysIcon },
  { name: 'Historial', href: '/patient/records', icon: DocumentTextIcon },
  { name: 'Facturas', href: '/patient/invoices', icon: CreditCardIcon },
  { name: 'Mi Perfil', href: '/patient/profile', icon: UserIcon },
]

const isActiveRoute = (href: string) => {
  return route.path.startsWith(href)
}
</script>

<template>
  <div class="min-h-screen bg-surface-50">
    <!-- Mobile header -->
    <header class="lg:hidden sticky top-0 z-30 flex items-center h-16 px-4 bg-white border-b border-surface-200">
      <button 
        @click="sidebarOpen = !sidebarOpen" 
        class="p-2 -ml-2 text-surface-500 hover:text-surface-700"
      >
        <Bars3Icon class="w-6 h-6" />
      </button>
      <div class="flex items-center gap-2 ml-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <span class="font-display font-bold text-surface-900">DentalERP</span>
      </div>
    </header>

    <!-- Mobile sidebar -->
    <div 
      v-if="sidebarOpen" 
      class="fixed inset-0 z-40 lg:hidden"
    >
      <div class="fixed inset-0 bg-surface-900/50" @click="sidebarOpen = false" />
      <div class="fixed inset-y-0 left-0 w-64 bg-white">
        <div class="flex flex-col h-full">
          <div class="flex items-center gap-3 px-6 h-16 border-b border-surface-200">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h1 class="font-display font-bold text-surface-900">DentalERP</h1>
              <p class="text-xs text-surface-500">Portal del Paciente</p>
            </div>
          </div>
          
          <nav class="flex-1 p-4 space-y-1">
            <RouterLink
              v-for="item in navigation"
              :key="item.name"
              :to="item.href"
              :class="[isActiveRoute(item.href) ? 'nav-item-active' : 'nav-item-inactive']"
              @click="sidebarOpen = false"
            >
              <component :is="item.icon" class="w-5 h-5" />
              {{ item.name }}
            </RouterLink>
          </nav>
          
          <div class="p-4 border-t border-surface-200">
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
        </div>
      </div>
    </div>

    <!-- Desktop layout with bottom navigation on mobile -->
    <div class="lg:flex">
      <!-- Desktop sidebar -->
      <aside class="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-surface-200">
        <div class="flex items-center gap-3 px-6 h-16 border-b border-surface-200">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 class="font-display font-bold text-surface-900">DentalERP</h1>
            <p class="text-xs text-surface-500">Portal del Paciente</p>
          </div>
        </div>
        
        <nav class="flex-1 p-4 space-y-1">
          <RouterLink
            v-for="item in navigation"
            :key="item.name"
            :to="item.href"
            :class="[isActiveRoute(item.href) ? 'nav-item-active' : 'nav-item-inactive']"
          >
            <component :is="item.icon" class="w-5 h-5" />
            {{ item.name }}
          </RouterLink>
        </nav>
        
        <div class="p-4 border-t border-surface-200">
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
      <main class="flex-1 lg:ml-64 pb-20 lg:pb-6">
        <div class="p-4 lg:p-6">
          <RouterView />
        </div>
      </main>
    </div>

    <!-- Mobile bottom navigation -->
    <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 px-2 py-2 z-30">
      <div class="flex items-center justify-around">
        <RouterLink
          v-for="item in navigation.slice(0, 5)"
          :key="item.name"
          :to="item.href"
          :class="[
            'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors',
            isActiveRoute(item.href) ? 'text-primary-600' : 'text-surface-500'
          ]"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span class="text-[10px] font-medium">{{ item.name }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
