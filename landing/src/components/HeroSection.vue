<script setup lang="ts">
// SEO: Keywords relevantes incluidos naturalmente en el contenido
</script>

<template>
  <section class="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
    <!-- Background Effects -->
    <div class="absolute inset-0 bg-surface-950">
      <!-- Gradient Orbs -->
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow" style="animation-delay: 2s;"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl"></div>
      
      <!-- Grid Pattern -->
      <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
    </div>

    <div class="section-container relative z-10">
      <div class="text-center max-w-5xl mx-auto">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-8">
          <span class="w-2 h-2 rounded-full bg-primary-400 animate-pulse"></span>
          <span class="text-sm text-primary-400 font-medium">Software de gestión dental #1 en España</span>
        </div>

        <!-- H1: Título principal con keywords SEO -->
        <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6">
          El <span class="gradient-text">software de gestión</span> que tu 
          <span class="gradient-text">clínica dental</span> necesita
        </h1>

        <!-- Subtítulo con keywords SEO -->
        <p class="text-lg sm:text-xl md:text-2xl text-surface-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          Digitaliza tu clínica con <strong class="text-white">agenda inteligente</strong>, 
          <strong class="text-white">historial clínico digital</strong>, 
          <strong class="text-white">control de stock</strong> y 
          <strong class="text-white">recordatorios automáticos</strong>. 
          Todo potenciado con <strong class="text-primary-400">inteligencia artificial</strong>.
        </p>

        <!-- CTAs -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a href="#contacto" class="btn-primary w-full sm:w-auto">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Solicitar Demo Gratuita
          </a>
          <a href="#funcionalidades" class="btn-secondary w-full sm:w-auto">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            Ver Funcionalidades
          </a>
        </div>

        <!-- Stats con Social Proof -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          <div class="glass-card p-4 sm:p-6 text-center">
            <div class="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-1">500+</div>
            <div class="text-sm text-surface-400">Clínicas en España</div>
          </div>
          <div class="glass-card p-4 sm:p-6 text-center">
            <div class="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-1">50K+</div>
            <div class="text-sm text-surface-400">Pacientes gestionados</div>
          </div>
          <div class="glass-card p-4 sm:p-6 text-center">
            <div class="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-1">4.9</div>
            <div class="text-sm text-surface-400 flex items-center justify-center gap-1">
              <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Valoración media
            </div>
          </div>
          <div class="glass-card p-4 sm:p-6 text-center">
            <div class="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-1">99.9%</div>
            <div class="text-sm text-surface-400">Uptime garantizado</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll Indicator -->
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
      <svg class="w-6 h-6 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </div>
  </section>
</template>
