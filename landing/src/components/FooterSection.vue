<script setup lang="ts">
const currentYear = new Date().getFullYear()

const emit = defineEmits(['navigate'])

const footerLinks = {
  producto: [
    { name: 'Funcionalidades', href: '#funcionalidades', type: 'anchor' },
    { name: 'Beneficios', href: '#beneficios', type: 'anchor' },
    { name: 'Testimonios', href: '#testimonios', type: 'anchor' },
    { name: 'Precios', href: '#contacto', type: 'anchor' }
  ],
  empresa: [
    { name: 'Sobre nosotros', href: '#', type: 'anchor' }, // Placeholder or remove if no content
    { name: 'Contacto', href: '#contacto', type: 'anchor' }
  ],
  legal: [
    { name: 'Política de privacidad', id: 'privacy', type: 'page' },
    { name: 'Términos de servicio', id: 'terms', type: 'page' },
    { name: 'Política de cookies', id: 'cookies', type: 'page' },
    { name: 'RGPD', id: 'gdpr', type: 'page' }
  ]
}

const handleNavigation = (link: any) => {
  if (link.type === 'page') {
    emit('navigate', link.id)
  }
  // anchors work natively via href
}
</script>

<template>
  <footer class="bg-surface-900/50 border-t border-white/5">
    <div class="section-container py-16">
      <!-- Main Footer -->
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
        <!-- Brand -->
        <div class="lg:col-span-1">
          <a href="#" @click.prevent="emit('navigate', 'home')" class="flex items-center gap-3 mb-4 cursor-pointer">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span class="text-xl font-bold text-white">Cuspia</span>
          </a>
          <p class="text-surface-400 text-sm mb-6 max-w-xs">
            El software de gestión integral para clínicas dentales en España. 
            Digitaliza, automatiza y crece con Cuspia.
          </p>
        </div>

        <!-- Producto -->
        <div>
          <h4 class="font-semibold text-white mb-4">Producto</h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.producto" :key="link.name">
              <a :href="link.href" class="text-sm text-surface-400 hover:text-primary-400 transition-colors">
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Empresa -->
        <div>
          <h4 class="font-semibold text-white mb-4">Empresa</h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.empresa" :key="link.name">
              <a :href="link.href" class="text-sm text-surface-400 hover:text-primary-400 transition-colors">
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div>
          <h4 class="font-semibold text-white mb-4">Legal</h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.legal" :key="link.name">
              <a 
                :href="link.type === 'anchor' ? link.href : '#'" 
                @click.prevent="handleNavigation(link)"
                class="text-sm text-surface-400 hover:text-primary-400 transition-colors cursor-pointer"
              >
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom -->
      <div class="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-sm text-surface-500">
          © {{ currentYear }} Cuspia. Todos los derechos reservados.
        </p>
        <div class="flex items-center gap-2 text-sm text-surface-500">
          <span>Hecho con</span>
          <svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span>en España</span>
        </div>
      </div>
    </div>

  </footer>
</template>
