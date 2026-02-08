<script setup lang="ts">
const currentYear = new Date().getFullYear()

const footerLinks = {
  producto: [
    { name: 'Funcionalidades', href: '#funcionalidades' },
    { name: 'Beneficios', href: '#beneficios' },
    { name: 'Testimonios', href: '#testimonios' },
    { name: 'Precios', href: '#contacto' }
  ],
  recursos: [
    { name: 'Centro de ayuda', href: '#' },
    { name: 'Documentación', href: '#' },
    { name: 'Blog', href: '#' },
    { name: 'Casos de éxito', href: '#testimonios' }
  ],
  empresa: [
    { name: 'Sobre nosotros', href: '#' },
    { name: 'Contacto', href: '#contacto' },
    { name: 'Trabaja con nosotros', href: '#' }
  ],
  legal: [
    { name: 'Política de privacidad', href: '#' },
    { name: 'Términos de servicio', href: '#' },
    { name: 'Política de cookies', href: '#' },
    { name: 'RGPD', href: '#' }
  ]
}
</script>

<template>
  <footer class="bg-surface-900/50 border-t border-white/5">
    <div class="section-container py-16">
      <!-- Main Footer -->
      <div class="grid sm:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-12">
        <!-- Brand -->
        <div class="lg:col-span-2">
          <a href="#" class="flex items-center gap-3 mb-4">
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
          
          <!-- Social Links -->
          <div class="flex items-center gap-4">
            <a href="#" class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-surface-400 hover:text-primary-400 hover:bg-white/10 transition-all" aria-label="LinkedIn">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            <a href="#" class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-surface-400 hover:text-primary-400 hover:bg-white/10 transition-all" aria-label="Twitter">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="#" class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-surface-400 hover:text-primary-400 hover:bg-white/10 transition-all" aria-label="Instagram">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
          </div>
        </div>

        <!-- Links -->
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

        <div>
          <h4 class="font-semibold text-white mb-4">Recursos</h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.recursos" :key="link.name">
              <a :href="link.href" class="text-sm text-surface-400 hover:text-primary-400 transition-colors">
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>

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

        <div>
          <h4 class="font-semibold text-white mb-4">Legal</h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.legal" :key="link.name">
              <a :href="link.href" class="text-sm text-surface-400 hover:text-primary-400 transition-colors">
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
