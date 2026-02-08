<script setup lang="ts">
const painPoints = [
  {
    icon: `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    problem: '¿Pierdes tiempo buscando historiales de pacientes?',
    solution: 'Accede a toda la información clínica en segundos con nuestro historial digital centralizado.',
    keyword: 'historial clínico dental digital'
  },
  {
    icon: `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>`,
    problem: '¿Tu inventario está fuera de control?',
    solution: 'Control de stock automatizado con alertas de reposición y trazabilidad completa por paciente.',
    keyword: 'gestión inventario clínica dental'
  },
  {
    icon: `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>`,
    problem: '¿Olvidas enviar recordatorios de citas?',
    solution: 'Recordatorios automáticos por SMS y Email que reducen las ausencias hasta un 70%.',
    keyword: 'recordatorios citas dentista automáticos'
  },
  {
    icon: `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`,
    problem: '¿Documentar procedimientos te quita demasiado tiempo?',
    solution: 'Dictado por voz con IA que convierte tus notas verbales en registros clínicos estructurados.',
    keyword: 'documentación clínica automatizada IA'
  }
]
</script>

<template>
  <section class="py-20 sm:py-28 bg-surface-950 relative overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 bg-gradient-to-b from-surface-950 via-surface-900/50 to-surface-950"></div>
    
    <div class="section-container relative z-10">
      <!-- Section Header con SEO -->
      <div class="text-center mb-16">
        <h2 class="section-title mb-4">
          ¿Tu clínica tiene estos <span class="gradient-text">problemas</span>?
        </h2>
        <p class="section-subtitle mx-auto">
          Cuspia resuelve los desafíos más comunes en la gestión de clínicas dentales en España
        </p>
      </div>

      <!-- Pain Points Grid -->
      <div class="grid md:grid-cols-2 gap-6 lg:gap-8">
        <article 
          v-for="(item, index) in painPoints" 
          :key="index"
          class="feature-card group"
        >
          <div class="flex items-start gap-5">
            <!-- Icon -->
            <div class="flex-shrink-0 w-14 h-14 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:bg-primary-500/10 group-hover:border-primary-500/20 group-hover:text-primary-400 transition-all duration-300">
              <span v-html="item.icon"></span>
            </div>
            
            <!-- Content -->
            <div class="flex-1">
              <h3 class="text-lg sm:text-xl font-semibold text-white mb-2 group-hover:text-primary-300 transition-colors">
                {{ item.problem }}
              </h3>
              <p class="text-surface-400 leading-relaxed">
                {{ item.solution }}
              </p>
              <!-- Hidden SEO keyword -->
              <span class="sr-only">{{ item.keyword }}</span>
            </div>
          </div>

          <!-- Progress indicator -->
          <div class="mt-6 h-1 bg-surface-800 rounded-full overflow-hidden">
            <div 
              class="h-full bg-gradient-to-r from-red-500 to-red-400 group-hover:from-primary-500 group-hover:to-cyan-500 transition-all duration-500"
              :style="{ width: '0%' }"
              :class="{ 'w-full': true }"
            ></div>
          </div>
        </article>
      </div>

      <!-- CTA -->
      <div class="text-center mt-12">
        <p class="text-surface-400 mb-4">
          Si reconoces alguno de estos problemas, Cuspia es la solución.
        </p>
        <a href="#funcionalidades" class="btn-secondary inline-flex items-center">
          <span>Descubre cómo lo solucionamos</span>
          <svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
      </div>
    </div>
  </section>
</template>
