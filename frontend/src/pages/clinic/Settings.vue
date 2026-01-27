<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  Cog6ToothIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()

const configSections = [
  {
    id: 'email',
    name: 'Notificaciones Email',
    description: 'Configura el envío de emails automáticos (SMTP, plantillas, recordatorios)',
    icon: EnvelopeIcon,
    color: 'bg-blue-100 text-blue-600',
    route: '/clinic/notifications',
  },
  {
    id: 'sms',
    name: 'Notificaciones SMS',
    description: 'Configura el envío de SMS con Twilio (credenciales, plantillas, recordatorios)',
    icon: DevicePhoneMobileIcon,
    color: 'bg-emerald-100 text-emerald-600',
    route: '/clinic/sms',
  },
]

const goToSection = (route: string) => {
  router.push(route)
}
</script>

<template>
  <div class="max-w-4xl mx-auto py-6 px-4">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-8">
      <div class="p-3 bg-primary-100 rounded-xl">
        <Cog6ToothIcon class="w-8 h-8 text-primary-600" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Configuración</h1>
        <p class="text-surface-500">Gestiona la configuración de tu clínica</p>
      </div>
    </div>

    <!-- Config Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <button
        v-for="section in configSections"
        :key="section.id"
        @click="goToSection(section.route)"
        class="card p-6 text-left hover:shadow-lg hover:border-primary-200 transition-all group cursor-pointer"
      >
        <div class="flex items-start gap-4">
          <div :class="['p-3 rounded-xl', section.color]">
            <component :is="section.icon" class="w-6 h-6" />
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-surface-900 group-hover:text-primary-600 transition-colors">
                {{ section.name }}
              </h3>
              <ChevronRightIcon class="w-5 h-5 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p class="text-sm text-surface-500 mt-1">{{ section.description }}</p>
          </div>
        </div>
      </button>
    </div>

    <!-- Future sections placeholder -->
    <div class="mt-8 p-6 border-2 border-dashed border-surface-200 rounded-xl text-center">
      <p class="text-surface-400">Más opciones de configuración próximamente...</p>
    </div>
  </div>
</template>
