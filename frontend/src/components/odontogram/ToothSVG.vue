<script setup lang="ts">
import { computed } from 'vue'
import type { DentalCondition, ToothSurfaces } from '@/types'

const props = defineProps<{
  toothNumber: number
  generalCondition: DentalCondition
  surfaces: ToothSurfaces
  rootCondition?: DentalCondition
  isSelected: boolean
  isUpper: boolean
  showRoot?: boolean
  colorOverrides?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'surfaceClick', surface: keyof ToothSurfaces): void
  (e: 'rootClick'): void
}>()

// Default color palette
const defaultColors: Record<DentalCondition, string> = {
  HEALTHY: '#F8FAFC',
  CARIES: '#E11D48',
  FILLING: '#2563EB',
  TEMPORARY_FILLING: '#7DD3FC',
  CROWN: '#F59E0B',
  EXTRACTION_INDICATED: '#B91C1C',
  MISSING: '#CBD5E1',
  IMPLANT: '#059669',
  ROOT_CANAL: '#7C3AED',
  FRACTURE: '#EA580C',
  BRIDGE: '#0891B2',
  VENEER: '#DB2777',
  SEALANT: '#65A30D',
  EROSION: '#D97706',
  ABRASION: '#92400E',
  PERIAPICAL_LESION: '#DC2626',
  ROOT_RESORPTION: '#C2410C',
  ROOT_FRACTURE: '#991B1B',
}

// Merge defaults with clinic overrides
const conditionColors = computed<Record<DentalCondition, string>>(() => {
  if (!props.colorOverrides || Object.keys(props.colorOverrides).length === 0) {
    return defaultColors
  }
  return { ...defaultColors, ...props.colorOverrides } as Record<DentalCondition, string>
})

const getSurfaceColor = (surface: keyof ToothSurfaces) => {
  const cond = props.surfaces[surface]
  return cond === 'HEALTHY' ? '#F8FAFC' : (conditionColors.value[cond] || '#F8FAFC')
}

const getSurfaceStroke = (surface: keyof ToothSurfaces) => {
  const cond = props.surfaces[surface]
  return cond === 'HEALTHY' ? '#CBD5E1' : conditionColors.value[cond] || '#CBD5E1'
}

const rootFill = computed(() => {
  const rc = props.rootCondition
  if (rc && rc !== 'HEALTHY') return conditionColors.value[rc] + '30'
  return '#FEF3C7'
})

const rootStroke = computed(() => {
  const rc = props.rootCondition
  if (rc && rc !== 'HEALTHY') return conditionColors.value[rc]
  return '#D4A574'
})

const hasRootCondition = computed(() => props.rootCondition && props.rootCondition !== 'HEALTHY')
const isMissing = computed(() => props.generalCondition === 'MISSING')
const showRootSection = computed(() => props.showRoot !== false)

const toothType = computed(() => {
  const lastDigit = props.toothNumber % 10
  if (lastDigit >= 6) return 'molar'
  if (lastDigit >= 4) return 'premolar'
  if (lastDigit === 3) return 'canine'
  return 'incisor'
})

// Tooltip text
const tooltipText = computed(() => {
  const parts = [`Diente ${props.toothNumber}`]
  if (props.generalCondition !== 'HEALTHY') {
    const labels: Record<string, string> = {
      CARIES: 'Caries', FILLING: 'Obturación', TEMPORARY_FILLING: 'Obt. temporal',
      CROWN: 'Corona', EXTRACTION_INDICATED: 'Extracción indicada', MISSING: 'Ausente',
      IMPLANT: 'Implante', ROOT_CANAL: 'Endodoncia', FRACTURE: 'Fractura',
      BRIDGE: 'Puente', VENEER: 'Carilla', SEALANT: 'Sellante',
      EROSION: 'Erosión', ABRASION: 'Abrasión',
    }
    parts.push(labels[props.generalCondition] || props.generalCondition)
  }
  return parts.join(' — ')
})
</script>

