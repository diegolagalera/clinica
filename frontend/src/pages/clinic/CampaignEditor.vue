<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowPathIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline';
import { 
    getMarketingTemplates,
    getAudienceSegments,
    getMarketingCampaign,
    createMarketingCampaign,
    updateMarketingCampaign,
    sendMarketingCampaign,
    type MarketingTemplate,
    type AudienceSegment,
    type MarketingCampaign,
} from '../../services/marketing';
import { toast } from '../../composables/useToast';

const router = useRouter();
const route = useRoute();

const campaignId = ref<string | null>(route.params.id as string || null);
const isEditMode = ref(!!campaignId.value);
const loading = ref(true);
const saving = ref(false);
const sending = ref(false);

// Form data
const name = ref('');
const subject = ref('');
const templateId = ref<string | null>(null);
const segmentId = ref<string | null>(null);
const scheduledAt = ref<string | null>(null);
const status = ref<MarketingCampaign['status']>('DRAFT');

// Resources
const templates = ref<MarketingTemplate[]>([]);
const segments = ref<AudienceSegment[]>([]);

const selectedTemplate = computed(() => 
    templates.value.find(t => t.id === templateId.value)
);

const selectedSegment = computed(() => 
    segments.value.find(s => s.id === segmentId.value)
);

const canSend = computed(() => 
    name.value.trim() && 
    subject.value.trim() && 
    templateId.value && 
    segmentId.value &&
    status.value === 'DRAFT'
);

const canSchedule = computed(() => 
    canSend.value && scheduledAt.value
);

const loadResources = async () => {
    try {
        const [templatesData, segmentsData] = await Promise.all([
            getMarketingTemplates(),
            getAudienceSegments(),
        ]);
        templates.value = templatesData;
        segments.value = segmentsData;
    } catch (error: any) {
        toast.error('Error al cargar recursos');
    }
};

const loadCampaign = async () => {
    if (!campaignId.value) {
        loading.value = false;
        return;
    }

    try {
        const campaign = await getMarketingCampaign(campaignId.value);
        name.value = campaign.name;
        subject.value = campaign.subject;
        templateId.value = campaign.templateId;
        segmentId.value = campaign.segmentId;
        scheduledAt.value = campaign.scheduledAt || null;
        status.value = campaign.status;
    } catch (error: any) {
        toast.error('Error al cargar campaña');
        router.push('/clinic/marketing');
    } finally {
        loading.value = false;
    }
};

const handleSave = async () => {
    if (!name.value.trim()) {
        toast.error('El nombre es requerido');
        return;
    }

    saving.value = true;

    try {
        const campaignData = {
            name: name.value,
            subject: subject.value,
            templateId: templateId.value,
            segmentId: segmentId.value,
            scheduledAt: scheduledAt.value || undefined,
        };

        if (isEditMode.value && campaignId.value) {
            await updateMarketingCampaign(campaignId.value, campaignData);
            toast.success('Campaña actualizada');
        } else {
            const newCampaign = await createMarketingCampaign(campaignData);
            campaignId.value = newCampaign.id;
            isEditMode.value = true;
            toast.success('Campaña creada');
        }
    } catch (error: any) {
        toast.error('Error al guardar campaña');
    } finally {
        saving.value = false;
    }
};

const handleSend = async () => {
    if (!canSend.value) return;
    
    if (!campaignId.value) {
        await handleSave();
    }

    if (!campaignId.value) return;

    sending.value = true;
    try {
        await sendMarketingCampaign(campaignId.value);
        status.value = 'SENDING';
        toast.success('Campaña enviándose');
    } catch (error: any) {
        toast.error('Error al enviar campaña');
    } finally {
        sending.value = false;
    }
};

const handleSchedule = async () => {
    if (!canSchedule.value) return;
    await handleSave();
    toast.success('Campaña programada');
};

