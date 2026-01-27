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
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'surfaceClick', surface: keyof ToothSurfaces): void
  (e: 'rootClick'): void
}>()

// Color map for conditions
const conditionColors: Record<DentalCondition, string> = {
  HEALTHY: '#FFFFFF',
  CARIES: '#EF4444',
  FILLING: '#3B82F6',
  CROWN: '#F59E0B',
  EXTRACTION_INDICATED: '#DC2626',
  MISSING: '#9CA3AF',
  IMPLANT: '#10B981',
  ROOT_CANAL: '#8B5CF6',
  FRACTURE: '#F97316',
  BRIDGE: '#06B6D4',
  VENEER: '#EC4899',
  SEALANT: '#84CC16',
}

const getSurfaceColor = (surface: keyof ToothSurfaces) => {
  return conditionColors[props.surfaces[surface]] || '#FFFFFF'
}

const rootColor = computed(() => {
  if (props.rootCondition) {
    return conditionColors[props.rootCondition] || '#FEF9E7'
  }
  return '#FEF9E7' // Cream/ivory for healthy root
})

const rootStroke = computed(() => {
  if (props.rootCondition === 'ROOT_CANAL') return '#8B5CF6'
  return '#D4A574' // Natural tooth root color
})

// Check if tooth is missing
const isMissing = computed(() => props.generalCondition === 'MISSING')

// Determine tooth type based on position
const toothType = computed(() => {
  const num = props.toothNumber
  const lastDigit = num % 10
  if (lastDigit >= 6) return 'molar'
  if (lastDigit >= 4) return 'premolar'
  if (lastDigit === 3) return 'canine'
  return 'incisor'
})

const showRootSection = computed(() => props.showRoot !== false)
</script>