<template>
  <div 
    class="tooth-unit"
    :class="{ 'is-selected': isSelected, 'is-missing': isMissing }"
    :title="tooltipText"
    @click="emit('click')"
  >
    <!-- Upper teeth: root → crown → number -->
    <template v-if="isUpper">
      <!-- Root (top for upper) -->
      <div 
        v-if="showRootSection && !isMissing" 
        class="root-zone"
        :class="{ 'has-cond': hasRootCondition }"
        @click.stop="emit('rootClick')"
      >
        <svg :viewBox="toothType === 'molar' ? '0 0 60 50' : '0 0 60 50'" class="root-graphic" preserveAspectRatio="xMidYMax meet">
          <!-- Molar: 3 roots (wider, anatomical) -->
          <g v-if="toothType === 'molar'">
            <!-- Left buccal root -->
            <path 
              d="M 8 50 Q 8 40 7 28 Q 5 16 7 6 Q 9 1 11 1 Q 14 6 13 16 Q 12 28 12 50"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <!-- Palatal root (center, longer) -->
            <path 
              d="M 25 50 Q 26 38 27 24 Q 28 12 30 3 Q 32 12 33 24 Q 34 38 35 50"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <!-- Right buccal root -->
            <path 
              d="M 48 50 Q 48 40 49 28 Q 51 16 49 6 Q 47 1 45 1 Q 43 6 44 16 Q 46 28 48 50"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <!-- Root canal lines -->
            <g v-if="rootCondition === 'ROOT_CANAL'">
              <line x1="10" y1="44" x2="9" y2="8" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
              <line x1="30" y1="44" x2="30" y2="8" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
              <line x1="47" y1="44" x2="48" y2="8" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
            </g>
            <!-- Periapical -->
            <g v-if="rootCondition === 'PERIAPICAL_LESION'">
              <circle cx="10" cy="3" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
              <circle cx="30" cy="3" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
              <circle cx="47" cy="3" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
            </g>
            <!-- Resorption waves -->
            <g v-if="rootCondition === 'ROOT_RESORPTION'">
              <path d="M 6 6 Q 10 12 14 6" fill="none" stroke="#C2410C" stroke-width="1.4"/>
              <path d="M 26 5 Q 30 11 34 5" fill="none" stroke="#C2410C" stroke-width="1.4"/>
              <path d="M 43 6 Q 47 12 51 6" fill="none" stroke="#C2410C" stroke-width="1.4"/>
            </g>
          </g>
          <!-- Premolar: 2 separate roots -->
          <g v-else-if="toothType === 'premolar'">
            <path 
              d="M 21 50 Q 21 38 19 24 Q 17 12 20 3 Q 23 3 24 12 Q 23 24 23 50"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <path 
              d="M 37 50 Q 37 38 39 24 Q 41 12 38 3 Q 35 3 34 12 Q 36 24 37 50"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <g v-if="rootCondition === 'ROOT_CANAL'">
              <line x1="22" y1="44" x2="21" y2="8" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
              <line x1="37" y1="44" x2="39" y2="8" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
            </g>
            <g v-if="rootCondition === 'PERIAPICAL_LESION'">
              <circle cx="21" cy="4" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
              <circle cx="38" cy="4" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
            </g>
          </g>
          <!-- Canine: 1 thick long root -->
          <g v-else-if="toothType === 'canine'">
            <path 
              d="M 24 50 Q 24 36 22 22 Q 20 10 23 2 Q 26 0 30 2 Q 33 0 36 2 Q 39 10 37 22 Q 35 36 35 50"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <line v-if="rootCondition === 'ROOT_CANAL'" x1="30" y1="44" x2="30" y2="6" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
            <circle v-if="rootCondition === 'PERIAPICAL_LESION'" cx="30" cy="3" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
          </g>
          <!-- Incisor: 1 root (slightly thinner than canine) -->
          <g v-else>
            <path 
              d="M 25 50 Q 25 36 23 22 Q 22 12 25 3 Q 28 0 30 0 Q 32 0 35 3 Q 38 12 37 22 Q 35 36 35 50"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <line v-if="rootCondition === 'ROOT_CANAL'" x1="30" y1="44" x2="30" y2="6" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
            <circle v-if="rootCondition === 'PERIAPICAL_LESION'" cx="30" cy="3" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
          </g>
          <!-- Root fracture X (universal) -->
          <g v-if="rootCondition === 'ROOT_FRACTURE'">
            <line :x1="toothType === 'molar' ? 6 : 18" y1="20" :x2="toothType === 'molar' ? 52 : 42" y2="28" stroke="#991B1B" stroke-width="2" stroke-linecap="round"/>
            <line :x1="toothType === 'molar' ? 6 : 18" y1="28" :x2="toothType === 'molar' ? 52 : 42" y2="20" stroke="#991B1B" stroke-width="2" stroke-linecap="round"/>
          </g>
        </svg>
      </div>

      <!-- Crown (concentric circle diagram) -->
      <svg viewBox="0 0 44 44" class="crown-diagram">
        <!-- Outer ring = border -->
        <circle cx="22" cy="22" r="20" fill="none" :stroke="isSelected ? '#3B82F6' : '#CBD5E1'" :stroke-width="isSelected ? '2' : '1.2'" />
        
        <!-- Vestibular (top arc) -->
        <path 
          d="M 22 2 A 20 20 0 0 1 42 22 L 31 22 A 9 9 0 0 0 22 13 Z"
          :fill="getSurfaceColor('vestibular')" :stroke="getSurfaceStroke('vestibular')" stroke-width="0.8"
          class="sfc" @click.stop="emit('surfaceClick', 'vestibular')"
        />
        <!-- Distal (right arc) -->
        <path 
          d="M 42 22 A 20 20 0 0 1 22 42 L 22 31 A 9 9 0 0 0 31 22 Z"
          :fill="getSurfaceColor('distal')" :stroke="getSurfaceStroke('distal')" stroke-width="0.8"
          class="sfc" @click.stop="emit('surfaceClick', 'distal')"
        />
        <!-- Palatino (bottom arc) -->
        <path 
          d="M 22 42 A 20 20 0 0 1 2 22 L 13 22 A 9 9 0 0 0 22 31 Z"
          :fill="getSurfaceColor('palatino')" :stroke="getSurfaceStroke('palatino')" stroke-width="0.8"
          class="sfc" @click.stop="emit('surfaceClick', 'palatino')"
        />
        <!-- Mesial (left arc) -->
        <path 
          d="M 2 22 A 20 20 0 0 1 22 2 L 22 13 A 9 9 0 0 0 13 22 Z"
          :fill="getSurfaceColor('mesial')" :stroke="getSurfaceStroke('mesial')" stroke-width="0.8"
          class="sfc" @click.stop="emit('surfaceClick', 'mesial')"
        />
        <!-- Occlusal (center circle) -->
        <circle cx="22" cy="22" r="9" :fill="getSurfaceColor('occlusal')" :stroke="getSurfaceStroke('occlusal')" stroke-width="0.8" class="sfc" @click.stop="emit('surfaceClick', 'occlusal')" />
        
        <!-- Overlays for special conditions -->
        <g v-if="generalCondition === 'EXTRACTION_INDICATED'">
          <line x1="8" y1="8" x2="36" y2="36" stroke="#B91C1C" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
          <line x1="36" y1="8" x2="8" y2="36" stroke="#B91C1C" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
        </g>
        <g v-if="isMissing">
          <line x1="4" y1="22" x2="40" y2="22" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="4,3" />
        </g>
        <g v-if="generalCondition === 'IMPLANT'">
          <line x1="22" y1="10" x2="22" y2="34" stroke="#059669" stroke-width="2" stroke-linecap="round"/>
          <line x1="15" y1="13" x2="29" y2="13" stroke="#059669" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="16" y1="18" x2="28" y2="18" stroke="#059669" stroke-width="1" stroke-linecap="round" opacity="0.6"/>
        </g>
      </svg>

      <!-- Tooth number label -->
      <div class="tooth-num">{{ toothNumber }}</div>
    </template>

    <!-- Lower teeth: number → crown → root -->
    <template v-else>
      <div class="tooth-num">{{ toothNumber }}</div>

      <!-- Crown -->
      <svg viewBox="0 0 44 44" class="crown-diagram">
        <circle cx="22" cy="22" r="20" fill="none" :stroke="isSelected ? '#3B82F6' : '#CBD5E1'" :stroke-width="isSelected ? '2' : '1.2'" />
        
        <!-- Vestibular (bottom for lower) -->
        <path 
          d="M 22 42 A 20 20 0 0 1 2 22 L 13 22 A 9 9 0 0 0 22 31 Z"
          :fill="getSurfaceColor('vestibular')" :stroke="getSurfaceStroke('vestibular')" stroke-width="0.8"
          class="sfc" @click.stop="emit('surfaceClick', 'vestibular')"
        />
        <!-- Distal (right) -->
        <path 
          d="M 42 22 A 20 20 0 0 1 22 42 L 22 31 A 9 9 0 0 0 31 22 Z"
          :fill="getSurfaceColor('distal')" :stroke="getSurfaceStroke('distal')" stroke-width="0.8"
          class="sfc" @click.stop="emit('surfaceClick', 'distal')"
        />
        <!-- Lingual (top for lower) -->
        <path 
          d="M 22 2 A 20 20 0 0 1 42 22 L 31 22 A 9 9 0 0 0 22 13 Z"
          :fill="getSurfaceColor('palatino')" :stroke="getSurfaceStroke('palatino')" stroke-width="0.8"
          class="sfc" @click.stop="emit('surfaceClick', 'palatino')"
        />
        <!-- Mesial -->
        <path 
          d="M 2 22 A 20 20 0 0 1 22 2 L 22 13 A 9 9 0 0 0 13 22 Z"
          :fill="getSurfaceColor('mesial')" :stroke="getSurfaceStroke('mesial')" stroke-width="0.8"
          class="sfc" @click.stop="emit('surfaceClick', 'mesial')"
        />
        <!-- Occlusal -->
        <circle cx="22" cy="22" r="9" :fill="getSurfaceColor('occlusal')" :stroke="getSurfaceStroke('occlusal')" stroke-width="0.8" class="sfc" @click.stop="emit('surfaceClick', 'occlusal')" />
        
        <g v-if="generalCondition === 'EXTRACTION_INDICATED'">
          <line x1="8" y1="8" x2="36" y2="36" stroke="#B91C1C" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
          <line x1="36" y1="8" x2="8" y2="36" stroke="#B91C1C" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
        </g>
        <g v-if="isMissing">
          <line x1="4" y1="22" x2="40" y2="22" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="4,3" />
        </g>
        <g v-if="generalCondition === 'IMPLANT'">
          <line x1="22" y1="10" x2="22" y2="34" stroke="#059669" stroke-width="2" stroke-linecap="round"/>
          <line x1="15" y1="13" x2="29" y2="13" stroke="#059669" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="16" y1="18" x2="28" y2="18" stroke="#059669" stroke-width="1" stroke-linecap="round" opacity="0.6"/>
        </g>
      </svg>

      <!-- Root (below for lower) -->
      <div 
        v-if="showRootSection && !isMissing" 
        class="root-zone"
        :class="{ 'has-cond': hasRootCondition }"
        @click.stop="emit('rootClick')"
      >
        <svg :viewBox="toothType === 'molar' ? '0 0 60 50' : '0 0 60 50'" class="root-graphic" preserveAspectRatio="xMidYMin meet">
          <!-- Lower molar: 2 roots (wider) -->
          <g v-if="toothType === 'molar'">
            <path 
              d="M 16 0 Q 16 12 14 24 Q 12 34 14 44 Q 16 49 18 49 Q 21 44 20 34 Q 19 24 18 0"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <path 
              d="M 42 0 Q 42 12 44 24 Q 46 34 44 44 Q 42 49 40 49 Q 37 44 38 34 Q 40 24 42 0"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <g v-if="rootCondition === 'ROOT_CANAL'">
              <line x1="17" y1="6" x2="16" y2="42" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
              <line x1="41" y1="6" x2="43" y2="42" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
            </g>
            <g v-if="rootCondition === 'PERIAPICAL_LESION'">
              <circle cx="16" cy="47" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
              <circle cx="43" cy="47" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
            </g>
            <g v-if="rootCondition === 'ROOT_RESORPTION'">
              <path d="M 13 43 Q 17 48 21 43" fill="none" stroke="#C2410C" stroke-width="1.4"/>
              <path d="M 38 43 Q 42 48 46 43" fill="none" stroke="#C2410C" stroke-width="1.4"/>
            </g>
          </g>
          <!-- Premolar: 1 root -->
          <g v-else-if="toothType === 'premolar'">
            <path 
              d="M 25 0 Q 25 14 23 26 Q 21 36 24 46 Q 27 50 30 50 Q 33 50 36 46 Q 39 36 37 26 Q 35 14 35 0"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <line v-if="rootCondition === 'ROOT_CANAL'" x1="30" y1="6" x2="30" y2="44" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
            <circle v-if="rootCondition === 'PERIAPICAL_LESION'" cx="30" cy="47" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
          </g>
          <!-- Canine -->
          <g v-else-if="toothType === 'canine'">
            <path 
              d="M 24 0 Q 24 14 22 26 Q 20 38 23 46 Q 26 50 30 48 Q 33 50 36 46 Q 39 38 37 26 Q 35 14 35 0"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <line v-if="rootCondition === 'ROOT_CANAL'" x1="30" y1="6" x2="30" y2="44" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
            <circle v-if="rootCondition === 'PERIAPICAL_LESION'" cx="30" cy="47" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
          </g>
          <!-- Incisor -->
          <g v-else>
            <path 
              d="M 25 0 Q 25 14 23 26 Q 22 36 25 46 Q 28 50 30 50 Q 32 50 35 46 Q 38 36 37 26 Q 35 14 35 0"
              :fill="rootFill" :stroke="rootStroke" stroke-width="1.2" stroke-linejoin="round"
            />
            <line v-if="rootCondition === 'ROOT_CANAL'" x1="30" y1="6" x2="30" y2="44" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
            <circle v-if="rootCondition === 'PERIAPICAL_LESION'" cx="30" cy="47" r="4" fill="none" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="2,1.5" opacity="0.9"/>
          </g>
          <!-- Root fracture X -->
          <g v-if="rootCondition === 'ROOT_FRACTURE'">
            <line :x1="toothType === 'molar' ? 10 : 18" y1="20" :x2="toothType === 'molar' ? 48 : 42" y2="28" stroke="#991B1B" stroke-width="2" stroke-linecap="round"/>
            <line :x1="toothType === 'molar' ? 10 : 18" y1="28" :x2="toothType === 'molar' ? 48 : 42" y2="20" stroke="#991B1B" stroke-width="2" stroke-linecap="round"/>
          </g>
        </svg>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tooth-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 2px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  min-width: 0;
}

.tooth-unit:hover {
  background: #EFF6FF;
}

.tooth-unit.is-selected {
  background: #DBEAFE;
  box-shadow: 0 0 0 2px #3B82F6;
}

.tooth-unit.is-missing {
  opacity: 0.5;
}

.tooth-num {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  text-align: center;
  line-height: 16px;
  height: 16px;
  letter-spacing: 0.3px;
  user-select: none;
}

.crown-diagram {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .crown-diagram {
    width: 60px;
    height: 60px;
  }
}

.sfc {
  cursor: pointer;
  transition: opacity 0.12s ease;
}

.sfc:hover {
  opacity: 0.65;
}

.root-zone {
  display: flex;
  justify-content: center;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.12s ease;
}

.root-zone:hover {
  background: rgba(124, 58, 237, 0.06);
}

.root-zone.has-cond {
  background: rgba(220, 38, 38, 0.04);
}

.root-graphic {
  width: 44px;
  height: 38px;
}

@media (min-width: 768px) {
  .root-graphic {
    width: 60px;
    height: 48px;
  }
}
</style>
