<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/services/api'

// State
const route = useRoute()
const token = computed(() => route.params.token as string)

const loading = ref(true)
const submitting = ref(false)
const status = ref<'loading' | 'valid' | 'completed' | 'expired' | 'not_found' | 'submitted'>('loading')
const clinicName = ref('')
const rating = ref(0)
const hoverRating = ref(0)
const comment = ref('')
const errorMessage = ref('')

// Validate token on mount
onMounted(async () => {
    await validateToken()
})

const validateToken = async () => {
    loading.value = true
    try {
        const response = await api.get<{ data: { valid: boolean; status?: string; clinicName?: string; message?: string } }>(`/ratings/public/${token.value}`)
        const data = response.data

        if (data.valid) {
            status.value = 'valid'
            clinicName.value = data.clinicName || 'Clínica'
        } else {
            status.value = (data.status as typeof status.value) || 'not_found'
            errorMessage.value = data.message || ''
        }
    } catch (error: any) {
        console.error('Error validating token:', error)
        status.value = 'not_found'
        errorMessage.value = 'No pudimos encontrar tu enlace de valoración.'
    } finally {
        loading.value = false
    }
}

const submitRating = async () => {
    if (rating.value === 0) {
        errorMessage.value = 'Por favor, selecciona una valoración'
        return
    }

    submitting.value = true
    errorMessage.value = ''

    try {
        await api.post(`/ratings/public/${token.value}`, {
            rating: rating.value,
            comment: comment.value.trim() || undefined,
        })
        status.value = 'submitted'
    } catch (error: any) {
        console.error('Error submitting rating:', error)
        errorMessage.value = error.response?.data?.message || 'Error al enviar tu valoración'
    } finally {
        submitting.value = false
    }
}

const setRating = (value: number) => {
    rating.value = value
}

const getStarClass = (index: number) => {
    const currentRating = hoverRating.value || rating.value
    return index <= currentRating ? 'star-filled' : 'star-empty'
}
</script>

<template>
    <div class="rating-page">
        <div class="rating-container">
            <!-- Loading State -->
            <div v-if="loading" class="state-card loading-state">
                <div class="spinner"></div>
                <p>Cargando...</p>
            </div>

            <!-- Valid Token - Rating Form -->
            <div v-else-if="status === 'valid'" class="state-card rating-form">
                <div class="header">
                    <div class="stars-decoration">⭐⭐⭐⭐⭐</div>
                    <h1>¡Hola!</h1>
                    <p class="subtitle">¿Cómo fue tu visita en <strong>{{ clinicName }}</strong>?</p>
                </div>

                <div class="rating-section">
                    <p class="prompt">Tu opinión es muy importante para nosotros</p>
                    
                    <div class="stars-input">
                        <button
                            v-for="i in 5"
                            :key="i"
                            type="button"
                            :class="['star-btn', getStarClass(i)]"
                            @click="setRating(i)"
                            @mouseenter="hoverRating = i"
                            @mouseleave="hoverRating = 0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="star-icon">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                        </button>
                    </div>

                    <div class="rating-labels">
                        <span>Muy malo</span>
                        <span>Excelente</span>
                    </div>
                </div>

                <div class="comment-section">
                    <label for="comment">¿Algún comentario adicional? (opcional)</label>
                    <textarea
                        id="comment"
                        v-model="comment"
                        placeholder="Cuéntanos más sobre tu experiencia..."
                        rows="3"
                        maxlength="1000"
                    ></textarea>
                </div>

                <div v-if="errorMessage" class="error-message">
                    {{ errorMessage }}
                </div>

                <button
                    type="button"
                    class="submit-btn"
                    :disabled="rating === 0 || submitting"
                    @click="submitRating"
                >
                    <span v-if="submitting">Enviando...</span>
                    <span v-else>Enviar valoración</span>
                </button>

                <p class="privacy-note">
                    Tu valoración es anónima y nos ayuda a mejorar.
                </p>
            </div>

            <!-- Submitted Successfully -->
            <div v-else-if="status === 'submitted'" class="state-card success-state">
                <div class="success-icon">✓</div>
                <h1>¡Gracias!</h1>
                <p>Tu valoración ha sido enviada correctamente.</p>
                <p class="thank-you">Tu opinión nos ayuda a seguir mejorando.</p>
            </div>

            <!-- Already Completed -->
            <div v-else-if="status === 'completed'" class="state-card info-state">
                <div class="info-icon">✓</div>
                <h1>Ya valoraste esta visita</h1>
                <p>{{ errorMessage || 'Ya has enviado tu valoración. ¡Gracias por tu opinión!' }}</p>
            </div>

            <!-- Expired -->
            <div v-else-if="status === 'expired'" class="state-card warning-state">
                <div class="warning-icon">⏰</div>
                <h1>Enlace expirado</h1>
                <p>{{ errorMessage || 'Este enlace de valoración ha expirado. Los enlaces son válidos durante 7 días.' }}</p>
            </div>

            <!-- Not Found -->
            <div v-else class="state-card error-state">
                <div class="error-icon">✕</div>
                <h1>Enlace no válido</h1>
                <p>{{ errorMessage || 'No pudimos encontrar este enlace de valoración.' }}</p>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p>Sistema de valoración de visitas</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.rating-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}

