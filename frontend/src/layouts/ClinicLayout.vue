<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useActiveAppointmentsStore } from '@/stores/activeAppointments'
import { connectWebSocket, disconnectWebSocket } from '@/services/websocket'
import ActiveAppointmentChips from '@/components/ActiveAppointmentChips.vue'
import AssistantChat from '@/components/AssistantChat.vue'
import ReportBugModal from '@/components/ReportBugModal.vue'
import PhoneCountrySelect from '@/components/PhoneCountrySelect.vue'
import SignaturePad from '@/components/SignaturePad.vue'
import {
  HomeIcon,
  UsersIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  CubeIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronDownIcon,
  BuildingStorefrontIcon,
  StarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EnvelopeIcon,
  PencilIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()
const activeAppointmentsStore = useActiveAppointmentsStore()
const route = useRoute()
const sidebarOpen = ref(false)
const clinicMenuOpen = ref(false)
const clinicMenuRef = ref<HTMLDivElement | null>(null)

// Handle clinic change - redirect to dashboard and reload
const handleClinicChange = (clinicId: string) => {
  if (clinicId === authStore.currentClinicId) {
    clinicMenuOpen.value = false
    return
  }
  authStore.selectClinic(clinicId)
  clinicMenuOpen.value = false
  // Navigate to dashboard and reload to refresh all data with new clinic context
  window.location.href = '/clinic/dashboard'
}

// Click outside handler for clinic menu
const handleClickOutside = (event: MouseEvent) => {
  if (clinicMenuOpen.value && clinicMenuRef.value && !clinicMenuRef.value.contains(event.target as Node)) {
    clinicMenuOpen.value = false
  }
}

// Sidebar collapsed state (persisted)
const sidebarCollapsed = ref(false)

// Load collapsed state from localStorage
onMounted(() => {
  // Initialize WebSocket connection with JWT token
  const token = authStore.accessToken
  if (token) {
    connectWebSocket(token)
  }
  
  activeAppointmentsStore.startPolling()
  const saved = localStorage.getItem('sidebarCollapsed')
  if (saved !== null) {
    sidebarCollapsed.value = saved === 'true'
  }
  document.addEventListener('click', handleClickOutside)
})

// Stop polling when layout unmounts
onUnmounted(() => {
  activeAppointmentsStore.stopPolling()
  disconnectWebSocket()
  document.removeEventListener('click', handleClickOutside)
})

// Toggle sidebar and persist
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed.value))
}

const navigation = computed(() => {
  const allNav = [
    { name: 'Dashboard', href: '/clinic/dashboard', icon: HomeIcon, permission: null, disabled: false },
    { name: 'Agenda', href: '/clinic/calendar', icon: CalendarDaysIcon, permission: null, disabled: false },
    { name: 'Pacientes', href: '/clinic/patients', icon: UserGroupIcon, permission: null, disabled: false },
    { name: 'Inventario', href: '/clinic/inventory', icon: CubeIcon, permission: 'stock' as const, disabled: false },
    { name: 'Personal', href: '/clinic/staff', icon: UsersIcon, permission: 'staff' as const, disabled: false },
    { name: 'Marketing', href: '/clinic/marketing', icon: EnvelopeIcon, permission: 'marketing' as const, disabled: true },
    { name: 'WhatsApp', href: '/clinic/whatsapp', icon: ChatBubbleLeftRightIcon, permission: 'whatsapp' as const, disabled: false },
    { name: 'Valoraciones', href: '/clinic/ratings', icon: StarIcon, permission: 'ratings' as const, disabled: false },
    { name: 'Configuración', href: '/clinic/settings', icon: Cog6ToothIcon, permission: 'settings' as const, disabled: false },
  ]

  // Filter: show items that have no permission requirement OR the user has the permission
  return allNav.filter(item => !item.permission || authStore.hasPermission(item.permission))
})

