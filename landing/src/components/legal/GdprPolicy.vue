<script setup lang="ts">
import LegalLayout from './LegalLayout.vue'

defineEmits(['back'])
</script>

<template>
  <LegalLayout @back="$emit('back')">
    <h1>RGPD y Protección de Datos</h1>
    <p>Última actualización: {{ new Date().toLocaleDateString('es-ES') }}</p>

    <h2>Cumplimiento del RGPD</h2>
    <p>
      Cuspia cumple estrictamente con el Reglamento General de Protección de Datos (RGPD) 
      y la Ley Orgánica de Protección de Datos y Garantía de Derechos Digitales (LOPDGDD).
    </p>

    <h2>Sus Derechos ARCO</h2>
    <ul>
      <li><strong>Acceso:</strong> Saber qué datos tenemos sobre usted.</li>
      <li><strong>Rectificación:</strong> Corregir datos inexactos.</li>
      <li><strong>Cancelación (Supresión):</strong> Solicitar el borrado de sus datos ("derecho al olvido").</li>
      <li><strong>Oposición:</strong> Oponerse al tratamiento de sus datos.</li>
    </ul>

    <h2>Seguridad de los Datos</h2>
    <p>
      Implementamos medidas de seguridad técnicas y organizativas para proteger sus datos, 
      incluyendo encriptación y copias de seguridad.
    </p>
    
    <h2>Encargado del Tratamiento</h2>
    <p>
      Si usted es una clínica, actuamos como Encargado del Tratamiento de los datos de sus pacientes, 
      siguiendo sus instrucciones y garantizando la confidencialidad.
    </p>
  </LegalLayout>
</template>
