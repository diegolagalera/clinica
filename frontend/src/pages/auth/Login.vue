<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

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

const handleLogin = async () => {
  error.value = ''
  isLoading.value = true

  try {
    const result = await authStore.login(email.value, password.value)
    
    if (result?.success) {
      const redirect = route.query.redirect as string
      if (redirect) {
        router.push(redirect)
      } else {
        // Redirect based on role
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
</script>

<template>
  <div>
    <!-- Normal login form -->
    <template v-if="!show2FA">
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
          @click="authStore.requires2FA = false"
          class="btn-ghost w-full"
        >
          Volver
        </button>
      </form>
    </template>
  </div>
</template>
