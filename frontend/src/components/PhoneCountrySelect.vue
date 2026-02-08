<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

// Country codes list (comprehensive)
const countryCodes = [
  { code: '+34', country: 'ES', name: 'España', flag: '🇪🇸' },
  { code: '+33', country: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: '+351', country: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: '+44', country: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  { code: '+49', country: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: '+39', country: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: '+212', country: 'MA', name: 'Marruecos', flag: '🇲🇦' },
  { code: '+1', country: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+52', country: 'MX', name: 'México', flag: '🇲🇽' },
  { code: '+54', country: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: '+51', country: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: '+55', country: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: '+41', country: 'CH', name: 'Suiza', flag: '🇨🇭' },
  { code: '+31', country: 'NL', name: 'Países Bajos', flag: '🇳🇱' },
  { code: '+32', country: 'BE', name: 'Bélgica', flag: '🇧🇪' },
  { code: '+43', country: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: '+48', country: 'PL', name: 'Polonia', flag: '🇵🇱' },
  { code: '+46', country: 'SE', name: 'Suecia', flag: '🇸🇪' },
  { code: '+47', country: 'NO', name: 'Noruega', flag: '🇳🇴' },
  { code: '+45', country: 'DK', name: 'Dinamarca', flag: '🇩🇰' },
  { code: '+358', country: 'FI', name: 'Finlandia', flag: '🇫🇮' },
  { code: '+353', country: 'IE', name: 'Irlanda', flag: '🇮🇪' },
  { code: '+30', country: 'GR', name: 'Grecia', flag: '🇬🇷' },
  { code: '+420', country: 'CZ', name: 'República Checa', flag: '🇨🇿' },
  { code: '+36', country: 'HU', name: 'Hungría', flag: '🇭🇺' },
  { code: '+40', country: 'RO', name: 'Rumanía', flag: '🇷🇴' },
  { code: '+380', country: 'UA', name: 'Ucrania', flag: '🇺🇦' },
  { code: '+7', country: 'RU', name: 'Rusia', flag: '🇷🇺' },
  { code: '+81', country: 'JP', name: 'Japón', flag: '🇯🇵' },
  { code: '+86', country: 'CN', name: 'China', flag: '🇨🇳' },
  { code: '+82', country: 'KR', name: 'Corea del Sur', flag: '🇰🇷' },
  { code: '+91', country: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+61', country: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: '+64', country: 'NZ', name: 'Nueva Zelanda', flag: '🇳🇿' },
  { code: '+27', country: 'ZA', name: 'Sudáfrica', flag: '🇿🇦' },
  { code: '+20', country: 'EG', name: 'Egipto', flag: '🇪🇬' },
  { code: '+971', country: 'AE', name: 'Emiratos Árabes', flag: '🇦🇪' },
  { code: '+966', country: 'SA', name: 'Arabia Saudí', flag: '🇸🇦' },
  { code: '+972', country: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: '+90', country: 'TR', name: 'Turquía', flag: '🇹🇷' },
  { code: '+593', country: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: '+58', country: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: '+506', country: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: '+507', country: 'PA', name: 'Panamá', flag: '🇵🇦' },
  { code: '+502', country: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  { code: '+503', country: 'SV', name: 'El Salvador', flag: '🇸🇻' },
  { code: '+504', country: 'HN', name: 'Honduras', flag: '🇭🇳' },
  { code: '+505', country: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
  { code: '+591', country: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: '+595', country: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', country: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: '+53', country: 'CU', name: 'Cuba', flag: '🇨🇺' },
  { code: '+1809', country: 'DO', name: 'República Dominicana', flag: '🇩🇴' },
]

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const dropdownRef = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const selectedCountry = computed(() => 
  countryCodes.find(c => c.code === props.modelValue) || countryCodes[0]
)

const filteredCountries = computed(() => {
  if (!searchQuery.value) return countryCodes
  const query = searchQuery.value.toLowerCase()
  return countryCodes.filter(c => 
    c.name.toLowerCase().includes(query) ||
    c.code.includes(query) ||
    c.country.toLowerCase().includes(query)
  )
})

function selectCountry(code: string) {
  emit('update:modelValue', code)
  isOpen.value = false
  searchQuery.value = ''
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
    searchQuery.value = ''
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('click', handleClickOutside)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="containerRef" class="relative">
    <!-- Selected value button -->
    <button
      type="button"
      @click.stop="isOpen = !isOpen"
      class="input w-28 flex items-center justify-between gap-1 cursor-pointer"
    >
      <span class="flex items-center gap-1 truncate">
        <span>{{ selectedCountry.flag }}</span>
        <span class="text-sm">{{ selectedCountry.code }}</span>
      </span>
      <ChevronDownIcon class="w-4 h-4 text-surface-400 shrink-0" :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- Dropdown -->
    <Teleport to="body">
      <div 
        v-if="isOpen"
        ref="dropdownRef"
        class="fixed z-[9999] bg-white rounded-xl shadow-xl border border-surface-200 w-64 overflow-hidden"
        :style="{
          top: containerRef ? `${containerRef.getBoundingClientRect().bottom + 4}px` : '0',
          left: containerRef ? `${containerRef.getBoundingClientRect().left}px` : '0',
        }"
      >
        <!-- Search input -->
        <div class="p-2 border-b border-surface-100">
          <div class="relative">
            <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar país..."
              class="w-full pl-8 pr-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              @click.stop
            />
          </div>
        </div>

        <!-- Countries list with scroll -->
        <div class="max-h-48 overflow-y-auto">
          <button
            v-for="country in filteredCountries"
            :key="country.code"
            type="button"
            @click="selectCountry(country.code)"
            class="w-full px-3 py-2 text-left text-sm hover:bg-surface-50 flex items-center gap-2 transition-colors"
            :class="{ 'bg-primary-50 text-primary-700': country.code === modelValue }"
          >
            <span class="text-base">{{ country.flag }}</span>
            <span class="font-medium">{{ country.code }}</span>
            <span class="text-surface-500 truncate">{{ country.name }}</span>
          </button>
          <div v-if="filteredCountries.length === 0" class="px-3 py-4 text-sm text-surface-400 text-center">
            No se encontraron resultados
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
