<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-glow mb-4">
          <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <h1 class="text-2xl font-display font-bold text-surface-900">DentalERP</h1>
        <p class="text-surface-500 mt-1">Sistema de Gestión para Clínicas Dentales</p>
      </div>

      <!-- Auth Card -->
      <div class="card animate-fade-in">
        <div class="card-body">
          <RouterView />
        </div>
      </div>

      <!-- Footer -->
      <p class="text-center text-sm text-surface-400 mt-6">
        © {{ new Date().getFullYear() }} DentalERP. Todos los derechos reservados.
      </p>
    </div>
  </div>
</template>
