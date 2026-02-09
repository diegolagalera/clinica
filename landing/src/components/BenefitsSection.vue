<script setup lang="ts">
const benefits = [
  {
    icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`,
    title: 'Ahorra hasta 10 horas semanales',
    description: 'Automatiza tareas administrativas repetitivas y dedica más tiempo a tus pacientes.'
  },
  {
    icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>`,
    title: 'Cumple con RGPD y LOPDGDD',
    description: 'Datos alojados en servidores europeos con encriptación de nivel bancario y copias de seguridad automáticas.'
  },
  {
    icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    title: 'Reduce costes operativos',
    description: 'Control preciso del inventario y optimización de recursos que impactan directamente en tu rentabilidad.'
  },
  {
    icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    title: 'Mejora la experiencia del paciente',
    description: 'Recordatorios automáticos, tiempos de espera reducidos y comunicación profesional que fidelizan.'
  },
  {
    icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>`,
    title: '100% en la nube',
    description: 'Accede desde cualquier dispositivo sin instalaciones. Actualizaciones automáticas incluidas.'
  },
  {
    icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`,
    title: 'Soporte en español',
    description: 'Equipo de soporte técnico en España disponible por chat, email y teléfono en horario laboral.'
  },
  {
    icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>`,
    title: 'Chatbot WhatsApp 24/7',
    description: 'Asistente virtual integrado que atiende a tus pacientes en cualquier momento, resolviendo dudas y gestionando citas.'
  }
]
</script>

<template>
  <section id="beneficios" class="py-20 sm:py-28 bg-surface-950 relative overflow-hidden">
    <!-- Background decoration -->
    <div class="absolute top-1/2 left-0 w-1/2 h-1/2 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2"></div>
    <div class="absolute top-1/2 right-0 w-1/2 h-1/2 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2"></div>

    <div class="section-container relative z-10">
      <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <!-- Left: Content -->
        <div>
          <span class="inline-block px-4 py-1 text-sm font-medium text-primary-400 bg-primary-500/10 rounded-full mb-4">
            Beneficios
          </span>
          <h2 class="section-title mb-6">
            ¿Por qué elegir <span class="gradient-text">Cuspia</span> para tu clínica?
          </h2>
          <p class="text-surface-400 text-lg mb-8 leading-relaxed">
            Más de 500 clínicas dentales en España ya confían en Cuspia para digitalizar 
            su gestión. Descubre las ventajas que te esperan.
          </p>

          <!-- Benefits List -->
          <div class="space-y-4">
            <div 
              v-for="(benefit, index) in benefits.slice(0, 3)" 
              :key="index"
              class="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-primary-500/20 transition-all duration-300"
            >
              <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
                <span v-html="benefit.icon"></span>
              </div>
              <div>
                <h3 class="font-semibold text-white mb-1">{{ benefit.title }}</h3>
                <p class="text-sm text-surface-400">{{ benefit.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: More Benefits + Visual -->
        <div class="space-y-4">
          <div 
            v-for="(benefit, index) in benefits.slice(3)" 
            :key="index + 3"
            class="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-primary-500/20 transition-all duration-300"
          >
            <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
              <span v-html="benefit.icon"></span>
            </div>
            <div>
              <h3 class="font-semibold text-white mb-1">{{ benefit.title }}</h3>
              <p class="text-sm text-surface-400">{{ benefit.description }}</p>
            </div>
          </div>


        </div>
      </div>
    </div>
  </section>
</template>
