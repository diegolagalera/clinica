<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import {
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  KeyIcon,
  CheckIcon,
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()

// State
const isEditing = ref(false)
const isSaving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const formData = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
})

const passwordData = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

// Load profile
const loadProfile = () => {
  if (authStore.user) {
    formData.value = {
      firstName: authStore.user.firstName || '',
      lastName: authStore.user.lastName || '',
      email: authStore.user.email || '',
      phone: '',
    }
  }
}

// Save profile
const saveProfile = async () => {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    // In a real implementation, this would call an update endpoint
    await new Promise(resolve => setTimeout(resolve, 500))
    successMessage.value = 'Perfil actualizado correctamente'
    isEditing.value = false
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Error al guardar'
  } finally {
    isSaving.value = false
  }
}

// Change password
const changePassword = async () => {
  if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
    errorMessage.value = 'Las contraseñas no coinciden'
    return
  }
  
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    await api.post('/auth/change-password', {
      currentPassword: passwordData.value.currentPassword,
      newPassword: passwordData.value.newPassword,
    })
    successMessage.value = 'Contraseña cambiada correctamente'
    passwordData.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Error al cambiar contraseña'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-display font-bold text-surface-900">Mi Perfil</h1>
      <p class="text-surface-500 mt-1">Gestiona tu información personal</p>
    </div>

    <!-- Success/Error messages -->
    <div v-if="successMessage" class="p-4 rounded-xl bg-success-50 text-success-600 flex items-center gap-2">
      <CheckIcon class="w-5 h-5" />
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="p-4 rounded-xl bg-danger-50 text-danger-600">
      {{ errorMessage }}
    </div>

    <!-- Profile info -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h2 class="font-semibold text-surface-900">Información Personal</h2>
        <button 
          v-if="!isEditing" 
          @click="isEditing = true"
          class="btn-secondary btn-sm"
        >
          Editar
        </button>
      </div>
      
      <form @submit.prevent="saveProfile" class="card-body space-y-4">
        <div class="flex justify-center mb-4">
          <div class="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center">
            <span class="text-3xl font-semibold text-primary-700">
              {{ formData.firstName.charAt(0) }}{{ formData.lastName.charAt(0) }}
            </span>
          </div>
        </div>
        
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="label">Nombre</label>
            <input 
              v-model="formData.firstName" 
              type="text" 
              :disabled="!isEditing"
              class="input"
            />
          </div>
          <div>
            <label class="label">Apellidos</label>
            <input 
              v-model="formData.lastName" 
              type="text" 
              :disabled="!isEditing"
              class="input"
            />
          </div>
          <div>
            <label class="label">Email</label>
            <div class="relative">
              <EnvelopeIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
              <input 
                v-model="formData.email" 
                type="email" 
                disabled
                class="input pl-10"
              />
            </div>
          </div>
          <div>
            <label class="label">Teléfono</label>
            <div class="relative">
              <PhoneIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
              <input 
                v-model="formData.phone" 
                type="tel" 
                :disabled="!isEditing"
                class="input pl-10"
              />
            </div>
          </div>
        </div>
        
        <div v-if="isEditing" class="flex gap-3 pt-4">
          <button 
            type="button" 
            @click="isEditing = false; loadProfile()"
            class="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            :disabled="isSaving"
            class="btn-primary flex-1"
          >
            {{ isSaving ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Change password -->
    <div class="card">
      <div class="card-header">
        <h2 class="font-semibold text-surface-900">Cambiar Contraseña</h2>
      </div>
      
      <form @submit.prevent="changePassword" class="card-body space-y-4">
        <div>
          <label class="label">Contraseña actual</label>
          <div class="relative">
            <KeyIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
            <input 
              v-model="passwordData.currentPassword" 
              type="password" 
              class="input pl-10"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div>
          <label class="label">Nueva contraseña</label>
          <input 
            v-model="passwordData.newPassword" 
            type="password" 
            class="input"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label class="label">Confirmar nueva contraseña</label>
          <input 
            v-model="passwordData.confirmPassword" 
            type="password" 
            class="input"
            placeholder="••••••••"
          />
        </div>
        <button 
          type="submit" 
          :disabled="isSaving || !passwordData.currentPassword || !passwordData.newPassword"
          class="btn-primary"
        >
          {{ isSaving ? 'Cambiando...' : 'Cambiar Contraseña' }}
        </button>
      </form>
    </div>
  </div>
</template>
