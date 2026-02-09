<script setup lang="ts">
import LegalLayout from './LegalLayout.vue'

defineEmits(['back'])
</script>

<template>
  <LegalLayout @back="$emit('back')">
    <h1>Política de Cookies</h1>
    <p>Última actualización: {{ new Date().toLocaleDateString('es-ES') }}</p>

    <h2>1. ¿Qué son las cookies?</h2>
    <p>
      Las cookies son pequeños archivos de texto que se almacenan en su dispositivo 
      cuando visita nuestra web.
    </p>

    <h2>2. Tipos de Cookies que utilizamos</h2>
    <ul>
      <li><strong>Cookies Técnicas:</strong> Necesarias para el funcionamiento de la web.</li>
      <li><strong>Cookies de Análisis:</strong> Nos ayudan a entender cómo interactúan los usuarios con la web.</li>
    </ul>

    <h2>3. Gestión de Cookies</h2>
    <p>
      Puede configurar su navegador para rechazar todas o algunas cookies.
    </p>
  </LegalLayout>
</template>
