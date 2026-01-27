<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  DocumentTextIcon,
  PhotoIcon,
  ArrowDownTrayIcon,
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()

// State
const records = ref<any[]>([])
const radiographs = ref<any[]>([])
const isLoading = ref(true)
const activeTab = ref<'records' | 'radiographs'>('records')

// Load records
const loadRecords = async () => {
  isLoading.value = true
  
  try {
    // In a real implementation, this would call patient-specific endpoints
    records.value = []
    radiographs.value = []
  } catch (err) {
    console.error('Error loading records:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadRecords()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-display font-bold text-surface-900">Historial Clínico</h1>
      <p class="text-surface-500 mt-1">Consulta tu historial y documentos</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2">
      <button 
        @click="activeTab = 'records'"
        :class="activeTab === 'records' ? 'btn-primary' : 'btn-secondary'"
        class="btn-sm"
      >
        <DocumentTextIcon class="w-4 h-4" />
        Registros
      </button>
      <button 
        @click="activeTab = 'radiographs'"
        :class="activeTab === 'radiographs' ? 'btn-primary' : 'btn-secondary'"
        class="btn-sm"
      >
        <PhotoIcon class="w-4 h-4" />
        Radiografías
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- Records tab -->
    <template v-else-if="activeTab === 'records'">
      <div v-if="records.length > 0" class="space-y-4">
        <div 
          v-for="record in records" 
          :key="record.id"
          class="card p-4"
        >
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center flex-shrink-0">
              <DocumentTextIcon class="w-5 h-5 text-accent-600" />
            </div>
            <div class="flex-1">
              <p class="font-medium text-surface-900">{{ record.type }}</p>
              <p class="text-sm text-surface-500">{{ record.createdAt }}</p>
            </div>
            <button class="btn-ghost btn-sm">
              <ArrowDownTrayIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div v-else class="card p-12 text-center">
        <DocumentTextIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
        <h3 class="text-lg font-medium text-surface-900 mb-2">No hay registros</h3>
        <p class="text-surface-500">Tu historial clínico aparecerá aquí</p>
      </div>
    </template>

    <!-- Radiographs tab -->
    <template v-else>
      <div v-if="radiographs.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div 
          v-for="radiograph in radiographs" 
          :key="radiograph.id"
          class="card overflow-hidden"
        >
          <div class="aspect-square bg-surface-100 flex items-center justify-center">
            <PhotoIcon class="w-12 h-12 text-surface-300" />
          </div>
          <div class="p-4">
            <p class="font-medium text-surface-900">{{ radiograph.type }}</p>
            <p class="text-sm text-surface-500">{{ radiograph.createdAt }}</p>
          </div>
        </div>
      </div>
      
      <div v-else class="card p-12 text-center">
        <PhotoIcon class="w-12 h-12 mx-auto text-surface-300 mb-4" />
        <h3 class="text-lg font-medium text-surface-900 mb-2">No hay radiografías</h3>
        <p class="text-surface-500">Tus radiografías aparecerán aquí</p>
      </div>
    </template>
  </div>
</template>
