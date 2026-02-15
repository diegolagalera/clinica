<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/services/api'
import { getTenantSlug } from '@/utils/tenant'

const route = useRoute()

const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const successDone = ref(false)
const error = ref('')

const tenantSlug = getTenantSlug()
const tenantName = ref<string | null>(null)

// Get token from query param
const token = computed(() => route.query.token as string)

// On mount, validate the token and optionally get tenant info
onMounted(async () => {
  if (!token.value) {
    error.value = 'Token inválido o expirado'
    return
  }

  // Get tenant name for display
  if (tenantSlug) {
    try {
      const res = await api.get<any>(`/tenants/${tenantSlug}/info`)
      tenantName.value = (res as any).data?.name || tenantSlug
    } catch {
      // Not critical, just won't show tenant name
    }
  }
})

const handleSubmit = async () => {
  error.value = ''
  
  if (!token.value) {
    error.value = 'Token inválido o expirado'
    return
  }
  
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
    // X-Tenant-Slug header is injected automatically from subdomain
    await api.post('/auth/reset-password', {
      token: token.value,
      password: password.value,
    })
    successDone.value = true
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Error al restablecer la contraseña'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Success state -->
    <template v-if="successDone">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success-50 flex items-center justify-center">
          <svg class="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-display font-bold text-surface-900 mb-2">¡Contraseña restablecida!</h2>
        <p class="text-surface-500 text-sm mb-2">
          Tu contraseña ha sido actualizada<span v-if="tenantName"> en <strong>{{ tenantName }}</strong></span>.
        </p>
        <p class="text-surface-500 text-sm mb-6">
          Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <RouterLink to="/login" class="btn-primary">
          Iniciar Sesión
        </RouterLink>
      </div>
    </template>

    <!-- Invalid token (no token in URL) -->
    <template v-else-if="!token">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-danger-50 flex items-center justify-center">
          <svg class="w-8 h-8 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 class="text-xl font-display font-bold text-surface-900 mb-2">Enlace inválido</h2>
        <p class="text-surface-500 text-sm mb-6">
          Este enlace de recuperación ha expirado o no es válido. Solicita uno nuevo.
        </p>
        <RouterLink to="/forgot-password" class="btn-primary">
          Solicitar nuevo enlace
        </RouterLink>
      </div>
    </template>

    <!-- Password form (direct, no tenant selector) -->
    <template v-else>
      <h2 class="text-xl font-display font-bold text-surface-900 mb-1">Nueva contraseña</h2>
      <p class="text-surface-500 text-sm mb-6">
        <template v-if="tenantName">
          Restableciendo contraseña en <strong>{{ tenantName }}</strong>
        </template>
        <template v-else>
          Ingresa tu nueva contraseña
        </template>
      </p>

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

      <p class="mt-4 text-center text-sm text-surface-500">
        <RouterLink to="/login" class="text-primary-600 hover:text-primary-700 font-medium">
          Volver a iniciar sesión
        </RouterLink>
      </p>
    </template>
  </div>
</template>
