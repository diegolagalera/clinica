<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <img 
          src="@/assets/img/logo.png" 
          alt="CUSPIA-ERP" 
          class="h-36 w-36 mx-auto rounded-3xl shadow-xl object-cover ring-4 ring-white/50"
        />
      </div>

      <!-- Auth Card -->
      <div class="card animate-fade-in">
        <div class="card-body">
          <RouterView />
        </div>
      </div>

      <!-- Footer -->
      <p class="text-center text-sm text-surface-400 mt-6">
        © {{ new Date().getFullYear() }} CUSPIA-ERP. Todos los derechos reservados.
      </p>
    </div>
  </div>
</template>
