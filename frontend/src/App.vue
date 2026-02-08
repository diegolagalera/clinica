<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ToastContainer from '@/components/ToastContainer.vue'

const authStore = useAuthStore()

onMounted(() => {
  // Load user context if authenticated
  if (authStore.isAuthenticated) {
    authStore.loadUserContext()
  }
})
</script>

<template>
  <RouterView />
  <ToastContainer />
</template>
