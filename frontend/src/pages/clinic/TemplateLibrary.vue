<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowPathIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline';
import { 
    getMarketingTemplates, 
    cloneSystemTemplate,
    deleteMarketingTemplate,
    type MarketingTemplate 
} from '../../services/marketing';
import { toast } from '../../composables/useToast';

const router = useRouter();

const templates = ref<MarketingTemplate[]>([]);
const loading = ref(true);
const activeTab = ref<'system' | 'custom'>('system');
const selectedCategory = ref<string>('all');

const categories = [
    { value: 'all', label: 'Todas' },
    { value: 'birthday', label: '🎂 Cumpleaños' },
    { value: 'promo', label: '💰 Promociones' },
    { value: 'seasonal', label: '🗓️ Estacionales' },
    { value: 'educational', label: '📚 Educativas' },
    { value: 'reactivation', label: '⏰ Reactivación' },
    { value: 'onboarding', label: '🆕 Bienvenida' },
];

const systemTemplates = computed(() => 
    templates.value.filter(t => t.isSystemTemplate)
);

const customTemplates = computed(() => 
    templates.value.filter(t => !t.isSystemTemplate)
);

const filteredTemplates = computed(() => {
    const list = activeTab.value === 'system' ? systemTemplates.value : customTemplates.value;
    if (selectedCategory.value === 'all') return list;
    return list.filter(t => t.category === selectedCategory.value);
});

const loadTemplates = async () => {
    loading.value = true;
    try {
        templates.value = await getMarketingTemplates();
    } catch (error: any) {
        toast.error('Error al cargar plantillas');
    } finally {
        loading.value = false;
    }
};

const handleClone = async (template: MarketingTemplate) => {
    try {
        const cloned = await cloneSystemTemplate(template.id);
        toast.success(`Plantilla "${cloned.name}" creada`);
        await loadTemplates();
        activeTab.value = 'custom';
    } catch (error: any) {
        toast.error('Error al clonar plantilla');
    }
};

const handleEdit = (template: MarketingTemplate) => {
    router.push(`/clinic/marketing/templates/${template.id}/edit`);
};

const handleDelete = async (template: MarketingTemplate) => {
    if (!confirm(`¿Eliminar plantilla "${template.name}"?`)) return;
    
    try {
        await deleteMarketingTemplate(template.id);
        toast.success('Plantilla eliminada');
        await loadTemplates();
    } catch (error: any) {
        toast.error('Error al eliminar plantilla');
    }
};

const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
        birthday: '🎂',
        promo: '💰',
        seasonal: '🗓️',
        educational: '📚',
        reactivation: '⏰',
        onboarding: '🆕',
        newsletter: '📰',
        custom: '✏️',
    };
    return icons[category] || '📝';
};

const getCategoryColors = (category: string) => {
    const colors: Record<string, string> = {
        birthday: 'from-pink-400 to-rose-500',
        promo: 'from-green-400 to-emerald-500',
        seasonal: 'from-orange-400 to-amber-500',
        educational: 'from-blue-400 to-indigo-500',
        reactivation: 'from-purple-400 to-violet-500',
        onboarding: 'from-cyan-400 to-teal-500',
    };
    return colors[category] || 'from-gray-400 to-slate-500';
};

onMounted(loadTemplates);
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
                <h1 class="text-2xl font-bold text-surface-900">📚 Biblioteca de Plantillas</h1>
            </div>
            <button 
                class="btn-primary"
                @click="router.push('/clinic/marketing/templates/new')"
            >
                ➕ Nueva Plantilla
            </button>
        </div>

        <!-- Tabs -->
        <div class="bg-white rounded-xl border border-surface-200">
            <nav class="flex gap-2 p-2">
                <button
                    @click="activeTab = 'system'"
                    :class="[
                        'flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-all',
                        activeTab === 'system'
                            ? 'bg-primary-50 text-primary-700 shadow-sm'
                            : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50',
                    ]"
                >
                    🏢 Plantillas del Sistema ({{ systemTemplates.length }})
                </button>
                <button
                    @click="activeTab = 'custom'"
                    :class="[
                        'flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-all',
                        activeTab === 'custom'
                            ? 'bg-primary-50 text-primary-700 shadow-sm'
                            : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50',
                    ]"
                >
                    ✏️ Mis Plantillas ({{ customTemplates.length }})
                </button>
            </nav>
        </div>

        <!-- Category Filter -->
        <div class="flex flex-wrap gap-2">
            <button
                v-for="cat in categories"
                :key="cat.value"
                @click="selectedCategory = cat.value"
                :class="[
                    'px-4 py-2 rounded-full text-sm font-medium transition-all',
                    selectedCategory === cat.value
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-white border border-surface-200 text-surface-600 hover:border-surface-300',
                ]"
            >
                {{ cat.label }}
            </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
            <ArrowPathIcon class="w-8 h-8 animate-spin text-primary-600" />
        </div>

        <!-- Templates Grid -->
        <div v-else-if="filteredTemplates.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
                v-for="template in filteredTemplates" 
                :key="template.id"
                class="card overflow-hidden group hover:shadow-lg transition-all"
            >
                <!-- Preview -->
                <div :class="[
                    'h-28 flex items-center justify-center bg-gradient-to-br',
                    getCategoryColors(template.category || 'custom')
                ]">
                    <span class="text-5xl group-hover:scale-110 transition-transform">
                        {{ getCategoryIcon(template.category || 'custom') }}
                    </span>
                </div>

                <!-- Info -->
                <div class="p-4">
                    <h3 class="font-semibold text-surface-900 truncate">{{ template.name }}</h3>
                    <p class="text-sm text-surface-500 truncate mt-1">{{ template.subject }}</p>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-600 mt-2">
                        {{ template.category }}
                    </span>
                </div>

                <!-- Actions -->
                <div class="px-4 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                    <template v-if="template.isSystemTemplate">
                        <button 
                            @click="handleClone(template)"
                            class="px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                            title="Copiar a mis plantillas"
                        >
                            📋 Usar
                        </button>
                    </template>
                    <template v-else>
                        <button 
                            @click="handleEdit(template)"
                            class="p-2 hover:bg-surface-100 rounded-lg transition-colors"
                            title="Editar"
                        >
                            ✏️
                        </button>
                        <button 
                            @click="handleDelete(template)"
                            class="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                            title="Eliminar"
                        >
                            🗑️
                        </button>
                    </template>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="card p-12 text-center">
            <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-3xl">📄</span>
            </div>
            <h3 class="text-lg font-semibold text-surface-700 mb-2">
                {{ activeTab === 'custom' ? 'No tienes plantillas personalizadas' : 'No hay plantillas' }}
            </h3>
            <p class="text-surface-500 mb-4">
                {{ activeTab === 'custom' 
                    ? 'Crea una nueva plantilla o clona una del sistema' 
                    : 'No hay plantillas del sistema en esta categoría' 
                }}
            </p>
            <button 
                v-if="activeTab === 'custom'"
                class="btn-primary"
                @click="router.push('/clinic/marketing/templates/new')"
            >
                Crear plantilla
            </button>
        </div>
    </div>
</template>

<style scoped>
.card {
    background: white;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
}
</style>
