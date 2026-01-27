<script setup lang="ts">
import { ref } from 'vue'

const email = ref('')
const isLoading = ref(false)
const success = ref(false)
const error = ref('')

const handleSubmit = async () => {
  error.value = ''
  isLoading.value = true

  try {
    // API call would go here
    await new Promise(resolve => setTimeout(resolve, 1000))
    success.value = true
  } catch (err: any) {
    error.value = err.message || 'Error al enviar el correo'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="success">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-50 flex items-center justify-center">
          <svg class="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 class="text-xl font-display font-bold text-surface-900 mb-2">Revisa tu correo</h2>
        <p class="text-surface-500 text-sm mb-6">
          Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.
        </p>
        <RouterLink to="/login" class="btn-secondary">
          Volver al inicio
        </RouterLink>
      </div>
    </template>

    <template v-else>
      <h2 class="text-xl font-display font-bold text-surface-900 mb-1">¿Olvidaste tu contraseña?</h2>
      <p class="text-surface-500 text-sm mb-6">Ingresa tu email y te enviaremos un enlace para restablecerla</p>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div v-if="error" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
          {{ error }}
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

        <button type="submit" :disabled="isLoading" class="btn-primary w-full">
          {{ isLoading ? 'Enviando...' : 'Enviar enlace' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-surface-500">
        <RouterLink to="/login" class="text-primary-600 hover:text-primary-700 font-medium">
          Volver a iniciar sesión
        </RouterLink>
      </p>
    </template>
  </div>
</template>
