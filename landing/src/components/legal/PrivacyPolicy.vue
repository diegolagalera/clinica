<script setup lang="ts">
import LegalLayout from './LegalLayout.vue'

defineEmits(['back'])
</script>

<template>
  <LegalLayout @back="$emit('back')">
    <h1>Política de Privacidad</h1>
    <p>Última actualización: {{ new Date().toLocaleDateString('es-ES') }}</p>

    <h2>1. Responsable del Tratamiento</h2>
    <p>
      El responsable del tratamiento de sus datos es Cuspia. Puede contactarnos en 
      <a href="mailto:cuspiainfo@gmail.com" class="text-primary-400">cuspiainfo@gmail.com</a>.
    </p>

    <h2>2. Finalidad del Tratamiento</h2>
    <p>
      Tratamos sus datos para gestionar el servicio de software para clínicas dentales, 
      atender sus consultas y enviarle comunicaciones relacionadas con el servicio.
    </p>

    <h2>3. Legitimación</h2>
    <p>
      La base legal para el tratamiento de sus datos es la ejecución del contrato de servicio 
      y su consentimiento para el envío de comunicaciones.
    </p>

    <h2>4. Destinatarios</h2>
    <p>
      Sus datos no se cederán a terceros salvo obligación legal.
    </p>

    <h2>5. Derechos</h2>
    <p>
      Tiene derecho a acceder, rectificar y suprimir sus datos, así como otros derechos, 
      contactando con nosotros en la dirección indicada.
    </p>
  </LegalLayout>
</template>
