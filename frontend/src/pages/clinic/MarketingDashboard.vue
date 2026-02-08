<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import { 
    getMarketingTemplates, 
    getMarketingCampaigns, 
    getBirthdaySettings,
    seedSystemTemplates,
    type MarketingTemplate,
    type MarketingCampaign,
    type BirthdaySettings
} from '../../services/marketing';
import { toast } from '../../composables/useToast';

const router = useRouter();

const templates = ref<MarketingTemplate[]>([]);
const campaigns = ref<MarketingCampaign[]>([]);
const birthdaySettings = ref<BirthdaySettings | null>(null);
const loading = ref(true);

// Stats
const stats = computed(() => ({
    totalTemplates: templates.value.filter(t => !t.isSystemTemplate).length,
    systemTemplates: templates.value.filter(t => t.isSystemTemplate).length,
    totalCampaigns: campaigns.value.length,
    sentCampaigns: campaigns.value.filter(c => c.status === 'SENT').length,
    draftCampaigns: campaigns.value.filter(c => c.status === 'DRAFT').length,
    birthdayEnabled: birthdaySettings.value?.isEnabled ?? false,
}));

const recentCampaigns = computed(() => 
    campaigns.value.slice(0, 5)
);

const loadData = async () => {
    loading.value = true;
    try {
        const [templatesData, campaignsData, birthdayData] = await Promise.all([
            getMarketingTemplates(),
            getMarketingCampaigns(),
            getBirthdaySettings(),
        ]);
        templates.value = templatesData;
        campaigns.value = campaignsData;
        birthdaySettings.value = birthdayData;
    } catch (error: any) {
        toast.error('Error al cargar datos de marketing');
    } finally {
        loading.value = false;
    }
};

const handleSeedTemplates = async () => {
    try {
        await seedSystemTemplates();
        toast.success('Plantillas del sistema creadas');
        await loadData();
    } catch (error: any) {
        toast.error('Error al crear plantillas');
    }
};

const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
        DRAFT: 'bg-gray-100 text-gray-700',
        SCHEDULED: 'bg-blue-100 text-blue-700',
        SENDING: 'bg-yellow-100 text-yellow-700',
        SENT: 'bg-green-100 text-green-700',
        PAUSED: 'bg-orange-100 text-orange-700',
        CANCELLED: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
};

const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
        DRAFT: 'Borrador',
        SCHEDULED: 'Programada',
        SENDING: 'Enviando',
        SENT: 'Enviada',
        PAUSED: 'Pausada',
        CANCELLED: 'Cancelada',
    };
    return labels[status] || status;
};

