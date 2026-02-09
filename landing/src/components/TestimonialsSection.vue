<script setup lang="ts">
const testimonials = [
  {
    name: 'Dra. María García',
    role: 'Directora Clínica',
    clinic: 'Clínica Dental Sonrisas - Madrid',
    image: null,
    quote: 'Desde que implementamos Cuspia, hemos reducido las ausencias de pacientes en un 65%. Los recordatorios automáticos por SMS han sido un cambio total para nuestra clínica.',
    rating: 5
  },
  {
    name: 'Dr. Carlos Rodríguez',
    role: 'Odontólogo',
    clinic: 'Centro Dental Avanzado - Barcelona',
    image: null,
    quote: 'La función de análisis de radiografías con IA me ahorra más de 2 horas al día. Es increíble tener un segundo diagnóstico instantáneo que me ayuda a no pasar nada por alto.',
    rating: 5
  },
  {
    name: 'Ana Martínez',
    role: 'Gerente Administrativa',
    clinic: 'Policlínica Dental Valencia',
    image: null,
    quote: 'El control de stock es espectacular. Antes perdíamos materiales por caducidad o falta de control. Ahora sabemos exactamente qué tenemos y qué necesitamos pedir.',
    rating: 5
  }
]
</script>

<template>
  <section id="testimonios" class="py-20 sm:py-28 bg-surface-900/30 relative">
    <!-- Decorative -->
    <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>
    
    <div class="section-container">
      <!-- Header -->
      <div class="text-center mb-16">
        <span class="inline-block px-4 py-1 text-sm font-medium text-primary-400 bg-primary-500/10 rounded-full mb-4">
          Testimonios
        </span>
        <h2 class="section-title mb-4">
          Lo que dicen nuestros <span class="gradient-text">clientes</span>
        </h2>
        <p class="section-subtitle mx-auto">
          Clínicas dentales de toda España confían en Cuspia para su gestión diaria
        </p>
      </div>

      <!-- Testimonials Grid -->
      <div class="grid md:grid-cols-3 gap-6 lg:gap-8">
        <article 
          v-for="(testimonial, index) in testimonials" 
          :key="index"
          class="glass-card p-6 sm:p-8 flex flex-col"
        >
          <!-- Quote -->
          <div class="flex-1">
            <svg class="w-10 h-10 text-primary-500/30 mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <blockquote class="text-surface-300 leading-relaxed mb-6">
              "{{ testimonial.quote }}"
            </blockquote>
          </div>

          <!-- Rating -->
          <div class="flex items-center gap-1 mb-4">
            <svg 
              v-for="i in testimonial.rating" 
              :key="i" 
              class="w-5 h-5 text-yellow-400" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>

          <!-- Author -->
          <div class="flex items-center gap-4 pt-4 border-t border-white/10">
            <!-- Avatar -->
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-cyan-400 flex items-center justify-center text-white font-bold text-lg">
              {{ testimonial.name.split(' ').map(n => n[0]).join('').slice(0, 2) }}
            </div>
            <div>
              <div class="font-semibold text-white">{{ testimonial.name }}</div>
              <div class="text-sm text-surface-400">{{ testimonial.role }}</div>
              <div class="text-xs text-surface-500">{{ testimonial.clinic }}</div>
            </div>
          </div>
        </article>
      </div>


    </div>
  </section>
</template>
