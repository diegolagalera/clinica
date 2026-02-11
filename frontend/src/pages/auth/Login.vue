<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { EyeIcon, EyeSlashIcon, BuildingOffice2Icon, ArrowLeftIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const twoFactorCode = ref('')
const showPassword = ref(false)
const error = ref('')
const isLoading = ref(false)

const show2FA = computed(() => authStore.requires2FA)
const showTenantSelector = computed(() => authStore.requiresTenantSelection)

const handleLogin = async () => {
  error.value = ''
  isLoading.value = true

  try {
    const result = await authStore.login(email.value, password.value)
    
    if (result?.requiresTenantSelection) {
      // Tenant selector will be shown automatically via computed
      return
    }

    if (result?.success) {
      navigateAfterLogin()
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Error al iniciar sesión'
  } finally {
    isLoading.value = false
  }
}

const handleTenantSelect = async (slug: string) => {
  error.value = ''
  isLoading.value = true

  try {
    const result = await authStore.loginWithTenant(slug)

    if (result?.success) {
      navigateAfterLogin()
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Error al iniciar sesión'
  } finally {
    isLoading.value = false
  }
}

const handle2FA = async () => {
  error.value = ''
  isLoading.value = true

  try {
    const result = await authStore.verify2FA(twoFactorCode.value)
    
    if (result?.success) {
      const redirect = route.query.redirect as string
      router.push(redirect || '/clinic/dashboard')
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Código 2FA inválido'
  } finally {
    isLoading.value = false
  }
}

const navigateAfterLogin = () => {
  const redirect = route.query.redirect as string
  if (redirect) {
    router.push(redirect)
  } else {
    switch (authStore.userRole) {
      case 'SUPERADMIN':
        router.push('/admin/dashboard')
        break
      case 'ADMIN':
      case 'WORKER':
        router.push('/clinic/dashboard')
        break
      case 'USER':
        router.push('/patient/dashboard')
        break
      default:
        router.push('/')
    }
  }
}

const backToLogin = () => {
  authStore.requiresTenantSelection = false
  authStore.availableTenants = []
  authStore.requires2FA = false
  error.value = ''
}

const getRoleBadge = (role: string) => {
  const map: Record<string, string> = {
    ADMIN: 'Administrador',
    WORKER: 'Profesional',
    USER: 'Paciente',
  }
  return map[role] || role
}
</script>

<template>
  <div>
    <!-- Normal login form -->
    <template v-if="!show2FA && !showTenantSelector">
      <h2 class="text-xl font-display font-bold text-surface-900 mb-1">Bienvenido de vuelta</h2>
      <p class="text-surface-500 text-sm mb-6">Ingresa tus credenciales para acceder</p>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <!-- Error message -->
        <div v-if="error" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
          {{ error }}
        </div>

        <!-- Email -->
        <div>
          <label for="email" class="label">Correo electrónico</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="tu@email.com"
            class="input"
            :class="{ 'input-error': error }"
          />
        </div>

        <!-- Password -->
        <div>
          <label for="password" class="label">Contraseña</label>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="input pr-10"
              :class="{ 'input-error': error }"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-surface-400 hover:text-surface-600"
            >
              <EyeSlashIcon v-if="showPassword" class="w-5 h-5" />
              <EyeIcon v-else class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Forgot password link -->
        <div class="flex justify-end">
          <RouterLink to="/forgot-password" class="text-sm text-primary-600 hover:text-primary-700">
            ¿Olvidaste tu contraseña?
          </RouterLink>
        </div>

        <!-- Submit button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="btn-primary w-full"
        >
          <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión' }}
        </button>
      </form>
    </template>

    <!-- Tenant selector -->
    <template v-else-if="showTenantSelector">
      <div class="text-center mb-6">
        <div class="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <BuildingOffice2Icon class="w-6 h-6 text-primary-600" />
        </div>
        <h2 class="text-xl font-display font-bold text-surface-900 mb-1">Selecciona tu empresa</h2>
        <p class="text-surface-500 text-sm">
          Tu cuenta está vinculada a varias empresas.
          <br>Selecciona con cuál deseas acceder.
        </p>
      </div>

      <!-- Error message -->
      <div v-if="error" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm mb-4">
        {{ error }}
      </div>

      <!-- Tenant list -->
      <div class="space-y-2 mb-4">
        <button
          v-for="tenant in authStore.availableTenants"
          :key="tenant.slug"
          @click="handleTenantSelect(tenant.slug)"
          :disabled="isLoading"
          class="w-full flex items-center justify-between p-4 rounded-xl border border-surface-200 
                 hover:border-primary-300 hover:bg-primary-50/50 transition-all duration-200 
                 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 
                        rounded-lg flex items-center justify-center text-white font-bold text-sm
                        group-hover:shadow-md transition-shadow">
              {{ tenant.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <div class="font-medium text-surface-900 group-hover:text-primary-700 transition-colors">
                {{ tenant.name }}
              </div>
              <div class="text-xs text-surface-500">
                {{ getRoleBadge(tenant.role) }}
              </div>
            </div>
          </div>
          <svg class="w-5 h-5 text-surface-400 group-hover:text-primary-500 transition-colors" 
               fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        @click="backToLogin"
        class="btn-ghost w-full flex items-center justify-center gap-2"
      >
        <ArrowLeftIcon class="w-4 h-4" />
        Volver al login
      </button>
    </template>

    <!-- 2FA verification form -->
    <template v-else>
      <h2 class="text-xl font-display font-bold text-surface-900 mb-1">Verificación en dos pasos</h2>
      <p class="text-surface-500 text-sm mb-6">Ingresa el código de tu aplicación de autenticación</p>

      <form @submit.prevent="handle2FA" class="space-y-4">
        <div v-if="error" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
          {{ error }}
        </div>

        <div>
          <label for="code" class="label">Código de verificación</label>
          <input
            id="code"
            v-model="twoFactorCode"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            required
            placeholder="000000"
            class="input text-center text-2xl tracking-widest"
          />
        </div>

        <button
          type="submit"
          :disabled="isLoading || twoFactorCode.length !== 6"
          class="btn-primary w-full"
        >
          {{ isLoading ? 'Verificando...' : 'Verificar' }}
        </button>

        <button
          type="button"
          @click="backToLogin"
          class="btn-ghost w-full"
        >
          Volver
        </button>
      </form>
    </template>
  </div>
</template>
