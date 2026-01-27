<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-50 p-4">
    <div class="text-center">
      <h1 class="text-6xl font-display font-bold text-primary-600 mb-4">404</h1>
      <h2 class="text-2xl font-semibold text-surface-900 mb-2">Página no encontrada</h2>
      <p class="text-surface-500 mb-8">La página que buscas no existe o ha sido movida.</p>
      <RouterLink to="/" class="btn-primary">
        Volver al inicio
      </RouterLink>
    </div>
  </div>
</template>
