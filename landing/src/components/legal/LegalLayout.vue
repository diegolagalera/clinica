<script setup lang="ts">
defineEmits(['back'])
</script>

<template>
  <div class="min-h-screen bg-surface-950 text-white py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
      <button 
        @click="$emit('back')" 
        class="mb-8 flex items-center text-primary-400 hover:text-primary-300 transition-colors"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Volver al inicio
      </button>
      
      <div class="prose prose-invert prose-lg max-w-none">
        <slot></slot>
      </div>
    </div>
  </div>
</template>
