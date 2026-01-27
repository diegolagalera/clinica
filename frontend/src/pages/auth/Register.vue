<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const authStore = useAuthStore()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const error = ref('')
const success = ref(false)
const isLoading = ref(false)

const handleRegister = async () => {
  error.value = ''
  
  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }

  if (password.value.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres'
    return
  }

  isLoading.value = true

  try {
    await authStore.register({
      firstName: firstName.value,
      lastName: lastName.value,
      email: email.value,
      phone: phone.value || undefined,
      password: password.value,
    })
    
    success.value = true
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Error al registrarse'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Success message -->
    <template v-if="success">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success-50 flex items-center justify-center">
          <svg class="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-display font-bold text-surface-900 mb-2">¡Registro exitoso!</h2>
        <p class="text-surface-500 text-sm mb-6">
          Hemos enviado un correo de verificación a tu email. Por favor, verifica tu cuenta para poder iniciar sesión.
        </p>
        <RouterLink to="/login" class="btn-primary">
          Ir a Iniciar Sesión
        </RouterLink>
      </div>
    </template>

    <!-- Registration form -->
    <template v-else>
      <h2 class="text-xl font-display font-bold text-surface-900 mb-1">Crear cuenta de paciente</h2>
      <p class="text-surface-500 text-sm mb-6">Regístrate para acceder al portal del paciente</p>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div v-if="error" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
          {{ error }}
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="firstName" class="label">Nombre</label>
            <input
              id="firstName"
              v-model="firstName"
              type="text"
              required
              placeholder="Juan"
              class="input"
            />
          </div>
          <div>
            <label for="lastName" class="label">Apellido</label>
            <input
              id="lastName"
              v-model="lastName"
              type="text"
              required
              placeholder="García"
              class="input"
            />
          </div>
        </div>

        <div>
          <label for="email" class="label">Correo electrónico</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="tu@email.com"
            class="input"
          />
        </div>

        <div>
          <label for="phone" class="label">Teléfono <span class="text-surface-400">(opcional)</span></label>
          <input
            id="phone"
            v-model="phone"
            type="tel"
            placeholder="+34 612 345 678"
            class="input"
          />
        </div>

        <div>
          <label for="password" class="label">Contraseña</label>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              minlength="8"
              placeholder="Mínimo 8 caracteres"
              class="input pr-10"
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

        <div>
          <label for="confirmPassword" class="label">Confirmar contraseña</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            required
            placeholder="Repite tu contraseña"
            class="input"
          />
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="btn-primary w-full"
        >
          {{ isLoading ? 'Registrando...' : 'Crear Cuenta' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-surface-500">
        ¿Ya tienes una cuenta?
        <RouterLink to="/login" class="text-primary-600 hover:text-primary-700 font-medium">
          Inicia sesión
        </RouterLink>
      </p>
    </template>
  </div>
</template>
