<template>
  <!-- Notch container - only visible when there are active appointments -->
  <Transition name="notch">
    <div v-if="activeAppointmentsStore.activeCount > 0" class="notch-container">
      <div class="notch">
        <!-- Notch handle indicator -->
        <div class="notch-handle"></div>
        
        <!-- Active appointments list -->
        <div class="notch-content">
          <TransitionGroup name="chip" tag="div" class="chips-container">
            <button
              v-for="appointment in activeAppointmentsStore.appointments"
              :key="appointment.id"
              @click="router.push(`/clinic/patients/${appointment.patientId}`)"
              class="chip"
              :class="{
                'chip-paused': activeAppointmentsStore.isPaused(appointment),
                'chip-overtime': activeAppointmentsStore.isOvertime(appointment),
                'chip-active': !activeAppointmentsStore.isPaused(appointment) && !activeAppointmentsStore.isOvertime(appointment)
              }"
            >
              <!-- Animated status indicator -->
              <span class="status-dot">
                <span 
                  class="status-dot-inner"
                  :class="{
                    'bg-amber-400': activeAppointmentsStore.isPaused(appointment),
                    'bg-rose-500': activeAppointmentsStore.isOvertime(appointment),
                    'bg-emerald-500': !activeAppointmentsStore.isPaused(appointment) && !activeAppointmentsStore.isOvertime(appointment)
                  }"
                />
                <span 
                  class="status-dot-ping"
                  :class="{
                    'bg-amber-400': activeAppointmentsStore.isPaused(appointment),
                    'bg-rose-500': activeAppointmentsStore.isOvertime(appointment),
                    'bg-emerald-500': !activeAppointmentsStore.isPaused(appointment) && !activeAppointmentsStore.isOvertime(appointment)
                  }"
                />
              </span>
              
              <!-- Patient info -->
              <div class="chip-info">
                <span class="chip-name">{{ appointment.patient.firstName }} {{ appointment.patient.lastName.charAt(0) }}.</span>
                <span class="chip-timer" :class="{ 'text-rose-400': activeAppointmentsStore.isOvertime(appointment) }">
                  {{ formatTime(appointment) }}
                </span>
              </div>
            </button>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveAppointmentsStore, type ActiveAppointment } from '@/stores/activeAppointments'

const router = useRouter()

const activeAppointmentsStore = useActiveAppointmentsStore()

// Timer for updating display every second
const timerInterval = ref<number | null>(null)
const tick = ref(0)

function formatTime(appointment: ActiveAppointment): string {
  // Force reactivity with tick
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = tick.value
  
  if (!appointment.realStartTime) return '--:--'
  
  const startTime = new Date(appointment.realStartTime).getTime()
  const now = Date.now()
  const elapsedMs = now - startTime
  const pausedMs = (appointment.pausedDuration ?? 0) * 60000
  const activeMs = elapsedMs - pausedMs
  
  const totalSeconds = Math.floor(activeMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

onMounted(() => {
  // Timer for updating display every second (cosmetic only)
  // Note: Actual data loading is handled by polling in ClinicLayout
  timerInterval.value = window.setInterval(() => {
    tick.value++
  }, 1000)
})

onUnmounted(() => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
  }
})
</script>

<style scoped>
.notch-container {
  display: flex;
  justify-content: center;
  padding-top: 0.5rem;
}

.notch {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
  backdrop-filter: blur(20px);
  border-radius: 0 0 1.5rem 1.5rem;
  padding: 0.25rem 1rem 0.75rem 1rem;
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 10px 20px -5px rgba(0, 0, 0, 0.25),
    0 0 40px -10px rgba(99, 102, 241, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: none;
  min-width: 200px;
  max-width: 90vw;
}

.notch-handle {
  width: 3rem;
  height: 0.25rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  margin-bottom: 0.5rem;
}

.notch-content {
  width: 100%;
}

.chips-container {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: 1px solid transparent;
}

.chip:hover {
  transform: translateY(-1px);
}

.chip-active {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.3);
}

.chip-active:hover {
  background: rgba(16, 185, 129, 0.25);
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
}

.chip-paused {
  background: rgba(245, 158, 11, 0.15);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.3);
}

.chip-paused:hover {
  background: rgba(245, 158, 11, 0.25);
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);
}

.chip-overtime {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.3);
  animation: pulse-glow 2s ease-in-out infinite;
}

.chip-overtime:hover {
  background: rgba(239, 68, 68, 0.25);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(239, 68, 68, 0.2);
  }
  50% {
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
  }
}

.status-dot {
  position: relative;
  width: 0.5rem;
  height: 0.5rem;
  flex-shrink: 0;
}

.status-dot-inner {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
}

.status-dot-ping {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

.chip-info {
  display: flex;
  flex-direction: column;
  gap: 0;
  line-height: 1.2;
}

.chip-name {
  font-weight: 600;
  font-size: 0.75rem;
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-timer {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.6875rem;
  opacity: 0.8;
}

/* Notch enter/leave transitions */
.notch-enter-active,
.notch-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.notch-enter-from,
.notch-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

/* Chip transitions */
.chip-enter-active,
.chip-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.chip-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.chip-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-10px);
}

.chip-move {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .notch {
    border-radius: 0 0 1rem 1rem;
    padding: 0.25rem 0.75rem 0.5rem 0.75rem;
  }
  
  .chip {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
  
  .chip-name {
    max-width: 80px;
  }
}
</style>
