<script setup lang="ts">
// No script logic needed for pure CSS animation
</script>

<template>
  <!-- Standard single-screen height, no scroll dependency -->
  <div class="relative min-h-screen flex items-center justify-center overflow-hidden bg-surface-950 pt-20">
      
      <!-- Layer 0: Background -->
      <div class="absolute inset-0 bg-surface-950 z-0">
        <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow" style="animation-delay: 2s;"></div>
        <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
      </div>

      <!-- Layer 1: X-Ray Reveal (Automatic Animation) -->
      <div class="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div class="relative w-full max-w-7xl px-4 h-full flex items-center justify-center">
             
             <!-- MAIN CONTAINER FOR X-RAY LAYERS -->
             <div class="relative w-full h-full flex items-center justify-center">
                 
                 <!-- LAYER A: Static Base Image (Always Visible) -->
                 <img 
                    src="/xray.webp" 
                    alt="Panoramic Dental X-Ray Base" 
                    class="absolute w-full h-full object-contain max-h-[80vh] opacity-20 filter grayscale blur-[1px]"
                 />

                 <!-- LAYER B: Scanning Highlight (Reveals full detail) -->
                 <div class="absolute inset-0 flex items-center justify-center scanner-container">
                     <img 
                        src="/xray.webp" 
                        alt="Panoramic Dental X-Ray Highlight" 
                        class="w-full h-full object-contain max-h-[80vh] filter contrast-125 brightness-110 drop-shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                     />
                 </div>
                 
                 <!-- LAYER C: Scanner Line (Independent to Sync Visuals) -->
                 <div class="scanner-line absolute w-full h-[2px] bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,1)] z-20"></div>

             </div>

        </div>
      </div>

      <!-- Layer 2: Main Hero Content (Static & Visible) -->
      <div class="relative z-20 section-container text-center">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-8 backdrop-blur-sm">
          <span class="w-2 h-2 rounded-full bg-primary-400 animate-pulse"></span>
          <span class="text-sm text-primary-400 font-medium">Software de gestión dental #1 en España</span>
        </div>

        <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6">
          Visión <span class="gradient-text">Profunda</span> para<br />
          tu <span class="gradient-text">Clínica Dental</span>
        </h1>

        <p class="text-lg sm:text-xl md:text-2xl text-surface-400 max-w-3xl mx-auto mb-10 leading-relaxed">
           Tecnología de vanguardia que revela lo invisible. Diagnóstico con IA, gestión integral y precisión quirúrgica.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
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
        
         <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mt-16 max-w-4xl mx-auto">
          <div class="glass-card p-4 text-center">
            <div class="text-2xl font-bold gradient-text">500+</div>
            <div class="text-xs text-surface-400">Clínicas</div>
          </div>
          <div class="glass-card p-4 text-center">
            <div class="text-2xl font-bold gradient-text">AI</div>
            <div class="text-xs text-surface-400">Integrada</div>
          </div>
           <div class="glass-card p-4 text-center">
            <div class="text-2xl font-bold gradient-text">24/7</div>
            <div class="text-xs text-surface-400">Soporte</div>
          </div>
           <div class="glass-card p-4 text-center">
            <div class="text-2xl font-bold gradient-text">Cloud</div>
            <div class="text-xs text-surface-400">Seguro</div>
          </div>
        </div>
      </div>

      <!-- Scanner Interface Overlays -->
      <div class="absolute inset-0 z-30 pointer-events-none mix-blend-screen opacity-50">
          <div class="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-cyan-500/50 rounded-tl-xl"></div>
          <div class="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-cyan-500/50 rounded-tr-xl"></div>
          <div class="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-cyan-500/50 rounded-bl-xl"></div>
          <div class="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-cyan-500/50 rounded-br-xl"></div>
      </div>

  </div>
</template>

<style scoped>
.animate-pulse-slow {
  animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.5; }
}

/* Scanner Animations */ 
.scanner-container {
    /* Reveals the highlight image in a band that moves down */
    animation: scan-highlight 8s linear infinite;
}

.scanner-line {
    /* Moves the line down */
    animation: scan-line-move 8s linear infinite;
}

@keyframes scan-highlight {
    0% {
        clip-path: inset(0 0 100% 0); /* Hidden at top */
    }
    15% {
        clip-path: inset(0 0 85% 0); /* Start revealing */
    }
    50% {
        clip-path: inset(40% 0 40% 0); /* Band in middle */
    }
    85% {
        clip-path: inset(85% 0 0 0); /* End revealing */
    }
    100% {
        clip-path: inset(100% 0 0 0); /* Hidden at bottom */
    }
}

@keyframes scan-line-move {
    0% {
        top: 0%;
        opacity: 0;
    }
    5% {
        opacity: 1;
    }
    95% {
        opacity: 1;
    }
    100% {
        top: 100%;
        opacity: 0;
    }
}
</style>
