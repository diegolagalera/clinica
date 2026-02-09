<script setup lang="ts">
import HeroScroll from './components/HeroScroll.vue'
import PainPointsSection from './components/PainPointsSection.vue'
import FeaturesSection from './components/FeaturesSection.vue'
import BenefitsSection from './components/BenefitsSection.vue'
import TestimonialsSection from './components/TestimonialsSection.vue'
import ContactSection from './components/ContactSection.vue'
import FooterSection from './components/FooterSection.vue'

// Legal Pages
import PrivacyPolicy from './components/legal/PrivacyPolicy.vue'
import TermsOfService from './components/legal/TermsOfService.vue'
import CookiePolicy from './components/legal/CookiePolicy.vue'
import GdprPolicy from './components/legal/GdprPolicy.vue'

import { ref } from 'vue'

const currentView = ref('home')

const navigateTo = (view: string) => {
  currentView.value = view
  window.scrollTo(0, 0)
}
</script>

<template>
  <div class="min-h-screen bg-surface-950">
    <!-- Navegación fija -->
    <nav class="fixed top-0 left-0 right-0 z-50 bg-surface-950/80 backdrop-blur-xl border-b border-white/5">
      <div class="section-container">
        <div class="flex items-center justify-between h-16 sm:h-20">
          <!-- Logo -->
          <a href="#" @click.prevent="navigateTo('home')" class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span class="text-xl font-bold text-white">Cuspia</span>
          </a>

          <!-- Menu Desktop -->
          <div v-if="currentView === 'home'" class="hidden md:flex items-center gap-8">
            <a href="#funcionalidades" class="text-surface-400 hover:text-white transition-colors duration-200">Funcionalidades</a>
            <a href="#beneficios" class="text-surface-400 hover:text-white transition-colors duration-200">Beneficios</a>
            <a href="#testimonios" class="text-surface-400 hover:text-white transition-colors duration-200">Testimonios</a>
            <a href="#contacto" class="btn-primary !py-2.5 !px-5 !text-sm">Solicitar Demo</a>
          </div>
          
          <div v-else class="hidden md:flex items-center gap-8">
             <button @click="navigateTo('home')" class="text-surface-400 hover:text-white transition-colors duration-200">Volver al inicio</button>
          </div>

          <!-- Menu Mobile -->
          <button class="md:hidden p-2 text-surface-400 hover:text-white" aria-label="Menú">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content: Home -->
    <main v-if="currentView === 'home'">
      <HeroScroll />
      <PainPointsSection />
      <FeaturesSection />
      <BenefitsSection />
      <TestimonialsSection />
      <ContactSection />
    </main>

    <!-- Legal Pages -->
    <PrivacyPolicy v-else-if="currentView === 'privacy'" @back="navigateTo('home')" />
    <TermsOfService v-else-if="currentView === 'terms'" @back="navigateTo('home')" />
    <CookiePolicy v-else-if="currentView === 'cookies'" @back="navigateTo('home')" />
    <GdprPolicy v-else-if="currentView === 'gdpr'" @back="navigateTo('home')" />

    <FooterSection @navigate="navigateTo" />
  </div>
</template>
