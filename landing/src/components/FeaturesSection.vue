<script setup lang="ts">
const features = [
  {
    id: 'pacientes',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>`,
    title: 'Gestión de Pacientes',
    description: 'Historial clínico completo, odontograma digital interactivo, y ficha del paciente con todos sus datos en un solo lugar.',
    badge: 'Core',
    keywords: ['historial clínico dental', 'gestión pacientes odontología', 'ficha paciente dental']
  },
  {
    id: 'calendario',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>`,
    title: 'Agenda Inteligente',
    description: 'Calendario multi-profesional con vistas de día, semana y mes. Arrastra y suelta citas, gestiona múltiples dentistas simultáneamente.',
    badge: 'Popular',
    keywords: ['agenda clínica dental', 'calendario dentista', 'software citas dental']
  },
  {
    id: 'stock',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>`,
    title: 'Control de Stock',
    description: 'Inventario con trazabilidad completa, alertas de stock bajo, escaneo de códigos de barras y consumo por paciente y procedimiento.',
    badge: null,
    keywords: ['inventario clínica dental', 'control stock dental', 'gestión materiales odontología']
  },
  {
    id: 'citas-activas',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    title: 'Citas en Tiempo Real',
    description: 'Seguimiento de duración de tratamientos, pausas y finalización. Sincronización automática entre todos los profesionales de la clínica.',
    badge: 'Nuevo',
    keywords: ['seguimiento citas dental', 'cronómetro tratamientos', 'tiempo real clínica']
  },
  {
    id: 'ia',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`,
    title: 'Inteligencia Artificial',
    description: 'Análisis automático de radiografías con GPT-4 Vision y transcripción de notas clínicas por voz convertidas a registros estructurados.',
    badge: 'IA',
    keywords: ['IA dental', 'análisis radiografías IA', 'inteligencia artificial odontología']
  },
  {
    id: 'comunicaciones',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`,
    title: 'Comunicaciones Automáticas',
    description: 'Recordatorios de citas por SMS y Email, confirmaciones, y notificaciones personalizables con plantillas visuales.',
    badge: 'Popular',
    keywords: ['recordatorios SMS dental', 'email marketing clínica', 'notificaciones automáticas dentista']
  },
  {
    id: 'satisfaccion',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>`,
    title: 'Satisfacción de Pacientes',
    description: 'Encuestas automáticas post-visita con valoraciones y comentarios. Mide la experiencia de tus pacientes y mejora continuamente.',
    badge: null,
    keywords: ['encuestas satisfacción dental', 'valoración pacientes', 'reviews clínica dental']
  },
  {
    id: 'chatbot',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>`,
    title: 'Chatbot WhatsApp 24/7',
    description: 'Asistente virtual inteligente que gestiona citas, resuelve dudas frecuentes y atiende a tus pacientes en WhatsApp a cualquier hora.',
    badge: 'Nuevo',
    keywords: ['chatbot dental', 'whatsapp citas automático', 'ia dental whatsapp']
  },
  {
    id: 'odontograma',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`,
    title: 'Odontograma Interactivo',
    description: 'Registra el estado bucodental, marca tratamientos realizados y planifica intervenciones futuras sobre un mapa dental 3D visual e intuitivo.',
    badge: 'Core',
    keywords: ['odontograma 3d', 'periodontograma', 'mapa dental interactivo']
  },
  {
    id: 'reportes',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>`,
    title: 'Reportes y Analíticas',
    description: 'Dashboard con KPIs, consumo de materiales por profesional, rentabilidad por tratamiento y exportación a Excel.',
    badge: null,
    keywords: ['reportes clínica dental', 'analíticas odontología', 'dashboard dental']
  }
]
</script>

<template>
  <section id="funcionalidades" class="py-20 sm:py-28 bg-surface-900/30 relative">
    <!-- Decorative Elements -->
    <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>
    <div class="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>
    
    <div class="section-container">
      <!-- Section Header -->
      <div class="text-center mb-16">
        <span class="inline-block px-4 py-1 text-sm font-medium text-primary-400 bg-primary-500/10 rounded-full mb-4">
          Funcionalidades
        </span>
        <h2 class="section-title mb-4">
          Todo lo que necesitas para gestionar tu 
          <span class="gradient-text">clínica dental</span>
        </h2>
        <p class="section-subtitle mx-auto">
          Cuspia integra todas las herramientas esenciales en un único software de gestión dental, 
          diseñado específicamente para clínicas y consultorios odontológicos en España.
        </p>
      </div>

      <!-- Features Grid -->
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <article 
          v-for="feature in features" 
          :key="feature.id"
          class="feature-card relative group"
        >
          <!-- Badge -->
          <div 
            v-if="feature.badge" 
            class="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-semibold rounded-full"
            :class="{
              'bg-primary-500 text-white': feature.badge === 'Popular',
              'bg-emerald-500 text-white': feature.badge === 'Nuevo',
              'bg-purple-500 text-white': feature.badge === 'IA',
              'bg-cyan-500 text-white': feature.badge === 'Core'
            }"
          >
            {{ feature.badge }}
          </div>

          <!-- Icon -->
          <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500/20 to-cyan-500/20 border border-primary-500/20 flex items-center justify-center text-primary-400 mb-5 group-hover:scale-110 transition-transform duration-300">
            <span v-html="feature.icon"></span>
          </div>

          <!-- Content -->
          <h3 class="text-lg font-semibold text-white mb-2">
            {{ feature.title }}
          </h3>
          <p class="text-surface-400 text-sm leading-relaxed">
            {{ feature.description }}
          </p>

          <!-- SEO Keywords (hidden) -->
          <span class="sr-only">{{ feature.keywords.join(', ') }}</span>

          <!-- Hover Arrow -->
          <div class="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <svg class="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </article>
      </div>

      <!-- Bottom CTA -->
      <div class="text-center mt-12">
        <a href="#contacto" class="btn-primary">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Solicitar Demo Personalizada
        </a>
      </div>
    </div>
  </section>
</template>