const isActiveRoute = (href: string) => {
  return route.path.startsWith(href)
}

// Sidebar width computed
const sidebarWidth = computed(() => sidebarCollapsed.value ? 'w-16' : 'w-64')
const contentMargin = computed(() => sidebarCollapsed.value ? 'lg:pl-16' : 'lg:pl-64')
const notchMargin = computed(() => sidebarCollapsed.value ? 'lg:left-16' : 'lg:left-64')

// Profile edit modal
const showProfileModal = ref(false)
const profileTab = ref<'info' | 'password' | 'signature'>('info')
const isSavingProfile = ref(false)
// Signature state
const signatureImage = ref<string | null>(null)
const isSavingSignature = ref(false)

// Country codes list (most common for Spain market)
const countryCodes = [
  { code: '+34', country: 'ES', name: 'España', flag: '🇪🇸' },
  { code: '+33', country: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: '+351', country: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: '+44', country: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  { code: '+49', country: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: '+39', country: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: '+212', country: 'MA', name: 'Marruecos', flag: '🇲🇦' },
  { code: '+52', country: 'MX', name: 'México', flag: '🇲🇽' },
  { code: '+54', country: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: '+57', country: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: '+1', country: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+55', country: 'BR', name: 'Brasil', flag: '🇧🇷' },
]

const profileForm = ref({
  firstName: '',
  lastName: '',
  phoneCountry: '+34',
  phoneNumber: '',
  licenseNumber: '',
  specialty: '',
})
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const passwordError = ref('')

// Import api and toast
import { api } from '@/services/api'
import { useToast } from '@/composables/useToast'
const toast = useToast()

// Open profile modal
const openProfileModal = () => {
  // Parse phone number to extract country code
  let phoneCountry = '+34'
  let phoneNumber = ''
  const phone = authStore.user?.phone
  if (phone) {
    const matchedCountry = countryCodes.find(c => phone.startsWith(c.code))
    if (matchedCountry) {
      phoneCountry = matchedCountry.code
      phoneNumber = phone.slice(matchedCountry.code.length)
    } else {
      phoneNumber = phone.replace(/^\+/, '')
    }
  }
  
  profileForm.value = {
    firstName: authStore.user?.firstName || '',
    lastName: authStore.user?.lastName || '',
    phoneCountry,
    phoneNumber,
    licenseNumber: '',
    specialty: '',
  }
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
  passwordError.value = ''
  profileTab.value = 'info'
  showProfileModal.value = true
  // Load staff profile in background
  loadStaffProfile()
}

// Load staff profile (signature + license + specialty)
const loadStaffProfile = async () => {
  try {
    const res = await api.get<any>('/staff/me')
    const data = (res as any).data
    signatureImage.value = data?.signatureImage || null
    profileForm.value.licenseNumber = data?.licenseNumber || ''
    profileForm.value.specialty = data?.specialty || ''
  } catch {
    // Non-blocking
  }
}

// Save signature
const saveSignature = async (dataUrl: string) => {
  isSavingSignature.value = true
  try {
    await api.put('/staff/profile', { signatureImage: dataUrl })
    signatureImage.value = dataUrl
    toast.success('Firma guardada correctamente')
  } catch {
    toast.error('Error al guardar la firma')
  } finally {
    isSavingSignature.value = false
  }
}

// Save profile info
const saveProfileInfo = async () => {
  isSavingProfile.value = true
  try {
    // Combine phone in E.164 format
    const phone = profileForm.value.phoneNumber 
      ? `${profileForm.value.phoneCountry}${profileForm.value.phoneNumber.replace(/\D/g, '')}`
      : ''
    
    await api.put('/auth/me', {
      firstName: profileForm.value.firstName,
      lastName: profileForm.value.lastName,
      phone,
    })
    // Save staff profile fields (licenseNumber, specialty)
    await api.put('/staff/profile', {
      licenseNumber: profileForm.value.licenseNumber || undefined,
      specialty: profileForm.value.specialty || undefined,
    })
    // Update local auth store
    if (authStore.user) {
      authStore.user.firstName = profileForm.value.firstName
      authStore.user.lastName = profileForm.value.lastName
      authStore.user.phone = phone
      authStore.persistUser()
    }
    toast.success('Perfil actualizado')
    showProfileModal.value = false
  } catch (err: any) {
    toast.error(err.message || 'Error al actualizar perfil')
  } finally {
    isSavingProfile.value = false
  }
}

// Change password
const changePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = 'Las contraseñas no coinciden'
    return
  }
  if (passwordForm.value.newPassword.length < 8) {
    passwordError.value = 'La nueva contraseña debe tener al menos 8 caracteres'
    return
  }
  passwordError.value = ''
  isSavingProfile.value = true
  try {
    await api.put('/auth/change-password', {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    })
    toast.success('Contraseña cambiada correctamente')
    showProfileModal.value = false
  } catch (err: any) {
    passwordError.value = err.message || 'Error al cambiar contraseña'
  } finally {
    isSavingProfile.value = false
  }
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
        'fixed inset-y-0 left-0 z-50 bg-white border-r border-surface-200 transform transition-all duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full',
        sidebarWidth
      ]"
    >
      <!-- Logo & Clinic Selector -->
      <div class="flex items-center gap-3 px-4 h-16 border-b border-surface-200">
        <img 
          src="@/assets/img/logo.png" 
          alt="CUSPIA-ERP" 
          class="w-12 h-12 rounded-2xl object-cover flex-shrink-0 shadow-lg ring-2 ring-primary-100"
        />
        <div v-if="!sidebarCollapsed" class="flex-1 min-w-0">
          <h1 class="font-display font-bold text-surface-900 truncate">CUSPIA-ERP</h1>
          
          <!-- Clinic selector for Admin with multiple clinics -->
          <div v-if="authStore.availableClinics.length > 1" class="relative" ref="clinicMenuRef">
            <button 
              @click.stop="clinicMenuOpen = !clinicMenuOpen"
              class="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700"
            >
              <BuildingStorefrontIcon class="w-3 h-3" />
              <span class="truncate">{{ authStore.currentClinic?.name || 'Seleccionar clínica' }}</span>
              <ChevronDownIcon class="w-3 h-3" />
            </button>
            
            <!-- Dropdown -->
            <div 
              v-if="clinicMenuOpen"
              class="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-surface-200 py-1 z-50"
            >
              <button
                v-for="clinic in authStore.availableClinics"
                :key="clinic.id"
                @click="handleClinicChange(clinic.id)"
                :class="[
                  'w-full px-3 py-2 text-left text-sm hover:bg-surface-50',
                  clinic.id === authStore.currentClinicId ? 'bg-primary-50 text-primary-700' : 'text-surface-700'
                ]"
              >
                {{ clinic.name }}
              </button>
            </div>
          </div>
          <p v-else class="text-xs text-surface-500 truncate">
            {{ authStore.currentClinic?.name || 'Panel de Clínica' }}
          </p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="p-2 space-y-1 overflow-y-auto" style="max-height: calc(100vh - 180px);">
        <template v-for="item in navigation" :key="item.name">
          <!-- Disabled item -->
          <div
            v-if="item.disabled"
            :class="[
              'nav-item-inactive opacity-50 cursor-not-allowed',
              sidebarCollapsed ? 'justify-center px-2' : ''
            ]"
            :title="sidebarCollapsed ? `${item.name} (Próximamente)` : undefined"
          >
            <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span v-if="!sidebarCollapsed">{{ item.name }}</span>
            <span v-if="!sidebarCollapsed" class="ml-auto text-[9px] font-semibold text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full">Próximamente</span>
          </div>
          <!-- Normal item -->
          <RouterLink
            v-else
            :to="item.href"
            :class="[
              isActiveRoute(item.href) ? 'nav-item-active' : 'nav-item-inactive',
              sidebarCollapsed ? 'justify-center px-2' : ''
            ]"
            :title="sidebarCollapsed ? item.name : undefined"
          >
            <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span v-if="!sidebarCollapsed">{{ item.name }}</span>
            <span v-if="item.permission && !sidebarCollapsed" class="ml-auto badge badge-primary text-[10px]">Pro</span>
          </RouterLink>
        </template>
      </nav>

      <!-- Collapse toggle button (desktop only) -->
      <button
        @click="toggleSidebar"
        class="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-white border border-surface-200 rounded-full items-center justify-center shadow-sm hover:bg-surface-50 transition-colors z-50"
        :title="sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'"
      >
        <component :is="sidebarCollapsed ? ChevronRightIcon : ChevronLeftIcon" class="w-4 h-4 text-surface-500" />
      </button>

      <!-- User section -->
      <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-surface-200 bg-white">
        <div v-if="!sidebarCollapsed" class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold flex-shrink-0">
            {{ authStore.user?.firstName?.charAt(0) }}{{ authStore.user?.lastName?.charAt(0) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-surface-900 truncate">{{ authStore.fullName }}</p>
            <p class="text-xs text-surface-500">{{ authStore.isAdmin ? 'Administrador' : 'Trabajador' }}</p>
          </div>
          <!-- Edit profile button -->
          <button 
            @click="openProfileModal"
            class="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
            title="Editar perfil"
          >
            <PencilIcon class="w-4 h-4 text-surface-500" />
          </button>
        </div>
        <div v-else class="flex flex-col items-center gap-2 mb-3">
          <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
            {{ authStore.user?.firstName?.charAt(0) }}{{ authStore.user?.lastName?.charAt(0) }}
          </div>
          <!-- Edit profile button (collapsed) -->
          <button 
            @click="openProfileModal"
            class="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
            title="Editar perfil"
          >
            <PencilIcon class="w-4 h-4 text-surface-500" />
          </button>
        </div>
        <!-- Assistant Chat Button -->
        <div class="mb-3">
          <AssistantChat :collapsed="sidebarCollapsed" />
        </div>
        
        <!-- Report Bug Button -->
        <div class="mb-3">
          <ReportBugModal :collapsed="sidebarCollapsed" />
        </div>

        <button 
          @click="authStore.logout()" 
          :class="[
            'btn-ghost w-full text-danger-600 hover:bg-danger-50',
            sidebarCollapsed ? 'justify-center px-2' : 'justify-start'
          ]"
          :title="sidebarCollapsed ? 'Cerrar Sesión' : undefined"
        >
          <ArrowRightOnRectangleIcon class="w-5 h-5" />
          <span v-if="!sidebarCollapsed">Cerrar Sesión</span>
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <div :class="contentMargin" class="transition-all duration-200">
      <!-- Notch container - centered floating above content -->
      <div :class="['fixed top-0 left-0 right-0 z-40 flex justify-center pointer-events-none transition-all duration-200', notchMargin]">
        <ActiveAppointmentChips class="pointer-events-auto" />
      </div>

      <!-- Top bar (mobile only) -->
      <header class="lg:hidden sticky top-0 z-30 flex items-center h-16 px-4 bg-white/80 backdrop-blur-lg border-b border-surface-200">
        <button 
          @click="sidebarOpen = true" 
          class="p-2 -ml-2 text-surface-500 hover:text-surface-700"
        >
          <Bars3Icon class="w-6 h-6" />
        </button>
      </header>

      <!-- Page content -->
      <main class="p-6 pt-8">
        <RouterView />
      </main>
    </div>

    <!-- Profile Edit Modal -->
    <Teleport to="body">
      <div 
        v-if="showProfileModal" 
        class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
        @click.self="showProfileModal = false"
      >
        <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-surface-200">
            <h3 class="text-lg font-semibold text-surface-900">Editar Perfil</h3>
            <button @click="showProfileModal = false" class="p-1 hover:bg-surface-100 rounded-lg">
              <svg class="w-5 h-5 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="flex border-b border-surface-200">
            <button 
              @click="profileTab = 'info'"
              :class="['flex-1 py-3 text-sm font-medium transition-colors', profileTab === 'info' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-surface-500 hover:text-surface-700']"
            >
              Información
            </button>
            <button 
              @click="profileTab = 'password'"
              :class="['flex-1 py-3 text-sm font-medium transition-colors', profileTab === 'password' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-surface-500 hover:text-surface-700']"
            >
              Contraseña
            </button>
            <button 
              @click="profileTab = 'signature'"
              :class="['flex-1 py-3 text-sm font-medium transition-colors', profileTab === 'signature' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-surface-500 hover:text-surface-700']"
            >
              Firma
            </button>
          </div>

          <!-- Tab Content -->
          <div class="p-4">
            <!-- Info Tab -->
            <form v-if="profileTab === 'info'" @submit.prevent="saveProfileInfo" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Nombre</label>
                <input 
                  v-model="profileForm.firstName"
                  type="text"
                  class="input w-full"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Apellido</label>
                <input 
                  v-model="profileForm.lastName"
                  type="text"
                  class="input w-full"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Teléfono</label>
                <div class="flex gap-2">
                  <PhoneCountrySelect v-model="profileForm.phoneCountry" />
                  <input 
                    v-model="profileForm.phoneNumber"
                    type="tel"
                    class="input flex-1"
                    placeholder="666555444"
                    @input="profileForm.phoneNumber = profileForm.phoneNumber.replace(/\D/g, '')"
                  />
                </div>
                <p class="text-xs text-surface-400 mt-1">Solo números, sin espacios</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Nº Colegiado</label>
                <input 
                  v-model="profileForm.licenseNumber"
                  type="text"
                  class="input w-full"
                  placeholder="Ej: 28/12345"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Especialidad</label>
                <input 
                  v-model="profileForm.specialty"
                  type="text"
                  class="input w-full"
                  placeholder="Ej: Odontología General"
                />
              </div>
              <div class="flex gap-3 pt-2">
                <button type="button" @click="showProfileModal = false" class="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" class="btn-primary flex-1" :disabled="isSavingProfile">
                  {{ isSavingProfile ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </form>

            <!-- Password Tab -->
            <form v-else-if="profileTab === 'password'" @submit.prevent="changePassword" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Contraseña actual</label>
                <input 
                  v-model="passwordForm.currentPassword"
                  type="password"
                  class="input w-full"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Nueva contraseña</label>
                <input 
                  v-model="passwordForm.newPassword"
                  type="password"
                  class="input w-full"
                  required
                  minlength="8"
                />
                <p class="text-xs text-surface-500 mt-1">Mínimo 8 caracteres</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1">Confirmar contraseña</label>
                <input 
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  class="input w-full"
                  required
                />
              </div>
              <p v-if="passwordError" class="text-sm text-danger-600">{{ passwordError }}</p>
              <div class="flex gap-3 pt-2">
                <button type="button" @click="showProfileModal = false" class="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" class="btn-primary flex-1" :disabled="isSavingProfile">
                  {{ isSavingProfile ? 'Cambiando...' : 'Cambiar Contraseña' }}
                </button>
              </div>
            </form>

            <!-- Signature Tab -->
            <div v-else-if="profileTab === 'signature'" class="space-y-4">
              <p class="text-sm text-surface-500">Tu firma se incluirá automáticamente en las recetas médicas generadas.</p>
              <div v-if="isSavingSignature" class="flex items-center justify-center py-8">
                <svg class="animate-spin h-6 w-6 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <SignaturePad
                v-else
                :modelValue="signatureImage"
                @update:modelValue="saveSignature"
              />
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