<template>
  <div 
    class="tooth-container relative cursor-pointer transition-transform hover:scale-105"
    :class="{ 'selected': isSelected }"
    @click="emit('click')"
  >
    <!-- Upper teeth layout -->
    <template v-if="isUpper">
      <!-- Root section (above crown for upper teeth) -->
      <div v-if="showRootSection && !isMissing" class="root-section upper">
        <svg viewBox="0 0 40 32" class="root-svg">
          <!-- Molar: 3 roots -->
          <g v-if="toothType === 'molar'" class="root-group" @click.stop="emit('rootClick')">
            <!-- Palatal root (center, larger) -->
            <path 
              d="M 20 32 C 20 28, 18 20, 17 12 C 16 6, 18 2, 20 2 C 22 2, 24 6, 23 12 C 22 20, 20 28, 20 32"
              :fill="rootColor"
              :stroke="rootStroke"
              stroke-width="1"
              class="root-path"
            />
            <!-- Mesio-buccal root (left) -->
            <path 
              d="M 12 32 C 12 28, 10 22, 8 14 C 7 8, 8 3, 10 2 C 11 2, 12 6, 11 12 C 10 20, 12 28, 12 32"
              :fill="rootColor"
              :stroke="rootStroke"
              stroke-width="1"
              class="root-path"
            />
            <!-- Disto-buccal root (right) -->
            <path 
              d="M 28 32 C 28 28, 30 22, 32 14 C 33 8, 32 3, 30 2 C 29 2, 28 6, 29 12 C 30 20, 28 28, 28 32"
              :fill="rootColor"
              :stroke="rootStroke"
              stroke-width="1"
              class="root-path"
            />
            <!-- Root canal filling indicators -->
            <g v-if="rootCondition === 'ROOT_CANAL'" class="root-canal-indicator">
              <line x1="20" y1="28" x2="20" y2="6" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" opacity="0.8" />
              <line x1="10" y1="28" x2="9" y2="8" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
              <line x1="30" y1="28" x2="31" y2="8" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
            </g>
          </g>
          
          <!-- Premolar: 1-2 roots -->
          <g v-else-if="toothType === 'premolar'" class="root-group" @click.stop="emit('rootClick')">
            <path 
              d="M 20 32 C 20 26, 17 18, 16 10 C 15 4, 18 1, 20 1 C 22 1, 25 4, 24 10 C 23 18, 20 26, 20 32"
              :fill="rootColor"
              :stroke="rootStroke"
              stroke-width="1"
              class="root-path"
            />
            <line v-if="rootCondition === 'ROOT_CANAL'" x1="20" y1="28" x2="20" y2="5" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" opacity="0.8" />
          </g>
          
          <!-- Canine/Incisor: 1 root -->
          <g v-else class="root-group" @click.stop="emit('rootClick')">
            <path 
              d="M 20 32 C 20 26, 17 16, 16 8 C 15 3, 18 0, 20 0 C 22 0, 25 3, 24 8 C 23 16, 20 26, 20 32"
              :fill="rootColor"
              :stroke="rootStroke"
              stroke-width="1"
              class="root-path"
            />
            <line v-if="rootCondition === 'ROOT_CANAL'" x1="20" y1="28" x2="20" y2="4" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" opacity="0.8" />
          </g>
        </svg>
      </div>
      
      <!-- Crown -->
      <svg viewBox="0 0 50 50" class="crown-svg">
        <circle cx="25" cy="25" r="23" fill="none" stroke="#E5E7EB" stroke-width="2" />
        
        <!-- Occlusal -->
        <circle 
          cx="25" cy="25" r="10" 
          :fill="getSurfaceColor('occlusal')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'occlusal')"
        />
        
        <!-- Vestibular -->
        <path 
          d="M 25 2 A 23 23 0 0 1 48 25 L 35 25 A 10 10 0 0 0 25 15 L 25 2 Z"
          :fill="getSurfaceColor('vestibular')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'vestibular')"
        />
        
        <!-- Palatino -->
        <path 
          d="M 25 48 A 23 23 0 0 1 2 25 L 15 25 A 10 10 0 0 0 25 35 L 25 48 Z"
          :fill="getSurfaceColor('palatino')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'palatino')"
        />
        
        <!-- Mesial -->
        <path 
          d="M 2 25 A 23 23 0 0 1 25 2 L 25 15 A 10 10 0 0 0 15 25 L 2 25 Z"
          :fill="getSurfaceColor('mesial')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'mesial')"
        />
        
        <!-- Distal -->
        <path 
          d="M 48 25 A 23 23 0 0 1 25 48 L 25 35 A 10 10 0 0 0 35 25 L 48 25 Z"
          :fill="getSurfaceColor('distal')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'distal')"
        />
        
        <!-- Special indicators -->
        <g v-if="generalCondition === 'EXTRACTION_INDICATED'" class="extraction-x">
          <line x1="10" y1="10" x2="40" y2="40" stroke="#DC2626" stroke-width="3" stroke-linecap="round" />
          <line x1="40" y1="10" x2="10" y2="40" stroke="#DC2626" stroke-width="3" stroke-linecap="round" />
        </g>
        
        <g v-if="isMissing" class="missing-indicator">
          <line x1="5" y1="25" x2="45" y2="25" stroke="#6B7280" stroke-width="2" stroke-dasharray="6,3" />
        </g>
      </svg>
      
      <!-- Tooth number -->
      <div class="tooth-number">{{ toothNumber }}</div>
    </template>

    <!-- Lower teeth layout -->
    <template v-else>
      <!-- Tooth number -->
      <div class="tooth-number">{{ toothNumber }}</div>
      
      <!-- Crown -->
      <svg viewBox="0 0 50 50" class="crown-svg">
        <circle cx="25" cy="25" r="23" fill="none" stroke="#E5E7EB" stroke-width="2" />
        
        <circle 
          cx="25" cy="25" r="10" 
          :fill="getSurfaceColor('occlusal')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'occlusal')"
        />
        
        <!-- Vestibular (bottom for lower) -->
        <path 
          d="M 25 48 A 23 23 0 0 1 2 25 L 15 25 A 10 10 0 0 0 25 35 L 25 48 Z"
          :fill="getSurfaceColor('vestibular')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'vestibular')"
        />
        
        <!-- Lingual (top for lower) -->
        <path 
          d="M 25 2 A 23 23 0 0 1 48 25 L 35 25 A 10 10 0 0 0 25 15 L 25 2 Z"
          :fill="getSurfaceColor('palatino')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'palatino')"
        />
        
        <path 
          d="M 2 25 A 23 23 0 0 1 25 2 L 25 15 A 10 10 0 0 0 15 25 L 2 25 Z"
          :fill="getSurfaceColor('mesial')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'mesial')"
        />
        
        <path 
          d="M 48 25 A 23 23 0 0 1 25 48 L 25 35 A 10 10 0 0 0 35 25 L 48 25 Z"
          :fill="getSurfaceColor('distal')"
          stroke="#94A3B8"
          stroke-width="1"
          class="surface-area"
          @click.stop="emit('surfaceClick', 'distal')"
        />
        
        <g v-if="generalCondition === 'EXTRACTION_INDICATED'" class="extraction-x">
          <line x1="10" y1="10" x2="40" y2="40" stroke="#DC2626" stroke-width="3" stroke-linecap="round" />
          <line x1="40" y1="10" x2="10" y2="40" stroke="#DC2626" stroke-width="3" stroke-linecap="round" />
        </g>
        
        <g v-if="isMissing" class="missing-indicator">
          <line x1="5" y1="25" x2="45" y2="25" stroke="#6B7280" stroke-width="2" stroke-dasharray="6,3" />
        </g>
      </svg>
      
      <!-- Root section (below crown for lower teeth) -->
      <div v-if="showRootSection && !isMissing" class="root-section lower">
        <svg viewBox="0 0 40 32" class="root-svg">
          <!-- Molar: 2 roots for lower -->
          <g v-if="toothType === 'molar'" class="root-group" @click.stop="emit('rootClick')">
            <!-- Mesial root -->
            <path 
              d="M 14 0 C 14 4, 12 12, 10 20 C 9 26, 11 30, 13 31 C 14 31, 15 28, 14 22 C 13 14, 14 6, 14 0"
              :fill="rootColor"
              :stroke="rootStroke"
              stroke-width="1"
              class="root-path"
            />
            <!-- Distal root -->
            <path 
              d="M 26 0 C 26 4, 28 12, 30 20 C 31 26, 29 30, 27 31 C 26 31, 25 28, 26 22 C 27 14, 26 6, 26 0"
              :fill="rootColor"
              :stroke="rootStroke"
              stroke-width="1"
              class="root-path"
            />
            <g v-if="rootCondition === 'ROOT_CANAL'" class="root-canal-indicator">
              <line x1="12" y1="4" x2="11" y2="26" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
              <line x1="28" y1="4" x2="29" y2="26" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
            </g>
          </g>
          
          <!-- Premolar: 1 root -->
          <g v-else-if="toothType === 'premolar'" class="root-group" @click.stop="emit('rootClick')">
            <path 
              d="M 20 0 C 20 6, 17 14, 16 22 C 15 28, 18 31, 20 31 C 22 31, 25 28, 24 22 C 23 14, 20 6, 20 0"
              :fill="rootColor"
              :stroke="rootStroke"
              stroke-width="1"
              class="root-path"
            />
            <line v-if="rootCondition === 'ROOT_CANAL'" x1="20" y1="4" x2="20" y2="27" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" opacity="0.8" />
          </g>
          
          <!-- Canine/Incisor: 1 root -->
          <g v-else class="root-group" @click.stop="emit('rootClick')">
            <path 
              d="M 20 0 C 20 6, 17 14, 16 22 C 15 28, 18 32, 20 32 C 22 32, 25 28, 24 22 C 23 14, 20 6, 20 0"
              :fill="rootColor"
              :stroke="rootStroke"
              stroke-width="1"
              class="root-path"
            />
            <line v-if="rootCondition === 'ROOT_CANAL'" x1="20" y1="4" x2="20" y2="28" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" opacity="0.8" />
          </g>
        </svg>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tooth-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px;
}

.tooth-container.selected {
  background: rgba(59, 130, 246, 0.1);
  border-radius: 8px;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

.tooth-number {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-align: center;
  height: 14px;
  line-height: 14px;
}

.crown-svg {
  width: 40px;
  height: 40px;
}

@media (min-width: 768px) {
  .crown-svg {
    width: 48px;
    height: 48px;
  }
}

.root-section {
  display: flex;
  justify-content: center;
}

.root-svg {
  width: 32px;
  height: 26px;
}

@media (min-width: 768px) {
  .root-svg {
    width: 38px;
    height: 30px;
  }
}

.root-path {
  cursor: pointer;
  transition: all 0.15s ease;
}

.root-path:hover {
  filter: brightness(0.95);
}

.root-group {
  cursor: pointer;
}

.root-group:hover .root-path {
  stroke-width: 1.5;
}

.surface-area {
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.surface-area:hover {
  opacity: 0.8;
}
</style>