const formatDateTime = (dt: string) => {
    return new Date(dt).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

onMounted(async () => {
    await loadResources();
    await loadCampaign();
});
</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <button 
                    class="p-2 hover:bg-surface-100 rounded-lg transition-colors"
                    @click="router.push('/clinic/marketing')"
                >
                    <ArrowLeftIcon class="w-5 h-5 text-surface-500" />
                </button>
                <div>
                    <h1 class="text-2xl font-bold text-surface-900">
                        {{ isEditMode ? 'Editar Campaña' : 'Nueva Campaña' }}
                    </h1>
                    <p v-if="status !== 'DRAFT'" class="text-surface-500 mt-1">
                        <span :class="[
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            status === 'SENT' ? 'bg-green-100 text-green-700' :
                            status === 'SENDING' ? 'bg-yellow-100 text-yellow-700' :
                            status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                        ]">
                            {{ status }}
                        </span>
                    </p>
                </div>
            </div>
            <div class="flex gap-3">
                <button 
                    class="btn-secondary"
                    @click="handleSave" 
                    :disabled="saving"
                >
                    {{ saving ? 'Guardando...' : '💾 Guardar borrador' }}
                </button>
                <button 
                    v-if="status === 'DRAFT'"
                    class="btn-primary" 
                    @click="handleSend" 
                    :disabled="!canSend || sending"
                >
                    {{ sending ? 'Enviando...' : '📤 Enviar ahora' }}
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
            <ArrowPathIcon class="w-8 h-8 animate-spin text-primary-600" />
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Form -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Basic Info -->
                <div class="card p-6">
                    <h2 class="text-lg font-semibold text-surface-900 mb-4">Información básica</h2>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-surface-700 mb-1">
                                Nombre de la campaña *
                            </label>
                            <input 
                                v-model="name" 
                                type="text" 
                                placeholder="Ej: Promoción Enero 2026"
                                class="input"
                                :disabled="status !== 'DRAFT'"
                            />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-surface-700 mb-1">
                                Asunto del email *
                            </label>
                            <input 
                                v-model="subject" 
                                type="text" 
                                placeholder="Ej: 🦷 ¡Ofertas especiales para ti!"
                                class="input"
                                :disabled="status !== 'DRAFT'"
                            />
                        </div>
                    </div>
                </div>

                <!-- Template Selection -->
                <div class="card p-6">
                    <h2 class="text-lg font-semibold text-surface-900 mb-4">📝 Plantilla</h2>
                    
                    <div v-if="templates.length === 0" class="text-center py-8">
                        <p class="text-surface-500 mb-3">No tienes plantillas.</p>
                        <button 
                            class="text-primary-600 hover:text-primary-700 font-medium"
                            @click="router.push('/clinic/marketing/templates')"
                        >
                            Crear una plantilla →
                        </button>
                    </div>

                    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div 
                            v-for="t in templates" 
                            :key="t.id"
                            :class="[
                                'p-4 rounded-xl border-2 cursor-pointer transition-all',
                                templateId === t.id 
                                    ? 'border-primary-500 bg-primary-50' 
                                    : 'border-surface-200 hover:border-surface-300'
                            ]"
                            @click="status === 'DRAFT' && (templateId = t.id)"
                        >
                            <div class="flex items-start gap-3">
                                <span class="text-2xl">📄</span>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-medium text-surface-900 truncate">{{ t.name }}</h4>
                                    <p class="text-sm text-surface-500 truncate">{{ t.subject }}</p>
                                </div>
                                <div v-if="templateId === t.id" class="text-primary-600 font-bold">✓</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Audience Selection -->
                <div class="card p-6">
                    <h2 class="text-lg font-semibold text-surface-900 mb-4">👥 Audiencia</h2>
                    
                    <div v-if="segments.length === 0" class="text-center py-8">
                        <p class="text-surface-500 mb-3">No tienes segmentos de audiencia.</p>
                        <button 
                            class="text-primary-600 hover:text-primary-700 font-medium"
                            @click="router.push('/clinic/marketing/segments/new')"
                        >
                            Crear un segmento →
                        </button>
                    </div>

                    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div 
                            v-for="s in segments" 
                            :key="s.id"
                            :class="[
                                'p-4 rounded-xl border-2 cursor-pointer transition-all',
                                segmentId === s.id 
                                    ? 'border-primary-500 bg-primary-50' 
                                    : 'border-surface-200 hover:border-surface-300'
                            ]"
                            @click="status === 'DRAFT' && (segmentId = s.id)"
                        >
                            <div class="flex items-start gap-3">
                                <span class="text-2xl">🎯</span>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-medium text-surface-900 truncate">{{ s.name }}</h4>
                                    <p class="text-sm text-surface-500">{{ s.patientCount }} pacientes</p>
                                </div>
                                <div v-if="segmentId === s.id" class="text-primary-600 font-bold">✓</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Scheduling -->
                <div class="card p-6">
                    <h2 class="text-lg font-semibold text-surface-900 mb-4">📅 Programación</h2>
                    
                    <div>
                        <label class="block text-sm font-medium text-surface-700 mb-1">
                            Fecha y hora de envío (opcional)
                        </label>
                        <input 
                            v-model="scheduledAt" 
                            type="datetime-local" 
                            class="input"
                            :disabled="status !== 'DRAFT'"
                        />
                        <p class="text-sm text-surface-400 mt-1">
                            Deja vacío para enviar manualmente
                        </p>
                    </div>

                    <button 
                        v-if="scheduledAt && status === 'DRAFT'"
                        class="btn-secondary mt-4"
                        @click="handleSchedule"
                        :disabled="!canSchedule"
                    >
                        🕐 Programar envío
                    </button>
                </div>
            </div>

            <!-- Summary Sidebar -->
            <div class="space-y-6">
                <div class="card p-6">
                    <h3 class="font-semibold text-surface-900 mb-4">Resumen</h3>
                    
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-surface-500">Campaña:</span>
                            <span class="font-medium text-surface-900 truncate ml-2">{{ name || '(sin nombre)' }}</span>
                        </div>
                        
                        <div class="flex justify-between">
                            <span class="text-surface-500">Plantilla:</span>
                            <span class="font-medium text-surface-900 truncate ml-2">{{ selectedTemplate?.name || '(ninguna)' }}</span>
                        </div>
                        
                        <div class="flex justify-between">
                            <span class="text-surface-500">Audiencia:</span>
                            <span class="font-medium text-surface-900 truncate ml-2">{{ selectedSegment?.name || '(ninguna)' }}</span>
                        </div>
                        
                        <div v-if="selectedSegment" class="flex justify-between pt-2 border-t border-surface-200">
                            <span class="text-surface-500">Destinatarios:</span>
                            <span class="font-bold text-primary-600">{{ selectedSegment.patientCount }} pacientes</span>
                        </div>

                        <div v-if="scheduledAt" class="flex justify-between">
                            <span class="text-surface-500">Envío:</span>
                            <span class="font-medium text-surface-900">{{ formatDateTime(scheduledAt) }}</span>
                        </div>
                    </div>
                </div>

                <div v-if="!canSend" class="card p-6 bg-yellow-50 border-yellow-200">
                    <h4 class="font-medium text-yellow-800 mb-3">⚠️ Antes de enviar:</h4>
                    <ul class="space-y-2 text-sm">
                        <li :class="name.trim() ? 'text-green-700' : 'text-yellow-700'">
                            {{ name.trim() ? '✓' : '○' }} Nombre de campaña
                        </li>
                        <li :class="subject.trim() ? 'text-green-700' : 'text-yellow-700'">
                            {{ subject.trim() ? '✓' : '○' }} Asunto del email
                        </li>
                        <li :class="templateId ? 'text-green-700' : 'text-yellow-700'">
                            {{ templateId ? '✓' : '○' }} Seleccionar plantilla
                        </li>
                        <li :class="segmentId ? 'text-green-700' : 'text-yellow-700'">
                            {{ segmentId ? '✓' : '○' }} Seleccionar audiencia
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card {
    background: white;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
}

.input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input:disabled {
    background-color: #f9fafb;
    cursor: not-allowed;
}
</style>
