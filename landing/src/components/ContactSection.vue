<script setup lang="ts">
import { ref } from 'vue'

const form = ref({
  name: '',
  email: '',
  phone: '',
  clinicName: '',
  message: ''
})

const isSubmitting = ref(false)
const isSubmitted = ref(false)

const handleSubmit = async () => {
  isSubmitting.value = true
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  isSubmitting.value = false
  isSubmitted.value = true
  
  // Reset form
  form.value = {
    name: '',
    email: '',
    phone: '',
    clinicName: '',
    message: ''
  }
}
</script>

<template>
  <section id="contacto" class="py-20 sm:py-28 bg-surface-950 relative overflow-hidden">
    <!-- Background Effects -->
    <div class="absolute inset-0">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
    </div>

    <div class="section-container relative z-10">
      <div class="grid lg:grid-cols-2 gap-12 lg:gap-20">
        <!-- Left: Info -->
        <div>
          <span class="inline-block px-4 py-1 text-sm font-medium text-primary-400 bg-primary-500/10 rounded-full mb-4">
            Contacto
          </span>
          <h2 class="section-title mb-6">
            Solicita tu <span class="gradient-text">demo gratuita</span>
          </h2>
          <p class="text-surface-400 text-lg mb-8 leading-relaxed">
            Completa el formulario y un especialista de Cuspia se pondrá en contacto contigo 
            en menos de 24 horas para mostrarte cómo puede transformar la gestión de tu clínica dental.
          </p>

          <!-- Benefits List -->
          <div class="space-y-4 mb-8">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-surface-300">Demo personalizada para tu clínica</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-surface-300">Sin compromiso de compra</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-surface-300">Respuesta en menos de 24h</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-surface-300">Soporte técnico en español</span>
            </div>
          </div>

          <!-- Contact Info -->
          <div class="glass-card p-6">
            <h3 class="font-semibold text-white mb-4">¿Prefieres contactarnos directamente?</h3>
            <div class="space-y-3">
              <a href="mailto:info@cuspia.es" class="flex items-center gap-3 text-surface-400 hover:text-primary-400 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>info@cuspia.es</span>
              </a>
              <a href="tel:+34900123456" class="flex items-center gap-3 text-surface-400 hover:text-primary-400 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>900 123 456 (Gratuito)</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Right: Form -->
        <div class="glass-card p-6 sm:p-8">
          <!-- Success Message -->
          <div v-if="isSubmitted" class="text-center py-12">
            <div class="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">¡Solicitud enviada!</h3>
            <p class="text-surface-400 mb-6">
              Nos pondremos en contacto contigo en menos de 24 horas.
            </p>
            <button 
              @click="isSubmitted = false"
              class="btn-secondary"
            >
              Enviar otra solicitud
            </button>
          </div>

          <!-- Form -->
          <form v-else @submit.prevent="handleSubmit" class="space-y-6">
            <div>
              <label for="name" class="input-label">Nombre completo *</label>
              <input 
                type="text" 
                id="name"
                v-model="form.name"
                required
                placeholder="Dr. Juan García"
                class="input-field"
              />
            </div>

            <div class="grid sm:grid-cols-2 gap-4">
              <div>
                <label for="email" class="input-label">Email *</label>
                <input 
                  type="email" 
                  id="email"
                  v-model="form.email"
                  required
                  placeholder="juan@clinica.es"
                  class="input-field"
                />
              </div>
              <div>
                <label for="phone" class="input-label">Teléfono</label>
                <input 
                  type="tel" 
                  id="phone"
                  v-model="form.phone"
                  placeholder="+34 600 000 000"
                  class="input-field"
                />
              </div>
            </div>

            <div>
              <label for="clinicName" class="input-label">Nombre de la clínica</label>
              <input 
                type="text" 
                id="clinicName"
                v-model="form.clinicName"
                placeholder="Clínica Dental Sonrisas"
                class="input-field"
              />
            </div>

            <div>
              <label for="message" class="input-label">Mensaje (opcional)</label>
              <textarea 
                id="message"
                v-model="form.message"
                rows="4"
                placeholder="Cuéntanos sobre tu clínica y qué necesidades tienes..."
                class="input-field resize-none"
              ></textarea>
            </div>

            <!-- Privacy Notice -->
            <p class="text-xs text-surface-500">
              Al enviar este formulario, aceptas nuestra 
              <a href="#" class="text-primary-400 hover:underline">política de privacidad</a>. 
              Tus datos serán tratados conforme al RGPD.
            </p>

            <button 
              type="submit"
              :disabled="isSubmitting"
              class="btn-primary w-full relative"
            >
              <span :class="{ 'opacity-0': isSubmitting }">
                Solicitar Demo Gratuita
              </span>
              <span 
                v-if="isSubmitting" 
                class="absolute inset-0 flex items-center justify-center"
              >
                <svg class="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