onMounted(loadData);
</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold text-surface-900">📧 Email Marketing</h1>
                <p class="text-surface-500 mt-1">Gestiona campañas, plantillas y automatizaciones</p>
            </div>
            <div class="flex gap-3">
                <button 
                    v-if="stats.systemTemplates === 0"
                    @click="handleSeedTemplates"
                    class="btn-secondary flex items-center gap-2"
                >
                    🌱 Crear plantillas sistema
                </button>
                <button 
                    @click="router.push('/clinic/marketing/campaigns/new')"
                    class="btn-primary flex items-center gap-2"
                >
                    ➕ Nueva Campaña
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
            <ArrowPathIcon class="w-8 h-8 animate-spin text-primary-600" />
        </div>

        <template v-else>
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div 
                    class="card p-5 cursor-pointer hover:shadow-lg transition-all group"
                    @click="router.push('/clinic/marketing/templates')"
                >
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            📝
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-surface-900">{{ stats.totalTemplates }}</p>
                            <p class="text-sm text-surface-500">Mis Plantillas</p>
                        </div>
                    </div>
                    <div class="mt-3 text-xs text-surface-400">
                        {{ stats.systemTemplates }} del sistema disponibles
                    </div>
                </div>

                <div 
                    class="card p-5 cursor-pointer hover:shadow-lg transition-all group"
                    @click="router.push('/clinic/marketing/campaigns/new')"
                >
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            📨
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-surface-900">{{ stats.totalCampaigns }}</p>
                            <p class="text-sm text-surface-500">Campañas</p>
                        </div>
                    </div>
                    <div class="mt-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            {{ stats.sentCampaigns }} enviadas
                        </span>
                    </div>
                </div>

                <div 
                    class="card p-5 cursor-pointer hover:shadow-lg transition-all group"
                    @click="router.push('/clinic/marketing/segments/new')"
                >
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            👥
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-surface-900">Segmentos</p>
                            <p class="text-sm text-surface-500">Audiencias</p>
                        </div>
                    </div>
                    <div class="mt-3 text-xs text-surface-400">
                        Crea grupos de pacientes
                    </div>
                </div>

                <div 
                    class="card p-5 cursor-pointer hover:shadow-lg transition-all group"
                    @click="router.push('/clinic/marketing/birthday')"
                >
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            🎂
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-surface-900">Cumpleaños</p>
                            <p class="text-sm text-surface-500">Automatización</p>
                        </div>
                    </div>
                    <div class="mt-3">
                        <span :class="[
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            stats.birthdayEnabled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        ]">
                            {{ stats.birthdayEnabled ? '✓ Activo' : '⚠ Inactivo' }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="card p-6">
                <h2 class="text-lg font-semibold text-surface-900 mb-4">Acciones rápidas</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button 
                        class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 hover:border-primary-300 hover:bg-primary-50 transition-all"
                        @click="router.push('/clinic/marketing/templates')"
                    >
                        <span class="text-2xl">📚</span>
                        <span class="text-sm font-medium text-surface-700">Ver plantillas</span>
                    </button>
                    <button 
                        class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 hover:border-primary-300 hover:bg-primary-50 transition-all"
                        @click="router.push('/clinic/marketing/campaigns/new')"
                    >
                        <span class="text-2xl">✉️</span>
                        <span class="text-sm font-medium text-surface-700">Crear campaña</span>
                    </button>
                    <button 
                        class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 hover:border-primary-300 hover:bg-primary-50 transition-all"
                        @click="router.push('/clinic/marketing/segments/new')"
                    >
                        <span class="text-2xl">🎯</span>
                        <span class="text-sm font-medium text-surface-700">Crear segmento</span>
                    </button>
                    <button 
                        class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 hover:border-primary-300 hover:bg-primary-50 transition-all"
                        @click="router.push('/clinic/marketing/birthday')"
                    >
                        <span class="text-2xl">🎁</span>
                        <span class="text-sm font-medium text-surface-700">Configurar cumpleaños</span>
                    </button>
                </div>
            </div>

            <!-- Recent Campaigns -->
            <div class="card p-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-semibold text-surface-900">Campañas recientes</h2>
                    <button 
                        class="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        @click="router.push('/clinic/marketing/campaigns/new')"
                    >
                        Ver todas →
                    </button>
                </div>

                <div v-if="recentCampaigns.length === 0" class="text-center py-12">
                    <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-3xl">📭</span>
                    </div>
                    <h3 class="text-lg font-semibold text-surface-700 mb-2">No hay campañas todavía</h3>
                    <p class="text-surface-500 mb-4">Crea tu primera campaña de email marketing</p>
                    <button 
                        class="btn-primary"
                        @click="router.push('/clinic/marketing/campaigns/new')"
                    >
                        Crear primera campaña
                    </button>
                </div>

                <div v-else class="divide-y divide-surface-100">
                    <div 
                        v-for="campaign in recentCampaigns" 
                        :key="campaign.id"
                        class="flex items-center justify-between py-4 cursor-pointer hover:bg-surface-50 -mx-6 px-6 transition-colors"
                        @click="router.push(`/clinic/marketing/campaigns/${campaign.id}/edit`)"
                    >
                        <div>
                            <h3 class="font-medium text-surface-900">{{ campaign.name }}</h3>
                            <p class="text-sm text-surface-500">{{ campaign.subject }}</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <span :class="[
                                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                                getStatusColor(campaign.status)
                            ]">
                                {{ getStatusLabel(campaign.status) }}
                            </span>
                            <span v-if="campaign.status === 'SENT'" class="text-xs text-surface-400">
                                {{ campaign.sentCount }}/{{ campaign.totalRecipients }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
.card {
    background: white;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
}
</style>
