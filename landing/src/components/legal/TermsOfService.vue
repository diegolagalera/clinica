<script setup lang="ts">
import LegalLayout from './LegalLayout.vue'

defineEmits(['back'])
</script>

<template>
  <LegalLayout @back="$emit('back')">
    <h1>Términos de Servicio</h1>
    <p>Última actualización: {{ new Date().toLocaleDateString('es-ES') }}</p>

    <h2>1. Aceptación de los Términos</h2>
    <p>
      Al acceder y utilizar Cuspia, usted acepta cumplir con estos términos de servicio.
    </p>

    <h2>2. Descripción del Servicio</h2>
    <p>
      Cuspia proporciona un software de gestión en la nube para clínicas dentales (SaaS).
    </p>

    <h2>3. Registro y Seguridad</h2>
    <p>
      Usted es responsable de mantener la confidencialidad de sus credenciales de acceso 
      y de toda la actividad que ocurra bajo su cuenta.
    </p>

    <h2>4. Pagos y Suscripciones</h2>
    <p>
      El servicio se ofrece bajo un modelo de suscripción. Los precios y condiciones 
      están detallados en nuestra propuesta comercial.
    </p>

    <h2>5. Propiedad Intelectual</h2>
    <p>
      Todo el contenido y software de Cuspia es propiedad exclusiva de la empresa y está 
      protegido por las leyes de propiedad intelectual.
    </p>

    <h2>6. Limitación de Responsabilidad</h2>
    <p>
      Cuspia no será responsable de daños indirectos o consecuentes derivados del uso 
      del servicio.
    </p>
  </LegalLayout>
</template>