.rating-container {
    width: 100%;
    max-width: 480px;
}

.state-card {
    background: white;
    border-radius: 16px;
    padding: 40px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    text-align: center;
}

/* Loading State */
.loading-state {
    padding: 60px 40px;
}

.spinner {
    width: 50px;
    height: 50px;
    border: 4px solid #e5e7eb;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Rating Form */
.rating-form .header {
    margin-bottom: 30px;
}

.stars-decoration {
    font-size: 32px;
    margin-bottom: 16px;
}

.rating-form h1 {
    font-size: 28px;
    color: #1a1a1a;
    margin: 0 0 8px;
}

.subtitle {
    color: #6b7280;
    font-size: 16px;
    margin: 0;
}

.subtitle strong {
    color: #1a1a1a;
}

/* Stars Rating */
.rating-section {
    margin: 30px 0;
}

.prompt {
    color: #374151;
    font-size: 14px;
    margin-bottom: 16px;
}

.stars-input {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 8px;
}

.star-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    transition: transform 0.15s ease;
}

.star-btn:hover {
    transform: scale(1.2);
}

.star-icon {
    width: 48px;
    height: 48px;
}

.star-filled {
    color: #fbbf24;
}

.star-empty {
    color: #d1d5db;
}

.rating-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #9ca3af;
    padding: 0 8px;
}

/* Comment Section */
.comment-section {
    margin: 24px 0;
    text-align: left;
}

.comment-section label {
    display: block;
    font-size: 14px;
    color: #374151;
    margin-bottom: 8px;
}

.comment-section textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    resize: vertical;
    font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.comment-section textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Error Message */
.error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 16px;
}

/* Submit Button */
.submit-btn {
    width: 100%;
    padding: 16px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.2s;
}

.submit-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
}

.submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.privacy-note {
    margin-top: 16px;
    font-size: 12px;
    color: #9ca3af;
}

/* Success State */
.success-state {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.success-icon {
    width: 80px;
    height: 80px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    margin: 0 auto 20px;
}

.success-state h1 {
    color: white;
    font-size: 32px;
    margin: 0 0 12px;
}

.success-state p {
    opacity: 0.9;
    margin: 0 0 8px;
}

.thank-you {
    font-size: 14px;
    opacity: 0.7;
}

/* Info State (Already Completed) */
.info-state {
    background: #f0f9ff;
}

.info-icon {
    width: 60px;
    height: 60px;
    background: #0ea5e9;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    margin: 0 auto 20px;
}

.info-state h1 {
    color: #0369a1;
    font-size: 24px;
}

.info-state p {
    color: #0c4a6e;
}

/* Warning State (Expired) */
.warning-state {
    background: #fffbeb;
}

.warning-icon {
    font-size: 48px;
    margin-bottom: 16px;
}

.warning-state h1 {
    color: #b45309;
    font-size: 24px;
}

.warning-state p {
    color: #78350f;
}

/* Error State (Not Found) */
.error-state {
    background: #fef2f2;
}

.error-icon {
    width: 60px;
    height: 60px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    margin: 0 auto 20px;
}

.error-state h1 {
    color: #b91c1c;
    font-size: 24px;
}

.error-state p {
    color: #7f1d1d;
}

/* Footer */
.footer {
    margin-top: 20px;
    text-align: center;
}

.footer p {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
}

/* Responsive */
@media (max-width: 480px) {
    .state-card {
        padding: 30px 20px;
    }

    .star-icon {
        width: 36px;
        height: 36px;
    }

    .rating-form h1 {
        font-size: 24px;
    }
}
</style>
