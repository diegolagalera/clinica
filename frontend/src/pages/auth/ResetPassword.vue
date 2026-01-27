<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const success = ref(false)
const error = ref('')

const token = route.params.token as string

const handleSubmit = async () => {
  error.value = ''
  
  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }

  isLoading.value = true

  try {
    // API call would go here
    await new Promise(resolve => setTimeout(resolve, 1000))
    success.value = true
  } catch (err: any) {
    error.value = err.message || 'Error al restablecer la contraseña'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="success">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success-50 flex items-center justify-center">
          <svg class="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-display font-bold text-surface-900 mb-2">¡Contraseña restablecida!</h2>
        <p class="text-surface-500 text-sm mb-6">
          Tu contraseña ha sido actualizada. Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <RouterLink to="/login" class="btn-primary">
          Iniciar Sesión
        </RouterLink>
      </div>
    </template>

    <template v-else>
      <h2 class="text-xl font-display font-bold text-surface-900 mb-1">Nueva contraseña</h2>
      <p class="text-surface-500 text-sm mb-6">Ingresa tu nueva contraseña</p>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div v-if="error" class="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
          {{ error }}
        </div>

        <div>
          <label for="password" class="label">Nueva contraseña</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="8"
            placeholder="Mínimo 8 caracteres"
            class="input"
          />
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

        <button type="submit" :disabled="isLoading" class="btn-primary w-full">
          {{ isLoading ? 'Guardando...' : 'Guardar contraseña' }}
        </button>
      </form>
    </template>
  </div>
</template>
